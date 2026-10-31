const User = require("../model/userSchema");

const checkBlockedStatus = async (req, res, next) => {
    try {

      res.locals.googleIdUser = null;
      
      if(!req.session.user && !req.isAuthenticated()){
        res.locals.isLoggedIn = false
        return next();
      }

      let userId;

      if (req.isAuthenticated() && req.user) {
          // (e.g., Google OAuth)
          userId = req.user._id;
      } else if (req.session.user) {
          // User is authenticated via session
          userId = req.session.user;
      }

      if (!userId) {
        res.locals.isLoggedIn = false;
        return next();
      }

      const user = await User.findOne({_id: userId});

      if (!user) {
        res.locals.isLoggedIn = false;
        return next();
      }

      res.locals.userData = user;
      res.locals.isLoggedIn = true;
      res.locals.isUserBlocked = user.isBlocked;

      if (user.googleId) {
          res.locals.googleIdUser = user.googleId;
      }
      next();
      
    } catch (error) {

      console.error("Error in checkBlockedStatus middleware:", error);
      res.locals.isLoggedIn = false;
      res.locals.isUserBlocked = false;
      res.locals.googleIdUser = null;
      next();
    }
}
// middleware/authMiddleware.js
  
const checkUserLoggedIn = (req, res, next) => {
    if (!res.locals.isLoggedIn || !res.locals.userData) {
        if (req.xhr || req.headers['content-type'] === 'application/json') {
          return res.status(401).json({ success: false, message:"Session data is expired..." ,redirect: '/signin?showAlert=true' });
        }
        return res.redirect('/signin?showAlert=true');
    }

  if (res.locals.isUserBlocked) {
      console.log('User is blocked');
      if (req.method === 'GET') {
          return next();
      }
      if (req.xhr || req.headers['content-type'] === 'application/json') {
          return res.status(400).json({ success: false, message: 'User is blocked, cannot take actions..' });
      }
     
      return res.json({ success: false, message: 'User is blocked, cannot take actions' });
  }

  next();
};



const checkSignupSession = (req, res, next) => {
  if (!req.session.userData || !req.session.userOtp) {
      return res.status(400).json({
          success: false,
          message: "Session data missing. Please start signup process again.",
          redirectUrl: "/signup"
      });
  }
  next();
};

const restrictBlockedUsers = (req, res, next) => {
  if (res.locals.isUserBlocked) {
      return res.status(403).json({ message: "Account is blocked. Contact support." });
  }
  next();
};










// const checkBlockedStatus = (req, res, next) => {
//     // Add debugging
//     console.log("Checking blocked status...");
//     console.log("User session:", req.session.user ? "exists" : "none");
//     console.log("Is authenticated:", req.isAuthenticated ? req.isAuthenticated() : "method not available");
    
//     // Skip check if user is not logged in
//     if (!req.session.user && !req.isAuthenticated()) {
//       console.log("User not logged in, skipping check");
//       return next();
//     }
  
//     // Check if user is blocked
//     let isBlocked = false;
    
//     if (req.user && req.user.isBlocked) {
//       console.log("User is blocked via req.user");
//       isBlocked = true;
//     } else if (req.session.user && req.session.userData && req.session.userData.isBlocked) {
//       console.log("User is blocked via session data");
//       isBlocked = true;
//     }
    
//     console.log("Is user blocked:", isBlocked);
    
//     // Make blocked status available to templates
//     res.locals.isUserBlocked = isBlocked;
    
//     // Set a session flag if this is the first time we're detecting a blocked user
//     if (isBlocked && !req.session.blockedNotificationShown) {
//       console.log("Setting notification flag to true");
//       res.locals.showBlockedNotification = true;
//       req.session.blockedNotificationShown = true;
//     } else {
//       console.log("Notification already shown or user not blocked");
//     }
    
//     next();
//   };
  
//   // More restrictive middleware for action routes
//   const blockActionForBlockedUsers = (req, res, next) => {
//     if (res.locals.isUserBlocked) {
//       // If it's an AJAX request, return JSON
//       if (req.xhr || req.headers.accept.indexOf('json') > -1) {
//         return res.status(403).json({
//           status: 'error',
//           blocked: true,
//           message: 'Your account is blocked. Please contact customer support.'
//         });
//       } 
//       // For regular requests, redirect with a message
//       else {
//         req.session.blockedMessage = "Your account is blocked. You cannot perform this action.";
//         return res.redirect('back');
//       }
//     }
//     next();
//   };
  
  module.exports = { 
      checkBlockedStatus,
      checkSignupSession,
      restrictBlockedUsers,
      checkUserLoggedIn

  };