const validator = require('validator');
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../model/userSchema");
const Coupon = require("../model/couponSchema");
const Product = require("../model/productSchema");

//product validation
async function validateProduct(product , productId) {
    let errors = {};

    // Validate productName
    if (!product.productName) {
        errors.productName = 'Product name is required';
    } else if (product.productName.length < 3 || product.productName.length > 50) {
        errors.productName = 'Product name must be 3-50 characters.';
    }else if (!/[a-zA-Z0-9]/.test(product.productName)){
        errors.productName = 'Product name must contain at least one letter or number';
    }else if (!/^[a-zA-Z0-9\s\-_.,;:!?&()'"+%]*$/.test(product.productName)){
        errors.productName = 'Product name must contain at least one letter or number';
    }else if  (/^\s+$/.test(product.productName) || /\s{3,}/.test(product.productName)){
        errors.productName = 'Product name must contain at least one letter or number';
    }else {
        if(productId){
            const existingProduct = await Product.findOne({ 
                productName: { $regex: new RegExp(`^${product.productName?.trim()}$`, 'i') },
                _id: { $ne: productId }
            });

            if(existingProduct){
              errors.productName = 'Product name already exists ...';
            }
        }else {
            const existingProduct = await Product.findOne({ 
                productName: { $regex: new RegExp(`^${product.productName}$`, 'i') },

            });

            if(existingProduct){
              errors.productName = 'Product name already exists ...';
            }
        }  
    }

    // Validate description
    if (!product.description) {
        errors.description = 'Description is required';
    } else if (product.description.length < 10 || product.description.length > 10000) {
        errors.description = 'Description must be 10-10000 characters.';
    } else if (!/[a-zA-Z0-9]/.test(product.description)) {
        errors.description = 'Description must contain actual text content';
    } else if (/(.)\1{10,}/.test(product.description)) {
        errors.description = 'Description contains excessive repetitive characters';
    }
   
    // Validate category
    if (!product.category) {
        errors.category = 'Category is required';
    } else if (!mongoose.Types.ObjectId.isValid(product.category)) {
        errors.category = 'Please enter a valid category ID.';
    }

    // Validate brand
    if (!product.brand) {
        errors.brand = 'Brand is required';
    }  else if (!mongoose.Types.ObjectId.isValid(product.brand)) {
        errors.brand = 'Please enter a valid brand ID.';
    }

    // Validate regularPrice
    if (!product.regularPrice) {
        errors.regularPrice = 'Regular price is required';
    } else if (product.regularPrice < 0) {
        errors.regularPrice = 'Regular price must be a positive number.';
    }else if( isNaN(product.regularPrice)) {
        errors.regularPrice = 'pls enter a vaild number.';
    }

    // Validate salePrice
    if (!product.salePrice) {
        errors.salePrice = 'Sale price is required';
    } else if ( product.salePrice < 0) {
        errors.salePrice = 'Sale price must be a positive number.';
    } else if (product.salePrice > product.regularPrice) {
        errors.salePrice = 'Sale price must be less than or equal to regular price.';
    }else if( isNaN(product.salePrice)) {
        errors.regularPrice = 'pls enter a valid number.';
    }

    // Validate quantity
    if (!product.quantity) {
        errors.quantity = 'Quantity is required';
    } else if (product.quantity < 0) {
        errors.quantity = 'Quantity must be a positive number.';
    } else if ( isNaN(product.quantity)) {
        errors.quantity = ' pls enter a valid Quantity ';
    }
   

    // Validate cardImage
    if (!product.cardImage && !product.cardImage.length) {
        errors.cardImage = 'Card image is required';
    }

    // Validate productImages
    if (!product.productImages || product.productImages.length < 3) {
        errors.productImages = 'Minimum 3 product images are required';
    } else if (product.productImages.length > 4) {
        errors.productImages = 'Maximum 4 product images are allowed';
    }

    // Validate specifications
    if (!product.specifications || product.specifications.length === 0) {
        errors.specifications = 'At least one specification is required';
    } else {
        product.specifications.forEach((spec, index) => {
            // Validate specification name
            if (!spec.name) {
                errors[`specifications[${index}].name`] = 'Specification name is required';
            } else if (spec.name.trim().length < 2 || spec.name.trim().length > 50) {
                errors[`specifications[${index}].name`] = 'Specification name must be 2-50 characters';
            } else if (!/^[a-zA-Z0-9\s\-_.,&()]+$/.test(spec.name)) {
                errors[`specifications[${index}].name`] = 'Specification name contains invalid characters';
            }
            
            // Validate specification value
            if (!spec.value) {
                errors[`specifications[${index}].value`] = 'Specification value is required';
            } else if (spec.value.trim().length < 1 || spec.value.trim().length > 100) {
                errors[`specifications[${index}].value`] = 'Specification value must be 1-100 characters';
            } else if (!/[a-zA-Z0-9]/.test(spec.value)) {
                errors[`specifications[${index}].value`] = 'Specification value must contain actual content';
            }
        });
    }


    return errors;
}

// address validation 
function validateAddress(address) {
    let errors = {};

    // Validate addressType
    if (!address.addressType) {
        errors.addressType = 'Address type is required';
    } else if (!['Home', 'Work', 'Other'].includes(address.addressType)) {
        errors.addressType = 'Invalid address type';
    }

    // Validate name
    if (!address.name) {
        errors.name = 'Full name is required';
    } else if (!validator.isLength(address.name, { min: 2, max: 50 })) {
        errors.name = 'Full name must be 2-50 characters';
    }else if (!validator.matches(address.name, /^(?!.*\s{3,})[a-zA-Z](?:[a-zA-Z\s.]*[a-zA-Z])?$/)) {
        errors.name = 'Full name can only contain letters, spaces, and periods, and cannot have excessive spaces';
    }

    // Validate addressLine
    if (!address.addressLine) {
        errors.addressLine = 'Address line is required';
    } else if (!validator.isLength(address.addressLine, { min: 5, max: 100 })) {
        errors.addressLine = 'Address line must be 5-100 characters';
    } else if (!validator.matches(address.addressLine, /^(?=.*[a-zA-Z0-9])(?!.*\s{3,})[a-zA-Z0-9][-.,#\/a-zA-Z0-9\s]*[a-zA-Z0-9]$/)) {
        errors.addressLine = 'Address line must contain letters or numbers without excessive spaces and can only include common symbols (-.,#/)';
    }

    // Validate city
    if (!address.city) {
        errors.city = 'City is required';
    } else if (!validator.isLength(address.city, { min: 3, max: 50 })) {
        errors.city = 'City must be 3-50 characters';
    }else if (!validator.matches(address.city, /^(?=.*[a-zA-Z])(?!.*\s{3,})[a-zA-Z][-a-zA-Z\s]*[a-zA-Z]$/)) {
        errors.city = 'City must contain letters without excessive spaces and can only include spaces and hyphens (e.g., New Delhi)';
    }

   // Validate landmark
    if (!address.landmark) {
        errors.landmark = 'Landmark is required';
    } else if (!validator.isLength(address.landmark, { min: 3, max: 50 })) {
        errors.landmark = 'Landmark must be 3-50 characters';
    } else if (!validator.matches(address.landmark, /^(?=.*[a-zA-Z0-9])(?!.*\s{3,})[a-zA-Z0-9][-.,&()a-zA-Z0-9\s]*[a-zA-Z0-9]$/)) {
        errors.landmark = 'Landmark must contain letters or numbers without excessive spaces and can only include common symbols (-.,&())';
    }

    // Validate state
    if (!address.state) {
        errors.state = 'State is required';
    }

    // Validate pincode
    if (!address.pincode) {
        errors.pincode = 'PIN code is required';
    } else if (!validator.isLength(address.pincode, { min: 6, max: 6 })) {
        errors.pincode = 'PIN code must be exactly 6 digits';
    } else if (!validator.isNumeric(address.pincode)) {
        errors.pincode = 'PIN code must contain only digits';
    }

    // Validate phone
    if (!address.phone) {
        errors.phone = 'Phone number is required';
    } else if (!validator.isLength(address.phone, { min: 10, max: 10 })) {
        errors.phone = 'Phone number must be exactly 10 digits';
    } else if (!validator.matches(address.phone, /^[6-9][0-9]{9}$/)) {
        errors.phone = 'Phone number must be a valid mobile number (starting with 6, 7, 8, or 9) ';
    }

    // Validate altPhone
    if (address.altPhone) {
        if (!validator.isLength(address.altPhone, { min: 10, max: 10 })) {
            errors.altPhone = 'Alternate phone number must be exactly 10 digits';
        } else if (!validator.matches(address.altPhone, /^[6-9][0-9]{9}$/)) {
            errors.altPhone = 'Alternate phone number must be a valid Indian mobile number (starting with 6, 7, 8, or 9)';
        }
    }

    // Validate isDefault
    if (typeof address.isDefault !== 'boolean') {
        errors.isDefault = 'isDefault must be a boolean';
    }

    return Object.keys(errors).length > 0 ? errors : null;
}

// validate password 
async function validatePassword(user, data, isChangePassword ) {
    let errors = {};

    if (isChangePassword && user.password) {
        if (!data.currentPassword) {
            errors.currentPassword = 'Current password is required';
        } else if (!await bcrypt.compare(data.currentPassword, user.password)) {
            errors.currentPassword = 'Current password is incorrect';
        }
    }

    if (!data.password) {
        errors.password = 'password is required';
    } else if (!validator.isLength(data.password, { min: 8 })) {
        errors.password = 'Password must be at least 8 characters';
    } else if (!validator.isStrongPassword(data.password)) {
        errors.password = 'Password must include uppercase, lowercase, and a number';
    }

    if (!data.cPassword) {
        errors.cPassword = 'Please confirm your new password';
    }else if (data.password !== data.cPassword) {
        errors.cPassword = 'Passwords do not match';
    }

    return Object.keys(errors).length > 0 ? errors : null;
}

async function validateEmail (user,data) {
    const errors = {};

    if(! data.password ){
        errors.password = "Current Password is required ";
    } else if (!await bcrypt.compare(data.password, user.password)) {
        errors.password = 'Incorrect Password ';    
    }

    if(!data.email ) {
        errors.email = "email is required ";
    }else if(!validator.isEmail(data.email)) {
        errors.email = "Please enter a valid Email";
    } else {
        const existingUser = await User.findOne({ email: data.email, _id: { $ne: user._id } });
        if (existingUser) {
            errors.email = 'Email is already in use';
        }
    }

    return Object.keys(errors).length > 0 ? errors : null;
}

function validateCancelOrder(data) {
    let errors = {};

    // Validate cancellation reason
    if (!data.reason) {
        errors.reason = 'Cancellation reason is required';
    } else if (!['changed_mind', 'wrong_item', 'Other'].includes(data.reason)) {
        errors.reason = 'Invalid cancellation reason';
    }

    // Validate additional comments  
    if (data.comments) {
        if (data.comments.length < 10) {
            errors.comments = 'Additional comments must be at least 10 characters long';
        } else if (data.comments.length > 1000) {
            errors.comments = 'Additional comments cannot exceed 1000 characters';
        } else if (!/[a-zA-Z0-9]/.test(data.comments)) {
            errors.comments = 'Additional comments must contain actual text content';
        }
    }
    

    return Object.keys(errors).length > 0 ? errors : null;

}

// user-profile 
async function validateUserProfile(user) {
    let errors = {};

    if (!user.username) {
        errors.username = 'Username is required';
    } else if (!validator.isAlphanumeric(user.username.replace(/\s/g, ''))) {
        errors.username = 'Please enter a valid Username';
    }
    
    if(user.phone){
        if (!validator.isMobilePhone(user.phone, 'any')) {
            errors.phone = 'Invalid phone number format';
        } else if (user.phone) {
            const existingUser = await User.findOne({ phone: user.phone, _id: { $ne: user._id } });
            console.log("existing user:",existingUser);
            if (existingUser) {
                errors.phone = 'Phone number is already in use';
            }
        }
    }
   

    // First name 
    if (user.firstName) {
        if (!validator.isAlpha(user.firstName.replace(/\s/g, ''))) {
            errors.firstName = 'First name should only contain letters';
        } else if (user.firstName.length < 3 || user.firstName.length > 20) {
            errors.firstName = 'First name must be 3-20 characters';
        }
    }

    // Last name 
    if (user.lastName) {
        if (!validator.isAlpha(user.lastName.replace(/\s/g, ''))) {
            errors.lastName = 'Last name should only contain letters';
        } else if (user.lastName.length < 3 || user.lastName.length > 20) {
            errors.firstName = 'First name must be 3-20 characters';
        }
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

// coupon Function
async function validateCoupon(coupon,couponId = null) {
    let errors = {};

    if (!coupon.code) {
        errors.code = 'Coupon code is required';
    } else if (!validator.isLength(coupon.code, { min: 4, max: 10 })) {
        errors.code = 'Coupon code must be 4-10 characters';
    } else if (!validator.matches(coupon.code, /^[A-Z0-9]+$/)) {
        errors.code = 'Coupon code must be alphanumeric and uppercase';
    }else{
        const query = { code: coupon.code };
        if (couponId) {
            query._id = { $ne: couponId };
        } 
        const existingCoupon = await Coupon.findOne(query);
        if (existingCoupon) {
            errors.code = 'Coupon code already exists';
        }
    }

    if (!coupon.type || !['Percentage', 'Fixed'].includes(coupon.type)) {
        errors.type = 'Discount type must be Percentage or Fixed';
    }

    if (!coupon.minPurchase ) {
        errors.minPurchase = 'Minimum purchase amount is required';
    } else if (!validator.isNumeric(coupon.minPurchase.toString()) || parseFloat(coupon.minPurchase) < 0) {
        errors.minPurchase = 'Minimum purchase must be a non-negative integer';
    }


    if (!coupon.discount) {
        errors.discount = 'Discount value is required';
    } else if (!validator.isInt(coupon.discount.toString(), { min: 1 })) {
        errors.discount = 'Discount must be a positive integer';
    } else if (coupon.type === 'Percentage' && coupon.discount > 30) {
        errors.discount = 'Percentage discount cannot exceed 30%';
    }else if (coupon.type === 'Fixed' && coupon.minPurchase ) {
        if (!errors.minPurchase) {
            const maxAllowedDiscount = parseFloat(coupon.minPurchase) * 0.3;
            if (parseFloat(coupon.discount) > maxAllowedDiscount) {
                errors.discount = `Fixed discount cannot exceed 30% of minimum purchase amount (${maxAllowedDiscount.toFixed(2)})`;
            }
        }
    };

    if (coupon.maxDiscount) {
        if (!validator.isInt(coupon.maxDiscount.toString(), { min: 0 })) {
            errors.maxDiscount = 'Maximum discount must be a non-negative integer';
        } else if ( coupon.discount > coupon.maxDiscount) {
                errors.maxDiscount = 'Maximum discount cannot be low that discount amount';
        }else if(coupon.minPurchase){
            const maxAllowed = coupon.minPurchase * 0.3;
            if (coupon.maxDiscount > maxAllowed) {
                errors.maxDiscount = 'Maximum discount cannot exceed 30% of minimum purchase amount';
            }
        }   
    }

    if (!coupon.expireOn) {
        errors.expireOn = 'Expiry date is required';
    } else if (new Date(coupon.expireOn) <= new Date()) {
        errors.expireOn = 'Expiry date must be a valid future date';
    }

    return Object.keys(errors).length > 0 ? errors : null;
};

function validateOffer(data) {
    const errors = {};
  
    // Name validation
    const nameRegex = /^[\w\s@#$%^&*()+=[\]{}|;:,.<>?-]{3,100}$/;
    if (!data.name) {
      errors.name = 'Name is required';
    }else if (data.name.length < 3 || data.name.length > 25) {
        errors.name = 'Name must be 3-25 characters';
    } else if (!nameRegex.test(data.name)) {
      errors.name = 'Name contains invalid characters';
    }
  
    // Description validation
    const descRegex = /^[\w\s@#$%^&*()+=[\]{}|;:,.<>?-]{10,4000}$/;
    if (!data.description) {
      errors.description = 'Description is required';
    } else if (data.description.length < 10 || data.description.length > 4000) {
        errors.description = 'Description must be 10-5000 characters';
    } else if (!descRegex.test(data.description)) {
      errors.description = 'Description contains invalid characters';
    }
  
    // Discount type
    if (!data.type) {
      errors.type = 'Discount type is required';
    } else if (!['Percentage', 'Fixed'].includes(data.type)) {
      errors.type = 'Discount type must be Percentage or Fixed';
    }
  
    // Discount value
    if (data.discount === undefined || data.discount === '') {
      errors.discount = 'Discount value is required';
    } else if (!Number.isFinite(Number(data.discount))) {
      errors.discount = 'Discount must be a valid number';
    } else if (Number(data.discount) <= 0) {
      errors.discount = 'Discount must be greater than 0';
    } else if (data.type === 'Percentage' && Number(data.discount) > 50) {
      errors.discount = 'Percentage discount cannot exceed 50';
    } else if (Number(data.discount) % 1 !== 0) {
      errors.discount = 'Discount must be a whole number';
    }
  
    // Dates
    if (!data.startDate) {
      errors.startDate = 'Start date is required';
    }
    if (!data.endDate) {
      errors.endDate = 'End date is required';
    }
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
  
      if (isNaN(start.getTime())) {
        errors.startDate = 'Invalid start date format';
      }
      if (isNaN(end.getTime())) {
        errors.endDate = 'Invalid end date format';
      }
      if (!errors.startDate && !errors.endDate) {
        if (start >= end) {
          errors.endDate = 'End date must be after start date';
        }
        if (start < now) {
          errors.startDate = 'Start date cannot be in the past';
        }
        // Ensure offer duration is reasonable (e.g., max 1 year)
        const oneYearFromStart = new Date(start);
        oneYearFromStart.setFullYear(start.getFullYear() + 1);
        if (end > oneYearFromStart) {
          errors.endDate = 'Offer duration cannot exceed one year';
        }
      }
    }
  
    // Applied on
    if (!data.appliedOn) {
      errors.appliedOn = 'Please select where to apply the offer';
    } else if (!['category', 'brand', 'product'].includes(data.appliedOn)) {
      errors.appliedOn = 'Invalid offer target (must be Category, Brand, or Product)';
    }
  
    // Specific appliedOn conditions
    if (data.appliedOn === 'category') {
      if (!Array.isArray(data.categories) || data.categories.length === 0) {
        errors.appliedOn = 'At least one category must be selected';
      }
    }else if (data.appliedOn === 'brand') {
      if (!Array.isArray(data.brands) || data.brands.length === 0) {
        errors.appliedOn = 'At least one brand must be selected';
      }
    }else if (data.appliedOn === 'product') {
        if (!Boolean(data.allProducts) && (!Array.isArray(data.products) || data.products.length === 0)) {
            errors.appliedOn = 'Select specific products or choose All Products';
        }
          
    }
  
    return Object.keys(errors).length > 0 ? errors : null;
};


function validateReviewForm(data) {
    const errors = {};

    // Rating (must be between 1 to 5)
    if (!data.rating || isNaN(data.rating)) {
        errors.rating = "Please select a rating.";
    } else if (data.rating < 1 || data.rating > 5) {
        errors.rating = "Rating must be between 1 and 5 stars.";
    }

    // Review Title
    if (!data.reviewTitle) {
        errors.reviewTitle = "Review title is required.";
    } else if (data.reviewTitle.length < 5 || data.reviewTitle.length > 100) {
        errors.reviewTitle = "Title must be between 5 and 100 characters.";
    } else if (!/^[a-zA-Z0-9\s.,!?'"-]+$/.test(data.reviewTitle)) {
        errors.reviewTitle = "Title contains invalid characters.";
    }

    // Review Text / Message
    const hasMeaningfulText = /[a-zA-Z]/;
    if (!data.reviewText) {
        errors.reviewText = "Review content is required.";
    } else if (data.reviewText.length < 20 || data.reviewText.length > 3000) {
        errors.reviewText = "Review must be between 20 and 3000 characters.";
    } else if (!hasMeaningfulText.test(data.reviewText)) {
        errors.reviewText = "Review must include meaningful content (not just symbols).";
    }

    return Object.keys(errors).length > 0 ? errors : null;
};

module.exports = { 
    validateProduct,
    validateAddress ,
    validateCancelOrder,
    validatePassword,
    validateEmail,
    validateCoupon,
    validateUserProfile,
    validateOffer,
    validateReviewForm
};