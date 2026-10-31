const mongoose = require("mongoose");
const {Schema} = mongoose;

const userSchema = new Schema({
    username : {
        type:String,
        required:true
    },
    firstName : {
        type:String,
        required:false
    },
    lastName : {
        type:String,
        required:false
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true
    },
    phone:{
        type:String,
        required: false,
        unique:true,      
        sparse:true,
        
    },
    googleId:{
        type:String,
        unique:true,
        sparse: true 
    },
    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    } ,
    isAdmin:{
        type:Boolean,
        default:false
    },
    profileImage: {
         type: String,
         required: false
    },    
    profileImagePublicId: {
        type: String,
        required: false
    },
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order",
        default: [],
    }],
    referralCode: {
        type: String,
        unique: true,
        sparse: true
        // required: true
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        default: []
    }]
},
{ timestamps: true })

userSchema.pre('save', function(next) {
    if (!this.referralCode) {
        const usernamePrefix = this.username.slice(0, 2).toUpperCase();
        const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase(); 
        this.referralCode = `${usernamePrefix}${randomChars}`;
    }
    next();
});

module.exports = mongoose.model("User",userSchema);



