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

const userUpload = multer({
  storage: new CloudinaryStorage('digital-den/profileImages'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, 
}).single('profileImage'); 

module.exports = userUpload;