const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const productsController = require("../controller/user/procutsController");
const cartController = require("../controller/user/cartController.js");
const addressController = require("../controller/user/addressController.js");
const orderController = require("../controller/user/orderController.js");
const profileController = require("../controller/user/profileController.js")
const walletController = require("../controller/user/walletController.js")
const {userErrorHandler} = require("../middleware/errorHandler.js");
const { checkBlockedStatus ,checkSignupSession,
      checkUserLoggedIn} = require('../middleware/userAuthMiddleware.js');
const passport = require("passport");
const userUpload = require("../middleware/userUpload.js");


// user router 
router.get("/signin",userController.loadLoagin);
router.post("/signin",userController.login);
router.get("/signup",userController.loadSignup );
router.post("/signup",userController.signup);
router.get("/verify-otp",userController.loadVerifyOtp);
router.post("/verify-otp" ,checkSignupSession, userController.verifyOTP);
router.post("/resend-otp", checkSignupSession ,userController.resendOtp);
router.get("/logout",userController.logout);
router.get("/Forgot-Password",userController.loadForgotPage);
router.post("/Forgot-Password",userController.forgotPassword);
router.get("/reset-otp",userController.getResetOtpPage);
router.post("/resend-fOtp",userController.resendResetOtp)
router.post("/reset-otp",userController.forgotOtp);
router.get("/reset-password",userController.loadResetPassword);
router.patch("/reset-password",userController.ResetPassword);
              
// constact us & aboutus 
router.get("/contactUs",profileController.getContactUsPage);               
router.get("/aboutUs",profileController.getAboutUsPage);
     
// Google OAuth routes
router.get("/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"]
}));
   
router.get("/auth/google/callback", 
    passport.authenticate("google", {
        failureRedirect: "/signin",
        failureFlash: true
    }),
    (req, res) => {
       req.session.user = req.user._id;
        res.redirect("/");
    }
);
     
//home 
router.use(checkBlockedStatus);
router.get("/", productsController.loadHome);
                              
// products-page
router.get("/products", productsController.getProducts);
router.get('/product/:productId', productsController.getProductDetails);

router.get('/product/:productId/reviews',productsController.getProductReviews);
router.post('/product/addReview/:productId',productsController.addReview);
router.patch('/product/editReview/:reviewId',productsController.editReview);
router.post('/product/review/like/:reviewId',productsController.toggleVoteReview);
router.delete('/product/deleteReview/:reviewId',productsController.deleteProductReview);
                                      
router.use(checkUserLoggedIn)

// wishlist 
router.get("/wishlist",cartController.getWishlistPage);
router.post("/wishlist/add",cartController.addToWishlist);
router.post('/wishlist/remove', cartController.removeFromWishlist);

// Cart
router.get("/cart" ,cartController.getCartPage);
router.post('/cart/add', cartController.addToCart);
router.post("/cart/update",cartController.updateCart);
router.post("/cart/remove",cartController.removeFromCart);
router.post('/cart/apply-coupon', cartController.applyCoupon);

// error-page 
router.get("/error-404",userController.pageNotFound);
  
// checkout-section
router.get("/checkout",cartController.getCheckoutpage);
router.post("/checkout",cartController. proceedToCheckout);

// order- section 
router.post("/order/place",cartController.placeOrder);
router.post('/order/create-razorpay-order', cartController.createRazorpayOrder);
router.get("/order-success",orderController.getorderSuccessPage);
router.get('/order-failure', cartController.getOrderFailurePage);
router.post('/order/retry-payment', cartController.retryPayment);
router.get("/orders",orderController.getOrders);
router.get('/order/track/:orderId', orderController.trackOrder);
router.post('/order/cancel/:orderId', orderController.cancelOrder);
router.post('/order/return/:orderId', orderController.returnOrder);
router.post('/order/return-item/:orderId/:itemId', orderController.returnItem);
 
//address -section
router.get("/address",addressController.loadAddresspage);
router.post("/address/add",addressController.addAddress);
router.patch("/address/edit/:id", addressController.editAddress);
router.delete("/address/delete/:id", addressController.deleteAddress);

// profile -section 
router.get('/profile', profileController.getUserProfile);
router.get('/edit-profile', profileController.getEditProfile);
router.post('/change-password', profileController.changePassword);
router.post("/add-password",profileController.addPassword);
router.post('/change-email', profileController.changeEmail);
router.post('/verify-email-otp', profileController.verifyEmailOtp);
router.post('/update-profile',userUpload ,profileController.updateProfile); 
router.post('/verify-phone-otp',userUpload ,profileController.verifyPhoneOtp);

//walllet management 
router.get("/wallet",walletController.getWalletPage);
router.post('/wallet/add',walletController.addAmountWallet);
router.post('/wallet/verify-payment', walletController.verifyPayment);
router.post('/wallet/payment-failure', walletController.handlePaymentFailure);



// error handler 
router.use(userErrorHandler);
module.exports = router;

