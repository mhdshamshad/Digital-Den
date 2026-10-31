const User = require("../../model/userSchema");
const Order  = require("../../model/orderSchema"); 
const ReturnRequest = require("../../model/returnRequestModel"); 
const Wallet = require("../../model/walletSchema");
const Coupon = require("../../model/couponSchema");
const Product = require("../../model/productSchema");
const {validateCancelOrder } = require("../../utils/validation");
const  { generateCustomId }= require("../../utils/helper"); 

const getOrderSuccessPage = async (req, res , next) => {
    const { userData } = res.locals;
    const { orderId } = req.session; 
    try {
        const order = await Order.findOne({ orderId, userId: userData._id })
            .populate('orderedItems.product');
        if (!order) {
            return res.redirect('/orders');
        }
        res.render('order-success', { order });
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

const getOrders = async (req, res , next) => {
    const { userData } = res.locals;

    try {
        // Fetch the user
        const user = await User.findById(userData);
        if (!user) {
            console.error("User not found for ID:", userData._id);
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let { page, limit, filter, sort, search } = req.query;

 
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 5;
        filter = filter || "all";
        sort = sort || "date-desc";
        search = search || "";

        let query = { userId: userData._id };

        if (search) {
            const searchTerm = search.trim();
            query.$or = [
                { orderId: { $regex: searchTerm, $options: 'i' } },
                { status: { $regex: searchTerm, $options: 'i' } },
                { 'orderedItems.product.productName': { $regex: searchTerm, $options: 'i' } },
            ];
        }

        if (filter !== "all") {
            query.status = filter.charAt(0).toUpperCase() + filter.slice(1); 
        }

        const totalOrders = await Order.countDocuments(query);

        const totalPages = Math.ceil(totalOrders / limit);
        const skip = (page - 1) * limit;

        //  sort criteria
        let sortCriteria = {};
        switch (sort) {
            case "date-desc":
                sortCriteria = { invoiceDate: -1 };
                break;
            case "date-asc":
                sortCriteria = { invoiceDate: 1 };
                break;
            case "total-desc":
                sortCriteria = { finalAmount: -1 };
                break;
            case "total-asc":
                sortCriteria = { finalAmount: 1 };
                break;
            case "status":
                sortCriteria = { status: 1 };
                break;
            default:
                sortCriteria = { invoiceDate: -1 }; 
        }

        // Fetch orders
        const orders = await Order.find(query)
            .populate("orderedItems.product")
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit);

        // Calculate summary
        const allOrders = await Order.find({ userId: userData._id });
        const summary = {
            totalOrders: allOrders.length,
            activeOrders: allOrders.filter(order => ['Pending', 'Processing', 'Shipped',"Out for Delivery"].includes(order.status)).length,
            totalSpend: allOrders.reduce((sum, order) => sum + order.finalAmount, 0),
        };

        
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
                success: true,
                orders,
                summary,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalOrders,
                    limit,
                },
                filter,
                sort,
            });
        }

        res.render('orders', {
            user,
            orders,
            summary,
            pagination: {
                currentPage: page,
                totalPages,
                totalOrders,
                limit,
            },
            filter,
            sort,
            search, 
        });
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

const trackOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product', 'productName');

        if (!order) {
            console.log('Order not found for ID:', orderId);
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json({
            orderId: order.orderId,
            status: order.status,
            createdAt: order.createdAt,
            address: order.address,
        });

    } catch (error) {
        console.error('Error in trackOrder:', error);
        res.status(500).json({ message: 'Server error' });
    }
}; 

const cancelOrder = async (req , res , next) => {
    try {

        if (res.locals.isUserBlocked) {
            return res.status(403).json({ success: false, message: 'Account is blocked' });
        }
    
        const {userData } = res.locals;
        const { orderId } = req.params;
        const { reason , comments } = req.body;
    
        // Validate request data
        const errors = validateCancelOrder({ reason, comments });
        if (errors) {
            return res.status(400).json({ success: false, errors });
        }

        const user = await User.findById(userData)
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Find order
        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product')
            .populate('appliedCoupon')

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check user is authorized to cancel 
        if (order.userId.toString() !== user._id.toString()  && !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized to cancel this order' });
        }

        //checking
        if (['Delivered', 'Cancelled', 'Returned',"Partially Returned" ].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Cannot cancel this order' });
        }

        if (order.paymentStatus === 'Paid' &&  order.refundAmount === 0  ) {
            const refundAmount = order.finalAmount;
            
            if (order.paymentMethod === 'Wallet' || order.paymentMethod === 'Online') {

                let wallet = await Wallet.findOne({ userId: order.userId });
                if (!wallet) {
                    wallet = new Wallet({
                        userId: order.userId,
                        balance: 0,
                    });
                   await wallet.save();
                };
                
                // Add refund to wallet
                wallet.balance += refundAmount; 
                wallet.transactions.push({
                    transactionId: generateCustomId("RFD"),
                    amount: refundAmount,
                    type: 'Credit',
                    status: 'Completed',
                    method: 'Refund',
                    description: `Refund for cancelled order #${order.orderId}`,
                    orderId: order._id,
                    date: Date.now()
                });
                wallet.lastUpdated = Date.now();
                await wallet.save();
                
                order.paymentStatus = 'Refunded';
            }
        }
    
        // Set cancellation 
        order.cancellation = {
            reason,
            comments: comments || '',
            canceledBy: user._id,
            canceledAt: new Date()
        };

        order.isCanceled = true;
        order.revokedCoupon = order.couponDiscount;
        order.refundAmount =  order.finalAmount;
        order.returnTax  = order.tax;
        order.status = 'Cancelled'; 
        
        if (order.appliedCoupon) {
            await Coupon.updateOne(
                { _id: order.appliedCoupon._id },
                { $pull: { usersUsed: order.userId } }
            );
        }
        
        //update product
        for (const item of order.orderedItems) {
            item.returnStatus = "Cancelled";
             const productss = await Product.findOne({_id:item.product._id});
            console.log("product:",productss);
            const product = item.product;
            product.quantity += item.quantity;
            await product.save();
        };

        console.log("order :",order);

        await order.save();
        res.json({success: true,message: 'Order canceled successfully',});
        
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

const returnOrder = async (req, res , next) => {
    try {
        const { isUserBlocked, userData } = res.locals;
        if (isUserBlocked) {
            return res.status(403).json({ success: false, message: 'Account is blocked' });
        }

        const { orderId } = req.params;
        const { reason , comments } = req.body;
    
        // Validate request data
        const errors = validateCancelOrder({ reason, comments });
        if (errors) {
            return res.status(400).json({ success: false, errors });
        }

        
        const user = await User.findById(userData);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const order = await Order.findOne({ orderId }).populate('orderedItems.product');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.userId.toString() !== user._id.toString() && !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized to cancel this order' });
        }

        if (!['Delivered','Partially Returned'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        if (['Return Request', 'Returned'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Order is already in the return process' });
        }

        const returnRequest = new ReturnRequest({
            orderId: order._id,
            itemIds: order.orderedItems.map(item => item._id.toString()), 
            reason,
            comments,
            requestedBy: user._id,
            status: 'Pending',
        });
        await returnRequest.save();

        order.orderedItems.forEach((item => {
            item.returnStatus = 'Return Requested';
        }))

        order.status = 'Return Request';

        await order.save();

        res.json({
            success: true,
            message: 'Return request submitted for review',
        });
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
};

const returnItem = async (req, res , next) => {
    try {
        const { userData  } = res.locals;
        const { orderId, itemId } = req.params;
        const { reason , comments } = req.body;
    
        // Validate 
        const errors = validateCancelOrder({ reason, comments });
        if (errors) {
            return res.status(400).json({ success: false, errors });
        }

        const user = await User.findById(userData);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product')
            .populate('appliedCoupon');
            
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.userId.toString() !== user._id.toString() && !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized to cancel this order' });
        }

        if (!['Delivered','Partially Returned'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        const item = order.orderedItems.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in order' });
        }

        if (['Return Requested', 'Returned'].includes(item.returnStatus)) {
            return res.status(400).json({ success: false, message: 'Item is already in the return process' });
        }

        const returnRequest = new ReturnRequest({
            orderId: order._id,
            itemIds: [itemId], 
            reason,
            comments,
            requestedBy: user._id,
            status : 'Pending',
        });

        await returnRequest.save();

        item.returnStatus = 'Return Requested';
        order.status = 'Return Request';
        
        await order.save();
        res.json({
            success: true,
            message:  'Return request submitted successfully',
        });

    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
}; 

module.exports = {
    getOrderSuccessPage,
    getOrders,
    trackOrder,
    cancelOrder,
    returnOrder,
    returnItem

}