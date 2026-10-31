# Digital Den

Digital Den is a server-rendered e-commerce web application for browsing and managing products, shopping carts, orders, and customer accounts. It includes customer and admin workflows backed by MongoDB.

## Features

- Customer registration, sign-in, sign-out, OTP-based account flows, password recovery, and Google sign-in.
- Product catalog with categories, brands, search/filtering, and product reviews.
- Wishlist and shopping cart management.
- Checkout, order tracking, cancellations, returns, and invoices.
- Saved addresses and customer profile management.
- Wallet, Razorpay payment support, coupons, offers, and referral features.
- Admin pages for managing customers, products, categories, brands, orders, returns, offers, coupons, sales, and dashboards.

## Technology

- Node.js and Express
- MongoDB with Mongoose
- EJS server-rendered views
- Express sessions and Passport
- Razorpay integration

This repository is a single Express application, not a microservice architecture. Routes are mounted at `/` and `/admin`; the application does not use a general `/api` prefix. Depending on the route, responses may be HTML, JSON, or redirects.

## Getting Started

### Requirements

- Node.js and npm
- MongoDB, either local or hosted

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` in the project root, then fill in the required values. Do not commit `.env` or share real credentials.
`SESSION_MAX_AGE_HOURS` controls how long a login session lasts (default: 72 hours). In production, serve the app over HTTPS so the secure session cookie can be set.

```dotenv
PORT=3000
HOST=localhost
MONGODB_URI=mongodb://127.0.0.1:27017/digital-den

# Required for email-based OTP and account messages
NODEMAILER_EMAIL=your-email@example.com
NODEMAILER_PASSWORD=your-email-app-password

# Optional: configure if enabling Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# Optional: configure with Razorpay test credentials for payment features
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Required for product and profile image uploads
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

Use the callback URL configured in your Google OAuth provider. Use Razorpay test credentials while developing. Email, Google OAuth, and Razorpay features need valid provider configuration.
Set `HOST` to the visitor-facing hostname used for referral links (not a private bind address). Referral rewards are written in a MongoDB transaction, so the database must support transactions; MongoDB Atlas does, while local MongoDB requires a replica set.

Product images are uploaded to Cloudinary under `digital-den/products`; profile images are uploaded under `digital-den/profileImages`. Keep the Cloudinary URL private and use the URL from your Cloudinary console. MongoDB stores each image's secure URL and Cloudinary public ID. The app renders these URLs directly; local `/uploads` image paths are not used as a fallback.

The Cloudinary API credentials must be permitted to create/upload and delete assets in these folders so image replacements and removals can clean up old assets. A successful account ping alone does not confirm upload permission.

For an existing database that still references local upload files, migrate them to Cloudinary by first running a dry run:

```bash
node scripts/migrateImagesToCloudinary.js
```

If the preflight reports no missing files, run the migration:

```bash
node scripts/migrateImagesToCloudinary.js --execute
```

The migration uploads referenced product and profile images to their Cloudinary folders and updates their MongoDB image URLs. Existing Google-hosted profile URLs are left unchanged.

### Start

```bash
npm start
```

The start script runs `nodemon server.js`. Open the local address using the port configured in `.env`, for example `http://localhost:3000`.

## Notes

- Postman should keep its cookie jar enabled for session-based sign-in and protected routes. The application uses Express sessions rather than JWT bearer tokens.
- The project does not include deployment or Figma design URLs. Add those links here when they are available.
- Do not publish `.env` values, payment credentials, email passwords, or OAuth secrets.
