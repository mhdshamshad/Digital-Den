const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../model/userSchema.js");
const { createUserWithReferral } = require("../utils/referralRewards");
const env = require("dotenv").config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0]?.value?.trim().toLowerCase();
        if (!email) {
            return done(new Error("Google account did not provide an email address"));
        }

        // find user by googleId
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
            // If no user found with googleId, check email
            user = await User.findOne({ email });
            
            if (user) {
                // If user exists with email but no googleId, update their googleId
                user.googleId = profile.id;
                await user.save();
                return done(null, user);
            }
            
            // create new one if no user exists
            user = await createUserWithReferral({
                username: profile.displayName,
                email,
                googleId: profile.id,
                isVerified: true
            }, req.session.referralCode);
        }
        
        return done(null, user);
    } catch (error) {
        console.log("Google Auth Error:", error);
        return done(error, null);
    }
}));


// Serialization and deserialization
passport.serializeUser((user, done) => {
    if (user && user.id) {
        done(null, user.id);
    } else {
        done(new Error("User object is invalid"), null);
    }
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
