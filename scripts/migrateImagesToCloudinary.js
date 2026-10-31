require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
const Product = require("../model/productSchema");
const User = require("../model/userSchema");
const { getCloudinary } = require("../config/cloudinary");

const execute = process.argv.includes("--execute");
const productDirectory = path.join(__dirname, "../public/uploads/products");
const profileDirectory = path.join(__dirname, "../public/uploads/user/profileimages");
const uploadedImages = new Map();

function isRemoteImage(image) {
    return /^https?:\/\//i.test(image);
}

function cloudinaryPublicId(folder, filename) {
    const hash = crypto.createHash("sha256").update(`${folder}/${filename}`).digest("hex").slice(0, 12);
    const name = path.parse(filename).name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
    return `legacy-${name || "image"}-${hash}`;
}

async function findMissingImages(products, users) {
    const missing = new Set();
    const uniqueImages = new Set();
    const collect = async (image, directory) => {
        if (!image || isRemoteImage(image)) {
            return;
        }
        if (path.basename(image) !== image) {
            throw new Error("A stored image has an unexpected local path; migration was stopped.");
        }
        const source = path.join(directory, image);
        uniqueImages.add(source);
        try {
            await fs.access(source);
        } catch {
            missing.add(source);
        }
    };

    for (const product of products) {
        await collect(product.cardImage, productDirectory);
        for (const image of product.productImages || []) {
            await collect(image, productDirectory);
        }
    }
    for (const user of users) {
        await collect(user.profileImage, profileDirectory);
    }

    return { missing, uniqueImages };
}

async function uploadLocalImage(image, directory, folder) {
    if (!image || isRemoteImage(image)) {
        return { url: image, publicId: null };
    }

    const cacheKey = `${folder}/${image}`;
    if (uploadedImages.has(cacheKey)) {
        return uploadedImages.get(cacheKey);
    }

    const publicId = cloudinaryPublicId(folder, image);
    const result = await getCloudinary().uploader.upload(path.join(directory, image), {
        folder,
        overwrite: true,
        public_id: publicId,
        resource_type: "image"
    });
    const uploaded = { url: result.secure_url, publicId: result.public_id };
    uploadedImages.set(cacheKey, uploaded);
    return uploaded;
}

async function migrateProducts(products) {
    for (const product of products) {
        const cardImage = await uploadLocalImage(product.cardImage, productDirectory, "digital-den/products");
        const productImages = [];
        const productImagePublicIds = [];
        for (let index = 0; index < (product.productImages || []).length; index += 1) {
            const image = product.productImages[index];
            const migrated = await uploadLocalImage(image, productDirectory, "digital-den/products");
            productImages.push(migrated.url);
            productImagePublicIds.push(
                migrated.publicId || product.productImagePublicIds?.[index] || ""
            );
        }
        const cardImagePublicId = cardImage.publicId || product.cardImagePublicId;
        const changed = cardImage.url !== product.cardImage
            || cardImagePublicId !== product.cardImagePublicId
            || productImages.some((image, index) => image !== product.productImages[index])
            || productImagePublicIds.some((id, index) => id !== product.productImagePublicIds?.[index]);

        if (changed) {
            await Product.updateOne({ _id: product._id }, {
                $set: {
                    cardImage: cardImage.url,
                    cardImagePublicId,
                    productImages,
                    productImagePublicIds
                }
            });
        }
    }
}

async function migrateProfileImages(users) {
    for (const user of users) {
        const profileImage = await uploadLocalImage(
            user.profileImage,
            profileDirectory,
            "digital-den/profileImages"
        );
        if (profileImage.url !== user.profileImage || profileImage.publicId !== user.profileImagePublicId) {
            await User.updateOne({ _id: user._id }, {
                $set: {
                    profileImage: profileImage.url,
                    profileImagePublicId: profileImage.publicId || user.profileImagePublicId
                }
            });
        }
    }
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured");
    }

    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const [products, users] = await Promise.all([
        Product.find({}).select("cardImage cardImagePublicId productImages productImagePublicIds").lean(),
        User.find({ profileImage: { $type: "string", $ne: "" } })
            .select("profileImage profileImagePublicId")
            .lean()
    ]);
    const { missing, uniqueImages } = await findMissingImages(products, users);

    console.log(JSON.stringify({
        mode: execute ? "execute" : "dry-run",
        productsChecked: products.length,
        usersWithProfileImagesChecked: users.length,
        uniqueLocalImages: uniqueImages.size,
        missingLocalImages: missing.size,
        cloudinaryFolders: ["digital-den/products", "digital-den/profileImages"]
    }, null, 2));

    if (missing.size) {
        throw new Error(`${missing.size} referenced local image(s) are missing; fix these files before migrating.`);
    }
    if (!execute) {
        console.log("No changes were made. Run this script with --execute to migrate the images.");
        return;
    }

    await migrateProducts(products);
    await migrateProfileImages(users);
    console.log(JSON.stringify({
        migratedUniqueImages: uploadedImages.size,
        productImagesFolder: "digital-den/products",
        profileImagesFolder: "digital-den/profileImages"
    }, null, 2));
}

main()
    .catch((error) => {
        const status = error.http_code || error.error?.http_code;
        if (status === 403) {
            console.error(
                "Image migration failed: Cloudinary denied asset creation. Update the API credentials in .env so they can create assets in the target folders, then retry with --execute."
            );
        } else {
            console.error(`Image migration failed: ${error.message}`);
        }
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });
