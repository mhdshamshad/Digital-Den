const validator = require("validator");
const Product  = require("../model/productSchema");
const Offer = require("../model/offerSchema");


async function determineStatus(productId) {
    try {
      
        const product = await Product.findById(productId)
            .populate('brand')
            .populate('category')
            .lean();

        if (!product) {
            throw new Error('Product not found');
        }

        const brandIsListed = product.brand?.isListed ?? false; 
        const categoryIsListed = product.category?.isListed ?? false; 

        // console.log(`Determining status for product ${product.productName}:`, {
        //     isListed:product.isListed,
        //     brandIsListed,
        //     categoryIsListed,
        //     quantity:product.quantity,
        // });

        if (!brandIsListed) {
            return 'Discontinued';
        }

        if (!categoryIsListed) {
            return 'Discontinued';
        }

        if (!product.isListed) {
            return 'Discontinued';
        }

        if (product.quantity <= 0) {
            return 'Out of stock';
        }
        return 'Available';
    } catch (error) {
        console.error(`Error determining status for product ${productId}:`, error.stack);
        return 'Discontinued';
    }
};

const updateProductsForBrand = async (brandId) => {
    try {
        const products = await Product.find({ brand: brandId })
            .populate('category')
            .populate('brand');

        for (let product of products) {
            const newStatus = await determineStatus(product._id);
            if (product.status !== newStatus) {
                product.status = newStatus;
                await product.save();
            } 
        }
    } catch (error) {
        console.error(`Error updating product statuses for brand ${brandId}:`, error.stack);
    }
};

const updateProductsForCategory = async (categoryId) => {
    try {
        const products = await Product.find({ category: categoryId })
            .populate('category')
            .populate('brand');

        for (let product of products) {
            const newStatus = await determineStatus(product._id);
            if (product.status !== newStatus) {
                console.log(`Updating status for product ${product._id} from ${product.status} to ${newStatus}`);
                product.status = newStatus;
                await product.save();
            }
        }
    } catch (error) {
        console.error(`Error updating product statuses for category ${categoryId}:`, error.stack);
    }
}; 

function validateUser(req) {
    const {username, email, password} = req.body;
    
    if (!validator.isAlphanumeric(username.replace(/\s/g, ''))){
        return "Please enter a valid Username";
    }
    
    if(!validator.isEmail(email)) {
        return "Please enter a valid Email";
    }
    
    if(!validator.isStrongPassword(password)) {
        return "Please enter a strong password";
    }
    
    return null; 
}

//otp generating 
function generateOtp(){
  return  Math.floor(100000 + Math.random() * 900000).toString();
} 

const generateCustomId = (TNX = "ID") => {
    const timestamp = Date.now().toString().slice(-6); 
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${TNX}-${timestamp}${random}`; 
};

async function calculateCartTotals(cart, product, quantity, appliedCoupon = null) {
    let subtotal = 0;
    let totalDiscount = 0;
    let couponDiscount = 0;
    let discountDetails = []; 

     //  When Cart is Empty
    if (!cart?.items || cart.items.length === 0) {
        if (product && quantity) {
            const status = await determineStatus(product._id);
            if (status === 'Discontinued' || status === 'Out of stock') {
                return { subtotal: 0, discount: 0, tax: 0, shipping: 0, totalAmount: 0, couponDiscount: 0, discountDetails: [] };
            }

            subtotal = product.regularPrice * quantity;

            const {amount , type } = await calculateBestOffer(product , quantity );

            totalDiscount = amount ;

            discountDetails.push({ productId: product._id, type , amount: amount / quantity ,total:amount });
        }
    // When Cart has Items
    } else {
        const productIds = cart.items.map(item => item.productId);
        
        const products = await Product.find({ 
            _id: { $in: productIds },
            isListed: true
        }).populate('brand').populate('category');
        
        for (const item of cart.items) {
            if (item.discontinuedAt) continue;
            
            const itemProduct = products.find(pr => 
                pr._id.toString() === (typeof item.productId === 'object' 
                    ? item.productId._id.toString() 
                    : item.productId.toString())
            );

            if (!itemProduct) {
                item.discontinuedAt = new Date();
                continue;
            }
            
            const status = await determineStatus(itemProduct._id);
            if (status === 'Discontinued' || status === 'Out of stock') {
                item.discontinuedAt = new Date();
                continue;
            }


            const itemSubtotal = itemProduct.regularPrice * item.quantity;
            subtotal += itemSubtotal;

            const {amount , type } = await calculateBestOffer(itemProduct , item.quantity );

            totalDiscount += amount ;

            discountDetails.push({ productId: itemProduct._id, type, amount: amount / item.quantity , total:amount });
        }

        // Add New Product if not in cart
        if (product && quantity) {
            const isNewProduct = !cart.items.some(item => 
                (typeof item.productId === 'object' 
                    ? item.productId._id.toString() 
                    : item.productId.toString()) === product._id.toString()
            );
            
            if (isNewProduct) {
                const status = await determineStatus(product._id);
                if (status !== 'Discontinued' && status !== 'Out of stock') {
                    const newSubtotal = product.regularPrice * quantity;
                    subtotal += newSubtotal;

                    const { amount, type } = await calculateBestOffer(product, quantity);
                    totalDiscount += amount ;

                    discountDetails.push({ productId: product._id, type, amount: amount/ quantity  });
                }
            }
        }
    }

    // coupon handle 
    if (appliedCoupon && ( subtotal-totalDiscount >= appliedCoupon.minPurchase)) {
        if (appliedCoupon.status === 'Active' && (!appliedCoupon.expireOn || new Date() <= appliedCoupon.expireOn)) {
            if (appliedCoupon.type === 'Percentage') {
                couponDiscount = ((subtotal-totalDiscount) * appliedCoupon.discount) / 100;
                if (appliedCoupon.maxDiscount && couponDiscount > appliedCoupon.maxDiscount) {
                    couponDiscount = appliedCoupon.maxDiscount;
                }
            } else if (appliedCoupon.type === 'Fixed') {
                couponDiscount = appliedCoupon.discount;
            }
        }
    }

    const netTotal = subtotal - totalDiscount - couponDiscount;
    const shipping =  !netTotal ? 0 : ( netTotal > 500 ? 0 : 50);
    const tax = (netTotal + shipping) * 0.18 
    const totalAmount = netTotal + tax + shipping ;  // 9 for tax on shipping 18%

    return { subtotal, discount: totalDiscount, tax, shipping, totalAmount, couponDiscount, discountDetails };
}

async function getSpecialOffer(product) {
    const now = new Date();
    const regularPrice = product.regularPrice;
    const MAX_DISCOUNT = regularPrice * 0.5; 

    const offers = await Offer.find({
        status: 'Active',
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
            { appliedOn: 'product', products: product._id },
            { appliedOn: 'brand', brands: product.brand?._id || product.brand },
            { appliedOn: 'category', categories: product.category?._id || product.category }
        ]
    });

    const specialOffers = [];
   
    for (let offer of offers) {
        let discount = 0;

        if (offer.type === "Percentage") {
            discount = (regularPrice * offer.discount) / 100;
        } else if (offer.type === "Fixed") {
            discount = offer.discount;
        }

        discount = Math.min(discount, MAX_DISCOUNT);

        specialOffers.push({
            discount,
            type: offer.type,
            offerName: offer.name,
            endDate: offer.endDate,
            description: offer.description,
            appliedOn: offer.appliedOn,
        });
    }

    return specialOffers;
} 

async function calculateBestOffer (product , quantity) {

    const productDiscount = Math.max((product.regularPrice - product.salePrice), 0)* quantity;
    const categoryDiscount = product.category?.categoryOffer 
        ? (product.regularPrice * product.category.categoryOffer * quantity) / 100 
        : 0;
    const brandDiscount = product.brand?.brandOffer 
        ? (product.regularPrice * product.brand.brandOffer * quantity) / 100 
        : 0;

    const specialOffers = await getSpecialOffer(product);

    const specialDiscount = specialOffers.length > 0
        ? Math.max(...specialOffers.map(offer => offer.discount * quantity))
        : 0;

    const maxDiscount = Math.max(productDiscount, categoryDiscount , brandDiscount ,specialDiscount);

    let discountType = 'product';
    if (maxDiscount === categoryDiscount){
        discountType = 'category';
    }else if (maxDiscount === brandDiscount) {
        discountType = 'brand';
    }else if (maxDiscount === specialDiscount) {
        discountType = 'special';
    }

    return {amount : maxDiscount , type : discountType }
};


module.exports = {
    validateUser,
    generateOtp,
    getSpecialOffer,
    calculateCartTotals,
    calculateBestOffer,
    determineStatus,
    updateProductsForBrand,
    generateCustomId,
    updateProductsForCategory
}