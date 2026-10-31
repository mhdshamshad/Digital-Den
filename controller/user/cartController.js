const Cart = require("../../model/cartSchema");
const Product = require("../../model/productSchema");
const { determineStatus , generateCustomId 
        ,calculateCartTotals , calculateBestOffer} = require("../../utils/helper");
const User = require("../../model/userSchema");
const Address = require("../../model/addressModel");
const Order  = require("../../model/orderSchema");
const Wishlist = require("../../model/wishlistSchema"); 
const Wallet = require("../../model/walletSchema");
const Coupon = require("../../model/couponSchema");
const Offer = require("../../model/offerSchema");
const {State} = require("country-state-city");
const mongoose = require("mongoose");
const env = require("dotenv").config();
const Razorpay = require('razorpay');
const crypto = require("crypto");


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getWishlistPage = async (req , res) => {

    try {
        const { isLoggedIn, userData  } = res.locals;

        if (!isLoggedIn ) {
            return res.status(401).json({ success: false, message: "Please login to manage wishlist",redirectUrl:"/signin" });
        }

        const wishlist = await Wishlist.findOne({ userId: userData._id })
            .populate({
                path: 'products.productId',
                populate: [
                    { path: "brand" },
                    { path: "category" }
                ]
            })
         

        if (!wishlist) {
            return res.render("wishlist", {
                wishlist: { products: [] }
            });
        } 

        const validProducts = [];
        for(let i = 0;i < wishlist.products.length ;i++){
            const item = wishlist.products[i];
            const product = item.productId;

            if(!product || !product._id) continue;

            const status = await determineStatus(product._id );
            product.status = status;
            await product.save();

            validProducts.push(item);

        }
            wishlist.products = validProducts;
            await wishlist.save();

       // Prepare wishlist data for rendering
       const wishlistData = {
        products: wishlist.products
            .map(item => {
                const productData = item.productId;
                if (!productData || !productData._id) return null;

                return {
                    product: {
                        id: productData._id,
                        name: productData.productName,
                        brand: productData.brand?.brandName,
                        category: productData.category?.name,
                        salePrice: productData.salePrice,
                        regularPrice: productData.regularPrice,
                        status: productData.status,
                        quantity: productData.quantity,
                        cardImage: productData.cardImage,
                        rating: productData.rating
                    }
                };
            })
            .filter(item => item !== null) 
        };

    res.render("wishlist", { wishlist: wishlistData });

    } catch (error) {
        console.error("Error in Wishlist:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to load cart page", 
            error: error.message 
        });
    }  
};

const addToWishlist = async (req , res )=>{
    const { isLoggedIn, userData, isUserBlocked } = res.locals;
    const { productId } = req.body;
    if (!isLoggedIn) {
        return res.status(401).json({ success: false, message: "Please login to add to wishlist",redirectUrl:"/signin" });
    }

    if (isUserBlocked) {
        return res.status(401).json({ success: false, message: "User is blocked and can't take actions" });
    }

    if (!productId) {
        return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    try {

        const product = await Product.findById(productId)
            .populate('brand')
            .populate('category');

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Check product 
        const status = await determineStatus(product._id);
        if (status === 'Discontinued') {
            return res.status(400).json({ success: false, message: "Product is discontinued or unavailable" });
        }

        const existingProduct = await Wishlist.findOne({
            userId: userData._id,
            'products.productId': productId
        });

        if (existingProduct) {
            return res.status(400).json({ success: false, message: "Product is already in your wishlist" });
        }


        const wishlist =  await Wishlist.findOneAndUpdate(
            { userId:userData._id},
            {
                $push: {
                    products: {
                        productId :product._id,
                        addedOn:new Date()
                    }
                }
            },
            {
                upsert:true,
                new :true,
                runValidators:true  // Ensure schema validators are applied
            }
        );

        res.status(200).json({ success: true, message: "Product added to wishlist successfully" });

    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add product to wishlist",
            error: error.message
        });
    }
}

const removeFromWishlist = async (req, res) => {
    const { isLoggedIn, userData, isUserBlocked } = res.locals;
    const { productId } = req.body;

    if (!isLoggedIn) {
        return res.status(401).json({ success: false, message: "Please login to remove from wishlist" });
    }

    if (isUserBlocked) {
        return res.status(401).json({ success: false, message: "User is blocked and can't take actions" });
    }

    if (!productId) {
        return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    try {
        const wishlist = await Wishlist.findOne({ userId: userData._id });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        // Find the index of the product in the wishlist
        const productIndex = wishlist.products.findIndex(item =>
            item.productId.toString() === productId.toString()
        );

        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not found in wishlist" });
        }

        // Remove the product from the wishlist
        wishlist.products.splice(productIndex, 1);
        await wishlist.save();

        res.status(200).json({ success: true, message: "Product removed from wishlist successfully" });

    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove product from wishlist",
            error: error.message
        });
    }
};
 
// const cron = require('node-cron');
// const { checkout } = require("../../router/user");


// const cron = require('node-cron');
// cron.schedule('0 0 * * *', async () => {
//     try {
//         await cleanupDiscontinuedItems();
//         console.log('Discontinued items cleanup completed');
//     } catch (error) {
//         console.error('Error in discontinued items cleanup:', error);
//     }
// });

// async function cleanupDiscontinuedItems() {
//     const deletePeriod = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

//     await Cart.updateMany(
//         { "items.discontinuedAt": { $lt: deletePeriod } },
//         { $pull: { items: { discontinuedAt: { $lt: deletePeriod } } } }
//     );
// }


const addToCart = async (req ,res) => {

    const { userData} = res.locals;
    let { productId, quantity } = req.body;

    quantity = parseInt(quantity);

    try {
        const product = await Product.findById(productId)
            .populate('brand')
            .populate('category');

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Check product status using determineStatus
        const status = await determineStatus(product._id);
        if (status === 'Discontinued') {
            return res.status(404).json({ success: false, message: "Product is discontinued or unavailable" });
        }
        if (status === 'Out of stock') {
            return res.status(400).json({ success: false, message: "Product is out of stock" });
        }

        const maxQuantity = 10;
        let cart = await Cart.findOne({ userId: userData._id });
        let existingQuantity = 0;
        let existingItemIndex = -1;

        if (cart) {
            existingItemIndex = cart.items.findIndex(item => 
                item.productId.toString() === productId.toString()
            );
            
            if (existingItemIndex !== -1) {
                existingQuantity = cart.items[existingItemIndex].quantity;
            }
        }
        const totalQuantity = existingQuantity + quantity;
        
        if (totalQuantity > product.quantity) {
            return res.status(400).json({ success: false, message: `Sorry, only ${product.quantity} items available in stock` 
            });
        } 
        if (totalQuantity > maxQuantity) {
            return res.status(400).json({ 
                success: false, 
                message: `Maximum quantity per product is ${maxQuantity}` 
            });
        }

        let totalItemDiscount = await calculateBestOffer(product , quantity);

        if(!cart) {
            const totals = await calculateCartTotals(null, product, quantity);
            cart = new Cart({
                userId:userData._id,
                items:[{
                    productId:product._id,
                    quantity:quantity,
                    price:product.salePrice,
                    totalPrice:product.salePrice * quantity,
                    totalDiscount:totalItemDiscount.amount
                }],
                subtotal: totals.subtotal,
                discount: totals.discount,
                tax: totals.tax.toFixed(2),
                shipping: totals.shipping,
                couponDiscount : totals.couponDiscount,
                totalAmount: totals.totalAmount
            });
        }else {

             // Update existing or add new one 
             if (existingItemIndex !== -1) {
                cart.items[existingItemIndex].quantity = totalQuantity;
                cart.items[existingItemIndex].totalPrice = totalQuantity * product.salePrice;
                cart.items[existingItemIndex].totalDiscount = totalItemDiscount.amount
                cart.items[existingItemIndex].discontinuedAt = null;
            } else {
                cart.items.push({
                    productId: product._id,
                    quantity: quantity,
                    price: product.salePrice,
                    totalPrice: product.salePrice * quantity,
                    totalDiscount : totalItemDiscount.amount
                });
            }



            const appliedCoupon = cart.appliedCoupon ? await Coupon.findById(cart.appliedCoupon) : null;
            const totals = await calculateCartTotals(cart, product, quantity, appliedCoupon);
            cart.subtotal = totals.subtotal;
            cart.discount = totals.discount;
            cart.tax = totals.tax.toFixed(2);
            cart.shipping = totals.shipping;
            cart.totalAmount = totals.totalAmount;
            cart.couponDiscount = totals.couponDiscount;

        } 

        await cart.save();

        // Remove the product from the wishlist
        let wishlist = await Wishlist.findOne({ userId: userData._id });
        if (wishlist) {
            const wishlistItemIndex = wishlist.products.findIndex(item => 
                item.productId.toString() === productId.toString()
            );
            if (wishlistItemIndex !== -1) {
                console.log("Product found :",productId)
                await Wishlist.updateOne({ userId: userData._id }, { $pull: { products: { productId: product._id } } });
                await wishlist.save();
            }
        }

        res.status(200).json({ success: true, message: "Product added to cart successfully" });
        
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ success: false, message: "Failed to add product to cart", error: error.message }); 
    }
} 

const getCartPage = async (req, res) => {
    const { userData } = res.locals;

    try {
        const defaultCart = { 
            items: [], subtotal: 0,  discount: 0,tax: 0,shipping: 0,totalAmount: 0,couponDiscount: 0 
        };

        let cart = await Cart.findOne({ userId: userData._id })
            .populate({ path: 'items.productId', populate: ["brand", "category"] })
            .populate('appliedCoupon');


        // Fetch available coupons
        const coupons = await Coupon.find({
            status: 'Active',
            expireOn: { $gte: new Date() },
            $or: [{ usersUsed: { $ne: userData._id } }, { usersUsed: { $exists: false } }],
        });

        if (!cart) return res.render('cart', { cart: defaultCart, coupons });

        cart = await checkCartItemStatus(cart);  
        cart = await validateCartCoupon(cart);    

        const appliedCoupon = cart.appliedCoupon ? await Coupon.findById(cart.appliedCoupon) : null;
        const totals = await calculateCartTotals(cart, null, null, appliedCoupon);

        cart.subtotal = totals.subtotal;
        cart.discount = totals.discount;
        cart.tax = totals.tax.toFixed(2);
        cart.shipping = totals.shipping;
        cart.couponDiscount = totals.couponDiscount
        cart.totalAmount = totals.totalAmount;
        cart.discountDetails = totals.discountDetails;

        await cart.save();
        

        const cartData = {
            items: cart.items.map(item => {
                const product = item.productId;
                const discount = totals.discountDetails.find(d => d.productId.toString() === product._id.toString()) || {};
                const effectivePrice = product.regularPrice - (discount.amount || 0 );
                
                return {
                    product: {
                        id: product._id,
                        name: product.productName,
                        brand: product.brand?.brandName,
                        category: product.category?.name,
                        salePrice: effectivePrice,
                        regularPrice: product.regularPrice,
                        status: product.status,
                        quantity: product.quantity,
                        cardImage: product.cardImage,
                        rating: product.rating,
                    },
                    isDiscontinued : !!item.discontinuedAt,
                    quantity: item.quantity,
                    totalPrice: effectivePrice * item.quantity,
                    discountType: discount.type || 'product',
                    discountPercentage: discount.amount ? Math.round((discount.amount / product.regularPrice) * 100) : 0
                };
            }),
            subtotal: cart.subtotal,
            discount: cart.discount,
            tax: cart.tax,
            shipping: cart.shipping,
            shipping: cart.shipping,
            couponDiscount : cart.couponDiscount,
            totalAmount: cart.totalAmount,
            couponCode: appliedCoupon?.code || null
        }

        res.render("cart", { cart: cartData, coupons });

    } catch (error) {
        console.error("Error in getCartPage:", error);
        res.status(500).json({ success: false, message: "Failed to load cart page", error: error.message });
    }
};

async function checkCartItemStatus(cart) {

    for (let i = cart.items.length - 1; i >= 0; i--) {
        const item = cart.items[i];
        const product = await Product.findById(item.productId);

        if (!product) {
            cart.items.splice(i, 1);
            continue;
        }

        const status = await determineStatus(product._id);

        if (product.status !== status) {
            product.status = status;
            await product.save();
        }

        if (status === 'Discontinued' || status === 'Out of stock') {
            item.discontinuedAt = item.discontinuedAt || new Date();
        } else if (item.discontinuedAt) {
            item.discontinuedAt = null;
        }
        let totalItemDiscount = await calculateBestOffer(product, item.quantity );

        if (item.quantity > product.quantity && product.quantity > 0) {
            item.quantity = product.quantity;
            item.totalPrice = item.price * item.quantity;
            item.totalDiscount = totalItemDiscount.amount
            
        } else {
            item.totalPrice = item.price * item.quantity;
            item.totalDiscount = totalItemDiscount.amount
        }
    }

    await cart.save();
    return cart;
}

const applyCoupon = async (req, res) => {

    const { userData, isUserBlocked } = res.locals;
    const { couponCode } = req.body;

    if (isUserBlocked) return res.status(401).json({ success: false, message: "User is blocked and can't take actions..!" });

    try {
        const cart = await Cart.findOne({ userId: userData._id })
             .populate('items.productId').populate('appliedCoupon');

        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        if (cart.appliedCoupon?.code === couponCode) {
            return res.status(400).json({ success: false, message: "This coupon is already applied to your cart" });
        }

        const coupon = await Coupon.findOne({ code: couponCode, status: 'Active', expireOn: { $gte: new Date() } });
        if (!coupon) {
            return res.status(400).json({ success: false, message: "Coupon not found or expired" });
        }

        if (coupon.usersUsed.includes(userData._id)) {
            return res.status(400).json({ success: false, message: "You have already used this coupon" });
        }

        // Calculate subtotal of valid products  
        const subtotal = cart.items
            .filter(item => !item.discontinuedAt && item.productId.status !== 'Out of stock')
            .reduce((acc, item) => acc + (item.totalPrice - item.totalDiscount) , 0);
            console.log("subtotal:",subtotal);

        if (subtotal < coupon.minPurchase) {
            return res.json({ success: false, message: `Minimum purchase ₹${coupon.minPurchase} required` });
        }

        if (cart.appliedCoupon) {
            await Coupon.updateOne(
                { _id: cart.appliedCoupon._id },
                { $pull: { usersUsed: userData._id } }
            );
            cart.appliedCoupon = null;
            cart.couponDiscount = 0;
        }

        const totals = await calculateCartTotals(cart, null, null, coupon);
        cart.appliedCoupon = coupon._id;
        cart.subtotal = totals.subtotal;
        cart.discount = totals.discount;
        cart.tax = totals.tax.toFixed(2);
        cart.shipping = totals.shipping;
        cart.totalAmount = totals.totalAmount;
        cart.couponDiscount = totals.couponDiscount;

        await cart.save();
            
        await Coupon.updateOne({ _id: coupon._id }, { $addToSet: { usersUsed: userData._id } });

        res.status(200).json({ 
            success: true, 
            message: "Coupon applied successfully", 
            cart: prepareCartData(cart),
            appliedCoupon: { code: coupon.code, couponDiscount : totals.couponDiscount }
        });

    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ success: false, message: "Failed to apply coupon", error: error.message });
    }
};

const updateCart = async (req , res) => {
    
    try {
        const maxQuantity = 10;
        let {productId , quantity } = req.body;
        const {userData } = res.locals;

        const product = await Product.findById(productId)
            .populate('brand')
            .populate('category')
            // .populate('appliedCoupon');

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const status = await determineStatus(product._id);
        if (status === 'Discontinued') {
            return res.status(400).json({ success: false, message: "Product is discontinued or unavailable" });
        }
        if (status === 'Out of stock') {
            return res.status(400).json({ success: false, message: "Product is out of stock" });
        }

        const cart = await Cart.findOne({userId:userData._id});

        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        const cartItemIndex = cart.items.findIndex(item => 
            item.productId.toString() === productId.toString()
        );

        if (cartItemIndex === -1) {
            return res.status(404).json({ success: false, message: "Item not found in cart" });
        }

        if(quantity === 1){
            let currentQty = cart.items[cartItemIndex].quantity;
            if(currentQty + quantity > product.quantity ) {
                return res.status(404).json({
                    success:false,
                    message:`Sorry, only ${product.quantity} items available in stock` 
    
                })
            }else if ( currentQty + quantity > maxQuantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Maximum quantity per product is ${maxQuantity}` 
                });
            }else {
                cart.items[cartItemIndex].quantity = currentQty + quantity; 
            }
        };

        if(quantity === -1 ){
            let currentQty = cart.items[cartItemIndex].quantity;
            const newQty = currentQty + quantity;
        
            if (newQty < 1) {
                cart.items.splice(cartItemIndex, 1); 
            } else if (newQty > product.quantity) {
                cart.items[cartItemIndex].quantity = product.quantity;
            } else {
                cart.items[cartItemIndex].quantity = newQty;
            }
        }

        const totalItemDiscount =await calculateBestOffer( product,cart.items[cartItemIndex].quantity)
        // Update item quantity and price
        cart.items[cartItemIndex].totalPrice = product.regularPrice *  cart.items[cartItemIndex].quantity ;
        cart.items[cartItemIndex].totalDiscount = totalItemDiscount.amount


         // Clear any discontinued flag
        if (cart.items[cartItemIndex].discontinuedAt) {
            cart.items[cartItemIndex].discontinuedAt = null;
        }

        await validateCartCoupon(cart);

         const totals = await calculateCartTotals(cart);
         cart.subtotal = totals.subtotal;
         cart.discount = totals.discount;
         cart.tax = totals.tax.toFixed(2);
         cart.shipping = totals.shipping; 
         cart.couponDiscount = totals.couponDiscount,
         cart.totalAmount = totals.totalAmount;

        await cart.save();
    
        const cartData = prepareCartData(cart);

        res.status(200).json({ 
            success: true, 
            message: "Cart updated successfully", 
            cart: cartData 
        });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to update cart", 
            error: error.message 
        }); 
    }
};

const validateCartCoupon = async (cart) => {
    try {
        if (!cart.appliedCoupon) return cart;
        
        const coupon = await Coupon.findById(cart.appliedCoupon);
        if (!coupon) {
            cart.appliedCoupon = null;
            cart.couponDiscount = 0;
            return cart;
        }
        const subtotal = cart.items
            .filter(item => !item.discontinuedAt && 
                   (typeof item.productId === 'object' ? 
                     item.productId.status !== 'Out of stock' : true))
            .reduce((acc, item) => acc + (item.totalPrice - item.totalDiscount) , 0);

        if (subtotal < coupon.minPurchase) {

            await Coupon.updateOne(
                { _id: coupon._id },
                { $pull: { usersUsed: cart.userId } }
            );
        
            cart.appliedCoupon = null;
            cart.couponDiscount = 0;
        }
        return cart;
    } catch (error) {
        console.error("Error validating cart coupon:", error);
        return cart;
    }
};

function prepareCartData(cart) {
    return {
        items: cart.items.map(item => {
            const productData = item.productId;
            
            return {
                product: {
                    id: productData._id ,
                    name: productData.productName,
                    status: productData.status || 'Available'
                },
                isDiscontinued: !!item.discontinuedAt,
                quantity: item.quantity,
                totalPrice: item.totalPrice,
    
            };
        }),
        subtotal: cart.subtotal,
        discount: cart.discount,
        tax: cart.tax,
        shipping: cart.shipping,
        couponDiscount: cart.couponDiscount,
        totalAmount: cart.totalAmount
    };
}

const removeFromCart = async (req , res ,next ) => {

    let {productId } = req.body;
    const {userData , isUserBlocked} = res.locals;

    if (isUserBlocked) {
        return res.status(401).json({ success: false, message: "User is blocked and can't take actions..!" });
    }
    try {

        const cart = await Cart.findOne({ userId: userData._id });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }
        
         // Find the item index in the cart
         const itemIndex = cart.items.findIndex(item => 
            item.productId.toString() === productId.toString()
        );

        if (itemIndex === -1) {
            return res.status(404).json ({ success: false, message: "Item not found in cart" });
        }

        cart.items.splice(itemIndex, 1);
 
        // Recalculate cart totals
        await validateCartCoupon(cart);
        const totals = await calculateCartTotals(cart);
        
        cart.subtotal = totals.subtotal;
        cart.discount = totals.discount;
        cart.tax = totals.tax.toFixed(2);
        cart.shipping = totals.shipping;
        cart.couponDiscount = totals.couponDiscount,
        cart.totalAmount = totals.totalAmount;

        await cart.save();
        // Prepare cart data for response
        const cartData = prepareCartData(cart);

        return res.status(200).json({success: true,message:"Item removed from cart successfully"})
        
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
}

const  proceedToCheckout = async (req , res , next) => {
    const { userData} = res.locals;
    
    try {
        const cart = await Cart.findOne({ userId: userData._id })
            .populate({
                path: "items.productId",
                select: "productName productImage salePrice regularPrice isListed quantity status"
            });

            
        if (!cart || cart.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        } 
        
        for (const item of cart.items) {
            const product = item.productId;

            if (!product) {
                return res.status(400).json({ success: false, message: "One or more products in your cart are no longer available" });
            }

            const status = await determineStatus(product._id);
            product.status = status;
            await product.save();

            if (status === 'Discontinued') {
                return res.status(400).json({ success: false, message: `${product.productName} is discontinued and cannot be checked out` });
            }
            if (status === 'Out of stock') {
                return res.status(400).json({ success: false, message: `${product.productName} is out of stock `});
            }
            if ( product.quantity < item.quantity) {
                return res.status(400).json({ success: false, message: `${product.productName} has only ${product.quantity } in stock` });
            }  
        }
        req.session.checkoutActive = true;
        req.session.cartId = cart._id;

        res.status(200).json({ 
            success: true, 
            message: "Moved to checkout successfully",
            checkoutData: {
                items: cart.items,
                subtotal: cart.subtotal,
                discount: cart.discount,
                tax: cart.tax,
                shipping: cart.shipping,
                totalAmount: cart.totalAmount
            },
            redirectUrl : "/checkout"
        });   
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }

}
 
const getCheckoutPage = async (req, res ,next) => {
    const {userData, isLoggedIn,isUserBlocked} = res.locals;
    if (!isLoggedIn || isUserBlocked) {
        return res.status(401).redirect("/");
    }
    try {

        // Fetch the user
        const user = await User.findById(userData._id);
        if (!user) {
            return res.redirect("/");
        }

        const cart = await Cart.findOne({ userId: userData._id })
            .populate({
                path: 'items.productId',
                select: 'productName cardImage salePrice regularPrice isListed quantity status',
                populate: [
                    { path: "brand" },
                    { path: "category" }
                ]
            });
        
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }


      const userAddresses = await Address.findOne({ userId:userData._id  });
      const addresses = userAddresses ? userAddresses.addresses : []; 
      const indianStates = State.getStatesOfCountry("IN");

      const wallet = await Wallet.findOne({userId:userData._id});
      const walletBalance = wallet ? wallet.balance  : 0;


        const cartItems = await Promise.all(cart.items.map(async item => {
            const product = item.productId;
            const {amount } = await calculateBestOffer(product, 1);
            const salePrice = product.regularPrice - amount;
 
            return {
                id: item._id,
                productId: product._id,
                productName: product.productName,
                cardImage: product.cardImage,
                salePrice: salePrice,
                regularPrice: product.regularPrice,
                quantity: item.quantity,
                totalPrice: salePrice * item.quantity,
                
            };
        }));

        const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        const defaultAddress = addresses.some(addr => addr.isDefault);

        res.render("checkout",{
            checkoutData : {
                states: indianStates,
                addresses,
                defaultAddress,
                cartItems,
                walletBalance,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                summery:{
                    totalItems,
                    subtotal:cart.subtotal,
                    discount: cart.discount,
                    discount: cart.discount,
                    couponDiscount : cart.couponDiscount,
                    tax: cart.tax,
                    shipping: cart.shipping,
                    totalAmount: cart.totalAmount
                }    
            }
        })

    } catch (error) {
        error.statusCode = 500;
        next(error);
        
    }
}

const placeOrder = async (req, res, next ) => {
    try {
        const { userData, isLoggedIn, isUserBlocked } = res.locals;

        if (!isLoggedIn || isUserBlocked) {
            return res.status(401).redirect("/");
        }

        const { addressId, paymentMethod, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        if (!addressId || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Address and payment method are required" });
        }

        let paymentStatus = "Pending"

        const user = await User.findById(userData._id);
        if(!user ){
            return res.status(404).json({success:false , message:"User not found"});
        }

        let cart = await Cart.findOne({ userId: userData._id }).populate({
            path: "items.productId",
            select: "productName salePrice regularPrice quantity status",
            populate: [
                { path: "brand" },
                { path: "category" },
            ],
        }).populate('appliedCoupon'); 

            cart.items = cart.items.filter(item => !item.discontinuedAt);

            if(!cart || cart.items.length === 0 ){
                return res.status(400).json({success:false , message:"Cart is empty"});
            }

            const appliedCouponId = cart.appliedCoupon;
            const couponDiscount = cart.couponDiscount;

            for(let item  of cart.items){
                const product = await Product.findById(item.productId._id);
                if(!product){
                    return res.status(400).json({success:false,message:"products in your cart are no longer available"})
                }
                if (product.quantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product.productName}. Only ${product.quantity} units available.`,
                    });
                }

                const status = await determineStatus(product._id);
                product.status = status;
                await product.save();

                if(status === "Discontinued" ){
                    return res.status(400).json({success:false,message:`${product.productName} is discontinued and cannot be ordered`})  
                }
            }
            const userAddresses = await Address.findOne({ userId: userData._id });
            if (!userAddresses) {
                return res.status(404).json({ success: false, message: "No addresses found for this user" });
            }

            const selectedAddress = userAddresses.addresses.find(addr => {
                return addr._id.toString() === addressId;
            });

            if (!selectedAddress) {
                return res.status(404).json({ success: false, message: "Selected address not found" });
            };

            if(paymentMethod === "Wallet"){
                const wallet = await Wallet.findOne({userId:userData._id});
                const walletBalance = wallet ? wallet.balance : 0 ;

                if(walletBalance < cart.totalAmount ){
                    return res.status(404).json({ success: false, message: "Insufficient wallet balance to complete the order" });
                }

                wallet.balance -= cart.totalAmount;
                wallet.transactions.push({
                    amount:-cart.totalAmount,
                    type:"Debit",
                    method:"OrderPayment",
                    status:"Completed",
                    description:`Payment for order ${generateCustomId("ORD")}`,
                    date:Date.now()
                });
                wallet.lastUpdated = Date.now();
                await wallet.save();

                paymentStatus = "Paid";
            }else if (paymentMethod === "Online"){
                if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                    return res.status(400).json({ success: false, message: "Razorpay payment details are required" });
                };

                const generatedSignature = crypto
                    .createHmac('sha256',process.env.RAZORPAY_KEY_SECRET)
                    .update(razorpay_order_id + '|' + razorpay_payment_id)
                    .digest('hex');

                    paymentStatus = generatedSignature === razorpay_signature ? "Paid" : "Failed";

                    if (paymentStatus === "Failed") {
                        return res.status(400).json({ success: false, message: "Payment verification failed" });
                    }
            }else if (paymentMethod === "COD") {
                paymentStatus = "Pending";
            };
            

            const orderedItems = await Promise.all(cart.items.map(async item => {
                const offerDiscount = await calculateBestOffer(item.productId, 1);
                const salePrice = item.productId.regularPrice - offerDiscount.amount ;

                return {
                  product: item.productId._id,
                  quantity: item.quantity,
                  price: salePrice,
                  totalAmount:salePrice * item.quantity 
                };
            }));

            const newOrder = new Order({
                userId:user._id,
                orderId:generateCustomId("ORD"),
                orderedItems,
                totalPrice:cart.subtotal,
                discount:cart.discount,
                tax:cart.tax,
                shipping:cart.shipping,
                couponDiscount : couponDiscount,
                finalAmount:cart.totalAmount,
                address :selectedAddress,
                paymentMethod,
                invoiceDate:Date.now(),
                status:paymentStatus === "Paid" ? "Processing" : "Pending",
                paymentStatus,
                appliedCoupon : appliedCouponId,
                couponApplied: appliedCouponId ? true : false,
                razorpay_payment_id: paymentMethod === 'Online' ? razorpay_payment_id : undefined,
                razorpay_order_id: paymentMethod === 'Online' ? razorpay_order_id : undefined,
            })

            await newOrder.save();

            // Clear the cart
            await Cart.findOneAndUpdate(
                { userId: userData._id },
                { $set: { items: [], subtotal: 0, discount: 0, tax: 0, shipping: 0,couponDiscount : 0, totalAmount: 0 ,appliedCoupon: null } }
            );

            for(let item  of cart.items){
                const product = await Product.findById(item.productId._id);
                product.quantity -= item.quantity;
                await product.save();
            }

            req.session.orderId = newOrder.orderId

            return res.status(200).json({
                success:true,
                message:"Order placed Successfully",
                orderId:newOrder.orderId
            })

    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

const createRazorpayOrder = async (req, res , next) => {
    try {
        const { userData } = res.locals;
        const { amount } = req.body;

        // Validate amount
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid positive amount"
            });
        }

        if (!razorpay) {
            console.error("Razorpay instance is not initialized");
            return res.status(500).json({
                success: false,
                message: "Payment service is not available"
            });
        }

        const user = await User.findById(userData._id);

        const receiptId = `order_${Date.now()}`;
        const options = {
            amount: amount * 100, 
            currency: "INR",
            receipt: receiptId,
            notes: {
                userId: user._id.toString(),
                email: user.email,
                purpose: "Order Payment"
            }
        };

        const order = await razorpay.orders.create(options);

        const transactionId = "ORD" + Date.now() + crypto.randomBytes(3).toString('hex');

        return res.status(200).json({
            success: true,
            message: "Order created successfully",
            order: {
                id: order.id,
                amount: order.amount / 100, 
                currency: order.currency,
                receipt: order.receipt
            },
            key_id: process.env.RAZORPAY_KEY_ID,
            transactionId: transactionId,
            user: {
                name: user.username || "Customer",
                email: user.email || "customer@example.com",
                contact: user.phone || ""
            },
            checkoutData: {
                razorpayKeyId: process.env.RAZORPAY_KEY_ID
            }
        });
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

const getOrderFailurePage = async (req, res , next) => {
    try {
        const { totalAmount, addressId, error_description } = req.query;

        if (!totalAmount || !addressId) {
            return res.redirect('/checkout'); 
        }
 
        const user = await User.findById(res.locals.userData); 
        const wallet = await Wallet.findOne({ userId: user._id });
        const walletBalance = wallet ? wallet.balance : 0;

        res.render('orderFailure', {
            totalAmount: parseFloat(totalAmount),
            addressId,
            error_description: error_description || 'Payment failed',
            walletBalance,
            currentDate: new Date().toLocaleDateString()
        });
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

const retryPayment = async (req, res , next) => {
    try {
        const { addressId, paymentMethod, totalAmount } = req.body;

        if (!addressId || !paymentMethod || !totalAmount) {
            return res.status(400).json({ success: false, message: "Address, payment method, and total amount are required" });
        }

        // Reuse the placeOrder logic
        req.body.razorpay_payment_id = req.body.razorpay_payment_id || undefined;
        req.body.razorpay_order_id = req.body.razorpay_order_id || undefined;
        req.body.razorpay_signature = req.body.razorpay_signature || undefined;

        return await placeOrder(req, res);
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

module.exports = {
    addToCart,
    getCartPage,
    applyCoupon,
    updateCart,
    removeFromCart,
    retryPayment,
    getOrderFailurePage,
    proceedToCheckout, 
    getCheckoutPage,
    placeOrder,
    createRazorpayOrder,
    getWishlistPage,
    addToWishlist,
    removeFromWishlist
};
 