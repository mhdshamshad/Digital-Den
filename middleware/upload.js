const multer = require('multer');
const CloudinaryStorage = require('./cloudinaryStorage');

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF, and WEBP files are allowed'), false);
  }
};

const upload = multer({
  storage: new CloudinaryStorage('digital-den/products'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, 
}).fields([
  { name: 'cardImage', maxCount: 1 },
  { name: 'productImages', maxCount: 4 },
]);

module.exports = upload;