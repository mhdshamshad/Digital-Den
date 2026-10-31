require("dotenv").config();

const cloudinary = require("cloudinary").v2;

function getCloudinary() {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
        throw new Error("CLOUDINARY_URL is not configured");
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(cloudinaryUrl);
    } catch {
        throw new Error("CLOUDINARY_URL is invalid");
    }

    if (parsedUrl.protocol !== "cloudinary:" || !parsedUrl.hostname || !parsedUrl.username || !parsedUrl.password) {
        throw new Error("CLOUDINARY_URL must contain valid Cloudinary credentials");
    }

    cloudinary.config({
        cloud_name: parsedUrl.hostname,
        api_key: decodeURIComponent(parsedUrl.username),
        api_secret: decodeURIComponent(parsedUrl.password),
        secure: true
    });

    return cloudinary;
}

function deleteCloudinaryImage(publicId) {
    if (!publicId) {
        return Promise.resolve();
    }

    return getCloudinary().uploader.destroy(publicId, {
        invalidate: true,
        resource_type: "image"
    }).then((result) => {
        if (!["ok", "not found"].includes(result.result)) {
            throw new Error(`Cloudinary did not delete image ${publicId}`);
        }
    });
}

module.exports = { getCloudinary, deleteCloudinaryImage };
