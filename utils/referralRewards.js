const mongoose = require("mongoose");
const User = require("../model/userSchema");
const Wallet = require("../model/walletSchema");

const REFERRER_REWARD = 200;
const REFEREE_REWARD = 100;

async function addReferralReward(walletUserId, amount, description, session) {
    await Wallet.findOneAndUpdate(
        { userId: walletUserId },
        {
            $inc: { balance: amount },
            $push: {
                transactions: {
                    amount,
                    type: "Credit",
                    method: "Referral",
                    status: "Completed",
                    description,
                    date: new Date()
                }
            },
            $setOnInsert: { userId: walletUserId }
        },
        { upsert: true, new: true, session }
    );
}

async function createUserWithReferral(userData, referralCode) {
    const normalizedCode = typeof referralCode === "string"
        ? referralCode.trim().toUpperCase()
        : "";

    if (!normalizedCode) {
        const user = new User(userData);
        await user.save();
        return user;
    }

    const session = await mongoose.startSession();
    let createdUser;

    try {
        await session.withTransaction(async () => {
            const referrer = await User.findOne({
                referralCode: normalizedCode,
                isAdmin: false
            }).session(session);

            if (!referrer) {
                throw new Error("Referral code is invalid or no longer active");
            }

            if (referrer.email.toLowerCase() === userData.email.toLowerCase()) {
                throw new Error("You cannot use your own referral code");
            }

            const [newUser] = await User.create([{
                ...userData,
                referredBy: referrer._id
            }], { session });
            createdUser = newUser;

            const referralUpdate = await User.updateOne(
                { _id: referrer._id },
                { $addToSet: { redeemedUsers: newUser._id } },
                { session }
            );

            if (referralUpdate.matchedCount !== 1) {
                throw new Error("Unable to record referral");
            }

            await addReferralReward(
                referrer._id,
                REFERRER_REWARD,
                `Referral reward for ${newUser.username}`,
                session
            );
            await addReferralReward(
                newUser._id,
                REFEREE_REWARD,
                "Welcome reward for using referral code",
                session
            );
        });

        return createdUser;
    } finally {
        await session.endSession();
    }
}

module.exports = {
    createUserWithReferral,
    REFERRER_REWARD,
    REFEREE_REWARD
};
