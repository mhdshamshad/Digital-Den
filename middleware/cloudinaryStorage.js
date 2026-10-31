const { getCloudinary, deleteCloudinaryImage } = require("../config/cloudinary");

class CloudinaryStorage {
    constructor(folder) {
        this.folder = folder;
    }

    _handleFile(req, file, callback) {
        let completed = false;
        const finish = (error, result) => {
            if (completed) {
                return;
            }
            completed = true;

            if (error) {
                if (error.http_code === 403 || error.error?.http_code === 403) {
                    return callback(new Error(
                        "Cloudinary denied this upload. Ensure the configured credentials can create assets in the target folder."
                    ));
                }
                return callback(error);
            }

            callback(null, {
                filename: result.public_id,
                publicId: result.public_id,
                path: result.secure_url,
                size: result.bytes
            });
        };

        try {
            const uploadStream = getCloudinary().uploader.upload_stream(
                { folder: this.folder, resource_type: "image" },
                finish
            );
            file.stream.on("error", (error) => {
                uploadStream.destroy(error);
                finish(error);
            });
            file.stream.pipe(uploadStream);
        } catch (error) {
            finish(error);
        }
    }

    _removeFile(req, file, callback) {
        deleteCloudinaryImage(file.publicId).then(
            () => callback(null),
            callback
        );
    }
}

module.exports = CloudinaryStorage;
