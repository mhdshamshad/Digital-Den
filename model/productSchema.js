const mongoose = require("mongoose");
const {Schema} = mongoose;

const productSchema = new Schema({
    productName:{
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    category:{
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    brand:{          
        type: Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },         
    ratingsSummary: {   
        averageRating: {
            type: Number,
            default: 0
        },
        totalReviews: {
            type: Number,
            default: 0
        },
        ratingCounts: {
            5: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            1: { type: Number, default: 0 }
        }
    },
    rating:{
        type:Schema.Types.ObjectId,
        ref:"Review",
        required:false

    },   
    regularPrice:{
        type: Number,
        required: true
    },
    salePrice:{
        type: Number,
        required: true
    },
    productOffer:{
        type: Number,
        default: 0
    },
    quantity:{
        type: Number,
        required: true
    },
    isDeleted:{
        type: Boolean,
        default: false
    },
    cardImage: { 
        type: String, 
        required: true 
    },
    cardImagePublicId: {
        type: String
    },
    productImages: { 
        type: [String], 
        required: true 
    },
    productImagePublicIds: {
        type: [String],
        default: []
    },
    isListed: {
        type: Boolean,
        default: true
    },
    specifications: [{
        name: { type: String, required: true },
        value: { type: String, required: true }
    }],
    status:{
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"],
        required: true,
        default: "Available"
    }
}, {timestamps: true});

// Virtual for getting all reviews
productSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'productID'
});

module.exports = mongoose.model("Product", productSchema);