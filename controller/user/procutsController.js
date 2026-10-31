const mongoose = require("mongoose");
const User = require('../../model/userSchema');
const Product = require("../../model/productSchema"); 
const Category = require("../../model/categorySchema"); 
const Brand = require("../../model/brandSchema"); 
const {determineStatus ,getSpecialOffer , calculateBestOffer} = require("../../utils/helper");
const Wishlist = require("../../model/wishlistSchema");
const Review = require("../../model/reviewSchema");
const Order =  require("../../model/orderSchema");
const Offer = require("../../model/offerSchema");
const { ObjectId } = require('mongoose').Types;
const { validateReviewForm } = require("../../utils/validation");            

const loadHome = async (req , res) => {
    try {
        const { isLoggedIn, userData, isUserBlocked } = res.locals;
    
        let products  = await Product.find({
            isDeleted:false ,
            isListed : true ,
            status : "Available"
        })
        .populate({ path:"category", match:{isListed:true}, select:"name" })
        .populate({ path:"brand", match:{isListed:true}, select:"brandName"})
        // .populate("rating", "rating")
        .limit(11);

        let wishlist = null;
        if (isLoggedIn) {
            wishlist = await Wishlist.findOne({ userId: userData._id });
        }

        let offers  = await Product.find({
            isDeleted : false ,
            isListed : true,
            productOffer: { $gt : 0}
        })
        .populate({ path:"category", match:{isListed:true}, select:"name" })
        .populate({ path:"brand", match:{isListed:true}, select:"brandName"})
        // .populate("rating", "rating")
        .limit(10);

        let topProducts  = await Product.find({
            isDeleted : false ,
            isListed : true 
        })
        .populate({ path:"category", match:{isListed:true}, select:"name" })
        .populate({ path:"brand", match:{isListed:true}, select:"brandName"})
        // .populate("rating", "rating")
        .sort({ "ratingsSummary.averageRating": -1 })
        .limit(8)
    
        //filtering products that has brand and category
        products = products.filter(pr => pr.category && pr.brand);
        products = await mapProductDetails(products);
        
        offers = offers.filter(off => off.category && off.brand);
        offers = await mapProductDetails(offers);
        
        topProducts = topProducts.filter(top => top.category && top.brand);
        topProducts = await mapProductDetails(topProducts);

        const offer = await Offer.findOne({
            status: "Active",
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
          
        });

        res.setHeader('Cache-Control', 'no-store');
        res.render("home", {
          products,
          offers,
          topProducts,
          user: userData,
          isLoggedIn: isLoggedIn,
          showBlockedNotification: isUserBlocked,
          wishlist,
          offer,
          endDate: offer?.endDate?.toISOString() 
        }); 
    } catch (error) {
        console.error("Home page not loading:", error);
        res.status(500).render("errorPage");
    }
};

const mapProductDetails = async (products) => {
    
    return Promise.all(products.map(async product => {
      const bestOffer = await calculateBestOffer(product, 1);
      const finalPrice = product.regularPrice - bestOffer.amount;
      
      return {    
        _id: product._id,            
        productName: product.productName,
        description: product.description,
        category: product.category,
        brand:product.brand,
        rating: product.ratingsSummary.averageRating ,
        salePrice: finalPrice,           
        regularPrice: product.regularPrice,
        cardImage: product.cardImage,
        status: ["Available", "out of stock"].includes(product.status),

      };

    }));
};

const getProducts = async (req, res) => {
    try {
        const { isLoggedIn, userData, isUserBlocked } = res.locals;
        const { search, sort, category, priceMin, priceMax, brand } = req.query;
        
        let query = {
            isDeleted: false,
            isListed: true,
        };

        if (search) {
            query.$or = [
                { productName: { $regex: search.trim(), $options: "i" } }
            ];
        }

        if (category) {
            const categories = Array.isArray(category) ? category : [category];
            const categoryDocs = await Category.find({
                name: { $in: categories.map(c => new RegExp(`^${c}$`, 'i')) },
                isListed: true,   
                isDeleted: false
            }).select('_id');
            const categoryIds = categoryDocs.map(cat => cat._id);
    
            if (categoryIds.length > 0) {
                query.category = { $in: categoryIds };
            }
        }

        if (priceMin || priceMax) {
            query.salePrice = {};
            if (priceMin) query.salePrice.$gte = Number(priceMin);
            if (priceMax) query.salePrice.$lte = Number(priceMax);
        }

        if (brand) {
            const brands = Array.isArray(brand) ? brand : [brand];
            const brandDocs = await Brand.find({
                brandName: { $in: brands.map(b => new RegExp(`^${b}$`, 'i')) },
                isListed: true,   
                isDeleted: false
            }).select('_id');
            const brandIds = brandDocs.map(br => br._id);
    
            if (brandIds.length > 0) {
                query.brand = { $in: brandIds };
            }
        }


        let sortOption = {};
        switch (sort) {
            case "price-low-to-high": sortOption = { salePrice: 1 }; break;
            case "price-high-to-low": sortOption = { salePrice: -1 }; break;
            case "title-asc": sortOption = { productName: 1 }; break;
            case "title-desc": sortOption = { productName: -1 }; break;
            case "rating": sortOption = { "ratingsSummary.averageRating": -1 }; break;
            case "new-arrivals": sortOption = { createdAt: -1 }; break;
            default: sortOption = { createdAt: -1 };
        }

        // Get min and max prices from database
        const priceStats = await Product.aggregate([
            {
                $match: {
                    isDeleted: false,
                    isListed: true,
                }
            },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: "$salePrice" },
                    maxPrice: { $max: "$salePrice" }
                }
            }
        ]);

        const dbMinPrice = priceStats.length > 0 ? priceStats[0].minPrice : 0;
        const dbMaxPrice = priceStats.length > 0 ? priceStats[0].maxPrice : 999999;
      

        // Fetch categories and brands, with fallback
        const allCategories = await Category.find({ isDeleted: false, isListed: true }).select("name") || [];
        const allBrands = await Brand.find({ isDeleted: false, isListed: true }).select("brandName") || [];
         
        let products = await Product.find(query)
            .populate({ 
                path: "category", 
                match: { isListed: true, isDeleted: false }, 
                select: "name" 
            })
            .populate({ 
                path: "brand", 
                match: { isListed: true, isDeleted: false }, 
                select: "brandName" 
            })
            .sort(sortOption)
            .lean();

        products = products.filter(pr => pr.category && pr.brand);

        const transformedProducts = await mapProductDetails(products);

        let filterQueryParts = [];
        if (category) {
            const categories = Array.isArray(category) ? category : [category];
            categories.forEach(cat => filterQueryParts.push(`category=${encodeURIComponent(cat)}`));
        }
        if (brand) {
            const brands = Array.isArray(brand) ? brand : [brand];
            brands.forEach(br => filterQueryParts.push(`brand=${encodeURIComponent(br)}`));
        }
        if (priceMin) filterQueryParts.push(`priceMin=${priceMin}`);
        if (priceMax) filterQueryParts.push(`priceMax=${priceMax}`);
        const filterQuery = filterQueryParts.length > 0 ? `&${filterQueryParts.join('&')}` : '';

        
        let wishlist = null;
        if (isLoggedIn) {
            wishlist = await Wishlist.findOne({ userId: userData._id });
        }

        const renderData = {
            products: transformedProducts,
            categories: allCategories.map(cat => cat.name),
            brands: allBrands.map(br => br.brandName),
            searchQuery: search || "",
            sortOption: sort || "",
            selectedCategories: category ? (Array.isArray(category) ? category : [category]) : [],
            selectedBrands: brand ? (Array.isArray(brand) ? brand : [brand]) : [],
            priceMin: priceMin || dbMinPrice,
            priceMax: priceMax || dbMaxPrice,
            dbMinPrice: dbMinPrice,  
            dbMaxPrice: dbMaxPrice,  
            filterQuery: filterQuery,
            isLoggedIn: isLoggedIn,
            user: userData,
            showBlockedNotification: isUserBlocked,
            wishlist
        };
        
        res.render("products",renderData);
    } catch (error) {
        console.error("Error fetching products:", error);
      
        const errorData = {
            products: [],
            categories: [],
            brands: [],
            searchQuery: "",
            sortOption: "",
            selectedCategories: [],
            selectedBrands: [],
            priceMin: 0,
            priceMax: 999999,
            dbMinPrice: 0,
            dbMaxPrice: 999999,
            filterQuery: "",
            error: "An error occurred while fetching products. Please try again.",
            isLoggedIn: res.locals.isLoggedIn,
            user: res.locals.userData,
            showBlockedNotification: res.locals.isUserBlocked
        };
        res.status(500).render("products", errorData);
    }
};
  
const getProductDetails = async (req, res, next) => {
    try {
        const { userData, isLoggedIn, isUserBlocked } = res.locals;
        const { productId } = req.params;
        
        const currentUrl = req.originalUrl;
          
        let product = await Product.findById(productId)
            .populate('category', 'name isListed categoryOffer')
            .populate('brand', 'brandName isListed brandOffer')
            .lean();
        
        const status = await determineStatus(productId);
        product.status = status;
        
        if (status === 'Discontinued') {
            return res.redirect('/products');
        }
        
        // Calculate all available discounts
        const productDiscount = Math.max((product.regularPrice - product.salePrice), 0);
        const categoryDiscount = product.category?.categoryOffer 
            ? (product.regularPrice * product.category.categoryOffer) / 100 
            : 0;
        const brandDiscount = product.brand?.brandOffer 
            ? (product.regularPrice * product.brand.brandOffer) / 100 
            : 0;
        
        // Get special offers
        const specialOffers = await getSpecialOffer(product);
        
        const availableOffers = [];
        
        if (productDiscount > 0) {
            availableOffers.push({
                type: 'product',
                name: 'Product Discount',
                discount: productDiscount,
                discountPercentage: Math.round((productDiscount / product.regularPrice) * 100),
                description: `${Math.round((productDiscount / product.regularPrice) * 100)}% off on ${product.productName}`
            });
        }
        
        if (categoryDiscount > 0) {
            availableOffers.push({
                type: 'category', 
                name: `${product.category.name} Category Offer`,
                discount: categoryDiscount,
                discountPercentage: product.category.categoryOffer,
                description: `${product.category.categoryOffer}% off on all ${product.category.name} products`
            });
        }
        
        if (brandDiscount > 0) {
            availableOffers.push({
                type: 'brand',
                name: `${product.brand.brandName} Brand Offer`,
                discount: brandDiscount,
                discountPercentage: product.brand.brandOffer,
                description: `${product.brand.brandOffer}% off on all ${product.brand.brandName} products`
            });
        }

        for (const special of specialOffers) {
            if (special.discount > 0) {
                availableOffers.push({
                    type: special.appliedOn,
                    name: special.offerName,
                    discount: special.discount,
                    description: `Special offer: ${special.description}`,
                    endDate: special.endDate,
                    isSpecial: true
                });
            }
        }
        
        // Calculate best offer
        const bestOffer = await calculateBestOffer(product, 1); 
        
        // Calculate final sale price
        const finalPrice = product.regularPrice - bestOffer.amount;

        const ratingsSummary = calculateRatingPercentages(product.ratingsSummary);          
        
        // related products
        let relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },
            isDeleted: false,
            isListed: true
        })
        .populate('category', 'name isListed')
        .populate('brand', 'brandName isListed')
        .lean();
        
        relatedProducts = relatedProducts.filter(pr => pr?.category?.isListed && pr?.brand?.isListed).slice(0,7);
    
        relatedProducts =  await mapProductDetails(relatedProducts)

        res.render('product-details', {
            product,
            relatedProducts,
            title: product.productName,
            isLoggedIn: isLoggedIn,              
            user: userData,                     
            showBlockedNotification: isUserBlocked,
            availableOffers,
            ratingsSummary,
            bestOffer,  
            finalPrice,
            currentUrl: currentUrl  
        });

    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

const getProductReviews = async (req, res) =>{
    try {
            const { productId } = req.params;
            const {userData} = res.locals;
            const { page = 1, limit = 5, type = 'recent' } = req.query;
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
        
            let query = {};
            switch (type) {    
                case 'recent':
                    query = { createdAt: -1 };
                    break;
                case 'highlyRated':
                    query = { rating: -1, createdAt: -1 };
                    break;
                case 'lowestRated':
                    query = { rating: 1, createdAt: -1 };
                    break;
                default:
                    query = { createdAt: -1 };
            }
            
            const totalReviews = await Review.countDocuments({ productId: productId });
                  
            const reviews = await Review.find({ 
                productId: productId
            })
            .populate('userId', 'username profileImage _id') 
            .sort(query)   
            .skip(skip)
            .limit(parseInt(limit))    
            .lean();  


            // Transform results for frontend
            const formattedReviews = reviews.map(review => {
                return {
                    _id: review._id,
                    rating: review.rating,
                    title: review.title,
                    feedback: review.feedback,
                    verifiedPurchase: review.verifiedPurchase,
                    votedUsers: review.votedUsers || [],
                    createdAt: review.createdAt,
                    user: review.userId ? {
                        _id: review.userId._id,
                        username: review.userId.username,
                        profileImage: review.userId.profileImage
                    } : null
                };
            });
            
            // Calculate if there are more reviews to load
            const hasMore = totalReviews > skip + formattedReviews.length;

            const product = await Product.findById(productId);
            const ratingsSummary = calculateRatingPercentages(product.ratingsSummary);
         
            return res.json({      
                success: true,
                reviews: formattedReviews,
                hasMore,
                user:userData,
                ratingsSummary,
                total: totalReviews,
                page: parseInt(page),
                limit: parseInt(limit)
            });
          

    } catch (error) {
      console.error('Error fetching product reviews:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching reviews' });
    }
};


function calculateRatingPercentages(ratingsSummary) {
    const total = ratingsSummary.totalReviews || 0;
    const counts = ratingsSummary.ratingCounts || {};
    
    const count = {};
    const percentage = {};

    for (let i = 1; i <= 5; i++) {
        const ratingStr = i.toString();
        const ratingCount = counts[ratingStr] || 0;
        count[ratingStr] = ratingCount;
        percentage[ratingStr] = total === 0 ? 0 : (ratingCount / total) * 100;
    }
   return { count, percentage } 
};
      
// Helper function 
const updateProductRatingSummary = async (productId) => {
    const reviews = await Review.find({ productId });

    if (reviews.length === 0) {
        await Product.findByIdAndUpdate(productId, {
            ratingsSummary: {
                averageRating: 0,
                totalReviews: 0,
                ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
            }
        });
        return;
    }

    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;

    reviews.forEach(review => {
        ratingCounts[review.rating]++;
        ratingSum += review.rating;
    });

    const averageRating = ratingSum / reviews.length;

    await Product.findByIdAndUpdate(productId, {
        ratingsSummary: {
            averageRating: parseFloat(averageRating.toFixed(1)),
            totalReviews: reviews.length,
            ratingCounts
        }
    });
};

const hasUserPurchasedProductForReview = async (userId, productId) => {
    try {

        const productObjectId = mongoose.Types.ObjectId.isValid(productId) ? 
                                 new mongoose.Types.ObjectId(productId) : productId;

        const order = await Order.findOne({
            userId: userId, 
            status: { $in: ["Delivered", "Return Request", "Returned", "Partially Returned"] }, 
            "orderedItems.product": productObjectId 
        });
        return !!order;

    } catch (error) {
        console.error("Error checking user purchase:", error);
        return false; 
    }
};

const addReview = async (req, res) => {
    try {
        const { productId } = req.params;
        const {userData} = res.locals;

        if(!userData ) {
            return res.status(404).json({ success: false, message:"Pls sign in to add review..",redirectUrl:"/signin"});   
        }

        const errors = validateReviewForm(req.body);
        if (errors) {
            console.error(errors)
            return res.status(400).json({ success: false, errors });
        };
        
        const existingReview = await Review.findOne({
            userId: userData,
            productId: productId
        });
        
        if (existingReview) {
            return res.status(400).json({ message: 'You have already reviewed this product' });
        }

        const isVerifiedPurchase = await hasUserPurchasedProductForReview(userData._id ,productId );
        
        // // Create new review
        const newReview = new Review({
            userId: userData,
            productId: productId,
            rating: req.body.rating,
            title: req.body.reviewTitle,
            feedback: req.body.reviewText,
            verifiedPurchase: isVerifiedPurchase
        });
        
        await newReview.save();
        await updateProductRatingSummary(productId);
        
        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            review: newReview
        });

    } catch (error) {
        console.error('Error creating review:', error);
        return res.status(500).json({ message: 'Error submitting review' });
    }
};

const deleteProductReview = async (req , res) => {
    try {

        const { reviewId } = req.params;
        const {userData} = res.locals;

        if(!userData ) {
            return res.status(404).json({ success: false, message:"Pls sign in to add review..",redirectUrl:"/signin"});   
        };

        const review = await Review.findById(reviewId);
        if(!review) {
            return res.status(404).json({ success: false, message:"review not found.."});   
        };

        if((userData._id).toString() !== review.userId.toString() ) {
            return res.status(404).json({ success: false, message:"Unauthorized to delete the review."});   
        };
    
        await review.deleteOne();

        // Update product rating summary
        await updateProductRatingSummary(review.productId);
        
         return res.status(200).json({ success: true , message: 'Review deleted successfully'});    
    } catch (error) {
        console.error('Error deleting review:', error);
        return res.status(500).json({ success: false, message: 'Error deleting review' });
    }
};

const editReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const {userData} = res.locals;
        const {rating,reviewTitle,reviewText} = req.body;

        if(!userData ) {
            return res.status(404).json({ success: false, message:"Pls sign in to edit the review..",redirectUrl:"/signin"});   
        }

        const errors = validateReviewForm(req.body);
        if (errors) {
            console.log(errors)
            return res.status(400).json({ success: false, errors });
        };

        const review = await Review.findById(reviewId);
        if(!review) {
            return res.status(404).json({ success: false, message:"review not found.."});   
        }

        if((userData._id).toString() !== review.userId.toString() ) {
            return res.status(404).json({ success: false, message:"unable to edit the review.."});   
        };

        const isVerifiedPurchase = await hasUserPurchasedProductForReview(userData._id ,review.productId);
            
        review.rating = rating;
        review.title = reviewTitle;
        review.feedback = reviewText;
        review.verifiedPurchase = isVerifiedPurchase;

        await review.save();

        // Update product rating summary
        await updateProductRatingSummary(review.productId);
        
        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            review
        });

    } catch (error) {
        console.error('Error editing review:', error);
        return res.status(500).json({ message: 'Error submitting review' });
    }
};

const toggleVoteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { userData } = res.locals;

        if(!userData ) {
            return res.status(404).json({ success: false, message:"Unable to like the review.. pls login",redirectUrl:"/signin"});   
        };

        // Find the review
        const review = await Review.findById(reviewId);
        
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }; 

        const index = review.votedUsers.findIndex(id => id.toString() === userData._id.toString());
    
        if (index === -1) {           
            review.votedUsers.push(userData._id);
        } else {
            review.votedUsers.splice(index, 1);
        };
           
        await review.save();
        
        return res.status(200).json({
            success: true,
            message: ' review liked..',
            review   
        });
    } catch (error) {
        console.error('Error voting for review:', error);
        return res.status(500).json({ message: 'Error processing your vote' });
    }
};





module.exports  = {
    loadHome,
    getProducts,
    getProductDetails,
    getProductReviews,
    addReview,
    editReview,
    toggleVoteReview,
    deleteProductReview,
}