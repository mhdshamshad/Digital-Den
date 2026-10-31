const User = require('../../model/userSchema');
const bcrypt = require('bcrypt');
const {validatePassword, validateEmail ,validateUserProfile} = require("../../utils/validation");
const {generateOtp} = require("../../utils/helper");
const Wallet = require("../../model/walletSchema");
const {sendProfileUpdateOtp} = require("../../utils/userEmails");
const Product = require('../../model/productSchema');
const { deleteCloudinaryImage } = require('../../config/cloudinary');
const { getSiteBaseUrl } = require('../../utils/siteUrl');


const getUserProfile = async (req, res) => {
    try {
        const {userData} = res.locals 
  
        if (!userData) {
            return res.status(401).json({ success: false, message: "Please login to view Profile.",redirectUrl:"/signin" });
        }  
        
        const user = await User.findById(userData._id)
             .populate('redeemedUsers');

        const totalReferrals = user?.redeemedUsers?.length || 0 ;

        res.render('profile', { user, totalReferrals, siteBaseUrl: getSiteBaseUrl() });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).render('error', { message: 'Server error' });
    }
};

const getEditProfile = async (req, res) => {
    try {
        const user = res.locals.userData;
        const formData = req.session.formData || {};
        delete req.session.formData; 
        res.render('edit-profile', { user, errors: {}, otpSent: false, phoneOtpSent: false, formData });
    } catch (error) {
        console.error('Error fetching edit profile:', error);
        res.status(500).render('error', { message: 'Server error' });
    }
};

const addPassword = async (req , res , next) => {
    try {
        const user = await User.findById(res.locals.userData);
        if (!user) {
            return res.status(403).json({
                message: "User not found with this ID",redirectUrl: '/signin'
            });
        }
        const data = {
            password : req.body.password,
            cPassword:req.body.cPassword
        }

        const errors = await  validatePassword(user, data, false);

        if (errors) {
            return res.status(400).json({ success: false, errors});
        }

        const hashPassword  = await bcrypt.hash(data.password , 10);

        if(!hashPassword){
            res.status(500).json({success:false , message:'an error found why harshing password , pls try again later .'})
        }

        user.password = hashPassword;
        await user.save();

       res.status(200).json({success:true , message: "Password added succesfully .." });
        
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

const changePassword = async (req,res , next) => {
    try {

        const  {googleIdUser ,userData, isUserBlocked}  = res.locals;
        const data =  {
            currentPassword: req.body.currentPassword,
            password:req.body.password, 
            cPassword:req.body.cPassword 
        }

        const user = await User.findById(userData._id);
        if(!user) {
            return res.status(403).json({ message: "User not found with this ID",redirectUrl: '/login'});
        };

        const errors = await  validatePassword(user, data, true);
        if (errors) {
            return res.status(400).json({ success: false, errors});
        }

        const hashPassword  = await bcrypt.hash(data.password , 10);
        if(!hashPassword){
            res.status(500).json({success:false , message:'an error found why harshing password , pls try again later .'})
        }

        user.password = hashPassword;

        await user.save();
        res.json({success:true ,message:"success"})
        
    } catch (error) {
        error.statusCode = 500; 
        next(error); 
    }
}

const changeEmail = async (req , res , next) => {
    try {
        const {userData} = res.locals;
        const {password , email } = req.body ;
        console.log(password , email)

        const user = await User.findById(userData._id);
        if(!user) {
            return res.status(403).json({ message: "User not found with this ID"});
        };

        let errors = await validateEmail(user,{password ,email});
        if (errors) {
            return res.status(400).json({ success: false, errors});
        }

        const otp = generateOtp();

        req.session.otp = otp;
        req.session.email = email;
        await user.save();
        console.log("otp:",otp)

        const emailSent = await sendProfileUpdateOtp(user.username ,email,otp);
        if (!emailSent) {
            return res.status(500).json({success: false,
                message: 'Failed to send OTP. Please try again later.'
            });
        };

        console.log("email sent successfully ")
        res.status(200).json({success:true, message:"OTP sent to new email. Please verify "});

    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
}

const verifyEmailOtp = async (req , res , next) => {
    try {
        const {userData} = res.locals;
        const {otp } = req.body ;

        console.log("otp :",otp)
        const user = await User.findById(userData._id);
        if(!user) {
            return res.status(403).json({ message: "User not found"});
        };
        
        const errors = {};
        if (!otp) {
            errors.otp = "Please enter OTP";
        } else if (otp.length !== 6) {
            errors.otp = "OTP must be 6 digits";
        } else if (otp !== req.session.otp) {
            errors.otp = "Invalid OTP";
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        user.email = req.session.email;

        // Clear session temp data
        delete req.session.email;
        delete req.session.otp;
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: "Email updated successfully"
        });

    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
}

const updateProfile = async (req, res) => {
    let uploadedImagePublicId;
    try {
        const user = await User.findById(res.locals.userData._id); 
        if (!user) {
            if (req.file?.publicId) {
                await deleteCloudinaryImage(req.file.publicId);
            }
            return res.status(403).json({ success: false, message: 'User not found' });
        }
        const { firstName, lastName, username, phone, removePhoto } = req.body;
      
        const updateData = {
            firstName,
            lastName,
            username,
            phone
        };
      
        let oldProfileImage;
        if (req.file) {
            uploadedImagePublicId = req.file.publicId;
            oldProfileImage = user.profileImagePublicId;
            updateData.profileImage = req.file.path;
            updateData.profileImagePublicId = req.file.publicId;
        } else if (removePhoto === 'true') {
            oldProfileImage = user.profileImagePublicId;
            updateData.profileImage = null;
            updateData.profileImagePublicId = null;
        }
  
        const errors = await validateUserProfile(updateData); 
        if (errors) {
            await cleanupProfileUpload(uploadedImagePublicId);
            return res.status(400).json({ success: false, errors });
        }

        delete updateData.phone;
        Object.assign(user, updateData);
  
        //  phone verification 
        if (phone && phone !== user.phone) {

            const otp = generateOtp();
            
            // Store OTP and phone in session
            req.session.phoneOtp = otp;
            req.session.tempPhone = phone;

            console.log('Generated OTP:', otp, 'for phone:', phone); 
            //mail
            const emailSent = await sendProfileUpdateOtp(user.username, user.email, otp);
            if (!emailSent) {
                await cleanupProfileUpload(uploadedImagePublicId);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP. Please try again later.',
                });
            }

            await user.save();
            await deleteProfileImage(oldProfileImage);
            uploadedImagePublicId = null;
            return res.status(200).json({ 
                success: true, 
                message: 'OTP sent to email for phone verification',
                requireOtp: true
            });
        }

        await user.save();
        await deleteProfileImage(oldProfileImage);
        uploadedImagePublicId = null;
        return res.status(200).json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        await cleanupProfileUpload(uploadedImagePublicId);
        console.error('Profile update error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

async function cleanupProfileUpload(publicId) {
    if (!publicId) {
        return;
    }
    try {
        await deleteCloudinaryImage(publicId);
    } catch (error) {
        console.error('Cloudinary profile image cleanup failed:', error);
    }
}

async function deleteProfileImage(profileImage) {
    if (!profileImage) {
        return;
    }
    try {
        await deleteCloudinaryImage(profileImage);
    } catch (error) {
        console.error('Profile image cleanup failed:', error);
    }
}

const verifyPhoneOtp = async (req, res , next) => {
    try {
        const { userData } = res.locals;
        const { phoneOtp } = req.body;

        const user = await User.findById(userData._id);
        if (!user) {
            return res.status(403).json({ success: false, message: 'User not found' });
        }
  
        // Validate otp
        const errors = {};
        if (!phoneOtp) {
            errors.phoneOtp = 'Please enter OTP';
        } else if (!req.session.phoneOtp) {
            errors.phoneOtp = 'OTP session expired. Please request a new OTP';
        } else if (phoneOtp !== req.session.phoneOtp) {
            errors.phoneOtp = 'Invalid OTP';
        }
  
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ success: false, errors });
        }
  
        // Update phone and save
        user.phone = req.session.tempPhone;
        
        // clear session data
        delete req.session.phoneOtp;
        delete req.session.tempPhone;
        
        await user.save();
   
        return res.status(200).json({ 
            success: true, 
            message: 'Phone number updated successfully'
        });
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};


const getAboutUsPage = async (req , res , next ) => {
    try {

        // Total Customers & products
        const totalCustomers = await User.countDocuments({ isAdmin: false, isBlocked: false });
        const totalProducts = await Product.countDocuments({ isListed: true, isDeleted: false });
        const totalBrands = await Product.countDocuments({ isListed: true, isDeleted: false });
        const startYear = 2025; 
        const currentYear = new Date().getFullYear();
        const yearsInBusiness = currentYear - startYear;

        res.render("aboutUs",{
            totalCustomers,
            totalProducts,
            totalBrands,
            yearsInBusiness
        });

    } catch (error) {
        error.statusCode = 500; 
        next(error);  
    }
};

const getContactUsPage = async (req , res , next ) => {
    try {
        res.render("contact")
    } catch (error) {
        error.statusCode = 500; 
        next(error);  
    }
}


module.exports = { 
    getUserProfile, 
    getEditProfile,
    changePassword,
    addPassword,
    changeEmail,
    verifyEmailOtp,
    updateProfile,
    verifyPhoneOtp,
    getAboutUsPage,
    getContactUsPage

};