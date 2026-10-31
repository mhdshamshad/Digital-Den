const Product = require('../../model/productSchema');
const Category = require('../../model/categorySchema');
const Brand = require('../../model/brandSchema');
const  {determineStatus} = require("../../utils/helper")
const { validateProduct } = require('../../utils/validation');
const { deleteCloudinaryImage } = require('../../config/cloudinary');

const productInfo = async (req, res , next) => {
    try {
        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        const search  = req.query.search || "";
        const status = req.query.status || "All";
        const stockstatus = req.query.stockstatus ||"All";
        const categoryFilter = req.query.category || "";
        const brandFilter = req.query.brand || "";
        const page = parseInt(req.query.page) || 1 ;
        const limit = 5

        const query = { isDeleted: false };

        if (search) {
            query.productName = { $regex: search.trim(), $options: 'i' };
        }
        if (status !== "All") {
            query.isListed = status === 'Listed';
        }
        if (stockstatus !== "All") {
            if (stockstatus === "Available") {
                query.quantity = { $gt: 0 }; 
            } else if (stockstatus === "out of stock") {
                query.quantity = 0; 
            }
        }
        if(categoryFilter) {
            query.category = categoryFilter;
        }
        if (brandFilter) {
            query.brand = brandFilter; 
        }

        const productData = await Product.find(query)
            .populate("category")
            .populate("brand")
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const count = await Product.countDocuments(query);

        res.render("admin/products", { 
            productData,
            page,
            limit,
            count,
            search,
            stockstatus,
            status,
            brands,
            categories,
            category:categoryFilter,
            brand: brandFilter

        });
    } catch (error) {
      error.statusCode = 500; 
        next(error);  
    }
}

const viewProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category')
            .populate('brand');

        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        res.render('admin/viewProduct', { product });
    } catch (error) {
        console.error('Error viewing product:', error);
        res.status(500).render('error', { message: 'Server error' });
    }
};

const getEditProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category brand'); 
        const categories = await Category.find();
        const brands = await Brand.find(); 

        if (!product) {
            return res.status(404).send('Product not found');
        }

        res.render('admin/addEditProducts', {
            product,
            categories,
            brands,
            
        });
    } catch (error) {
      error.statusCode = 500; 
        next(error);
    }
};

const deleteProduct = async (req , res, next) => {
  try {
          const {id} = req.params;
          const product = await Product.findByIdAndUpdate(
              id,
              {
                  isDeleted:true,
                  isListed:false,
                  updatedAt : Date.now()
              },
              { new:true }
          );
  
          if(! product) {
              return res.status(404).json({ success: false, message: 'product not found' });
          }

          product.status = await determineStatus(product._id);
          await product.save();
  
          res.setHeader('Cache-Control', 'no-store');
          res.json({ 
              success: true, 
              message: 'Product deleted successfully',
          });
  
      } catch (error) {
        error.statusCode = 500; 
        next(error);
      }
}

const toggleProductStatus = async (req , res , next ) => {
   try {
           const id = req.params.id;
           const product = await Product.findById(id); 
   
           if (!product) {
               return res.status(404).json({ success: false, message: "Product not found" });
           }
           // Toggle Product status
           product.isListed = !product.isListed;
           await product.save();

           product.status = await determineStatus(product._id);
           await product.save();
   
           res.setHeader('Cache-Control', 'no-store');
           res.json({
               success: true,
               isListed: product.isListed,
               message: `Product status updated to ${product.isListed ? 'Listed' : 'Unlisted'}`
           });
   
       } catch (error) {
        error.statusCode = 500; 
        next(error);
       }
}

const addProduct = async (req, res) => {
    try {
      const {
        productName,
        description,
        category,
        brand,
        regularPrice,
        salePrice,
        quantity,
        specifications,
      } = req.body;
  
      // Parse specifications 
      let parsedSpecifications = [];
      if (specifications) {
        parsedSpecifications = Object.entries(specifications).map(([_, spec]) => ({
          name: spec.name,
          value: spec.value,
        }));
      }
  
      // Handle uploaded files
      const cardImageFile = req.files?.['cardImage']?.[0];
      const productImageFiles = req.files?.['productImages'] || [];
      const cardImage = cardImageFile?.path;
      const productImages = productImageFiles.map((file) => file.path);
  
      let parsedQuantity = parseInt(quantity || 0)
      const isListed = true;

      // Construct product object
      const product = {
        productName,
        description,
        category,
        brand,
        isListed,
        regularPrice: parseFloat(regularPrice || 0),
        salePrice: parseFloat(salePrice || 0),
        productOffer: parseFloat((((regularPrice - salePrice) / regularPrice) * 100 || 0).toFixed(2)),
        quantity: parsedQuantity,
        specifications: parsedSpecifications,
        cardImage,
        cardImagePublicId: cardImageFile?.publicId,
        productImages,
        productImagePublicIds: productImageFiles.map((file) => file.publicId),
      };
     
      // Validate
      const errors = await validateProduct(product);
      if (Object.keys(errors).length > 0) {
        await cleanupFiles(req.files);
        return res.status(400).json({ success: false, errors });
      }
  
      // Save to database
      const newProduct = new Product(product);
      await newProduct.save();
  
      newProduct.status = await determineStatus(newProduct._id);
      await newProduct.save();
      
      res.setHeader('Cache-Control', 'no-store');
      return res.status(201).json({
        success: true,
        message: 'Product added successfully',
        product: newProduct,
      });
    } catch (error) {
      await cleanupFiles(req.files);
      console.error('Error adding product:', error);
      return res.status(500).json({ success: false, message: 'Server error: in add product  ' + error.message });
    }
  };

  // Edit Product
const editProduct = async (req, res) => {
    try {
      const productId = req.params.id;
      const {
        productName,
        description,
        category,
        brand,
        regularPrice,
        salePrice,
        quantity,
        specifications,
        removeCardImage,
        removedImages,
      } = req.body;
  
      // existing product
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
      // Parse specifications
      let parsedSpecifications = existingProduct.specifications;
      if (specifications) {
        parsedSpecifications = Object.entries(specifications).map(([_, spec]) => ({
          name: spec.name,
          value: spec.value,
        }));
      }
  
      // Prepare image updates
      let cardImage = existingProduct.cardImage;
      let cardImagePublicId = existingProduct.cardImagePublicId;
      let productImages = [...existingProduct.productImages]; // Start with existing images
      let productImagePublicIds = [...(existingProduct.productImagePublicIds || [])];
      while (productImagePublicIds.length < productImages.length) {
        productImagePublicIds.push('');
      }
      const deletedImages = [];
  
      // Handle card image updates
      if (req.files?.['cardImage']) {
        const newCardImage = req.files['cardImage'][0];
        cardImage = newCardImage.path;
        cardImagePublicId = newCardImage.publicId;
        if (existingProduct.cardImage) {
          deletedImages.push(existingProduct.cardImagePublicId);
        }
      } else if (removeCardImage === 'true') {
        if (existingProduct.cardImage) {
          deletedImages.push(existingProduct.cardImagePublicId);
        }
        cardImage = '';
        cardImagePublicId = null;
      }
  
      // Handle product images updates
      if (req.files?.['productImages']) {
        const newImages = req.files['productImages'].map((file) => file.path);
        const newImagePublicIds = req.files['productImages'].map((file) => file.publicId);
        productImages = [...productImages, ...newImages];
        productImagePublicIds = [...productImagePublicIds, ...newImagePublicIds];
      }
  
      if (removedImages) {
        const removedIndices = Object.keys(removedImages).map((index) => parseInt(index));
        const removedIndexSet = new Set(removedIndices);
        existingProduct.productImages.forEach((image, index) => {
          if (removedIndexSet.has(index)) {
            deletedImages.push(existingProduct.productImagePublicIds?.[index]);
          }
        });
        productImages = productImages.filter((_, index) => !removedIndices.includes(index));
        productImagePublicIds = productImagePublicIds.filter((_, index) => !removedIndices.includes(index));
      }
      let parsedQuantity = parseInt(quantity || 0)
      const isListed = true;

      const updateData = {
        productName,
        description,
        category,
        brand,
        regularPrice: parseFloat(regularPrice || 0),
        salePrice: parseFloat(salePrice || 0),
        productOffer: parseFloat((((regularPrice - salePrice) / regularPrice) * 100 || 0).toFixed(2)),
        quantity:parsedQuantity ,
        isListed,
        specifications: parsedSpecifications,
        cardImage,
        cardImagePublicId,
        productImages,
        productImagePublicIds,
      };
  
      // Validate 
      const errors = await validateProduct(updateData, productId);
      if (Object.keys(errors).length > 0) {
        await cleanupFiles(req.files);
        return res.status(400).json({ success: false, errors });
      }

      if (productImages.length < 3 || productImages.length > 4) {
        await cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          errors: { productImages: 'Product images must be between 3 and 4' },
        });
      }
  
      // Update product
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        await cleanupFiles(req.files);
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      updatedProduct.status = await determineStatus(updatedProduct._id);
      await updatedProduct.save();
  
      await deleteStoredImages(deletedImages);
      
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({success: true,
        message: 'Product updated successfully',product: updatedProduct,
     });
    } catch (error) {
      await cleanupFiles(req.files);
      console.error('Error editing product:', error.stack);
      return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  };
  
// Helper function to clean
async function cleanupFiles(files) {
  if (!files) return;
  const uploadedImages = [
    ...(files['cardImage'] || []),
    ...(files['productImages'] || [])
  ];
  const results = await Promise.allSettled(
    uploadedImages.map((file) => deleteCloudinaryImage(file.publicId))
  );
  results.filter((result) => result.status === 'rejected').forEach((result) => {
    console.error('Cloudinary upload cleanup failed:', result.reason);
  });
}

async function deleteStoredImages(images) {
  const results = await Promise.allSettled(
    images.filter(Boolean).map((publicId) => deleteCloudinaryImage(publicId))
  );
  results.filter((result) => result.status === 'rejected').forEach((result) => {
    console.error('Product image cleanup failed:', result.reason);
  });
}

const getAddProductPage = async (req, res , next) => {
    try {

        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        res.render('admin/addProduct', {
            categories,
            brands,

        });
    } catch (error) {
      error.statusCode = 500; 
      next(error);
    }
};
  
const getEditProductPage = async (req, res , next) => {
    try {
        const product = await Product.findById(req.params.id)
                .populate('category')
                .populate('brand')
                .lean();

        if (!product) {
            return res.status(404).send('Product not found');
        }

        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        res.render('admin/editProduct', { product, categories, brands });
        
    } catch (error) {
      error.statusCode = 500; 
      next(error);
    }
};

module.exports = { 
    getAddProductPage, 
    productInfo,
    viewProduct,
    getEditProduct,
    deleteProduct,
    toggleProductStatus,
    addProduct,
   editProduct,
   getAddProductPage,
   getEditProductPage,
};