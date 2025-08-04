const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Create order from cart
// @route   POST /api/orders
// @access  Private
router.post('/', protect, [
  body('shippingAddress')
    .isObject()
    .withMessage('Shipping address is required'),
  body('shippingAddress.firstName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('shippingAddress.lastName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Street address is required'),
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 1 })
    .withMessage('City is required'),
  body('shippingAddress.state')
    .trim()
    .isLength({ min: 1 })
    .withMessage('State is required'),
  body('shippingAddress.zipCode')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Zip code is required'),
  body('paymentMethod')
    .isIn(['credit_card', 'debit_card', 'paypal', 'stripe', 'apple_pay', 'google_pay'])
    .withMessage('Valid payment method is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { shippingAddress, billingAddress, paymentMethod, notes } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images isActive'
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate all products are still available
    for (const item of cart.items) {
      if (!item.product.isActive) {
        return res.status(400).json({ 
          error: `Product ${item.product.name} is no longer available` 
        });
      }

      // Check stock
      const product = await Product.findById(item.product._id);
      const sizeInfo = product.sizes.find(s => s.size === item.size);
      if (!sizeInfo || sizeInfo.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.product.name} in size ${item.size}` 
        });
      }
    }

    // Create order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: item.price,
      originalPrice: item.originalPrice,
      discount: item.discount
    }));

    // Create order
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal: cart.subtotal,
      tax: cart.tax,
      shipping: cart.shipping,
      discount: cart.discount,
      total: cart.total,
      paymentMethod,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes: {
        customer: notes
      }
    });

    // Update product stock
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
      if (sizeIndex !== -1) {
        product.sizes[sizeIndex].stock -= item.quantity;
        if (product.sizes[sizeIndex].stock === 0) {
          product.sizes[sizeIndex].available = false;
        }
        await product.save();
      }
    }

    // Clear cart
    await cart.clearCart();

    // Populate order with product details
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images'
      })
      .populate('user', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: populatedOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Server error while creating order' });
  }
});

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images'
      });

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error while fetching orders' });
  }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images'
      })
      .populate('user', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user owns this order
    if (order.user._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this order' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: 'Server error while fetching order' });
  }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to cancel this order' });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ 
        error: 'Order cannot be cancelled at this stage' 
      });
    }

    // Update order status
    await order.updateStatus('cancelled', 'Cancelled by customer');

    // Restore product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock += item.quantity;
          if (product.sizes[sizeIndex].stock > 0) {
            product.sizes[sizeIndex].available = true;
          }
          await product.save();
        }
      }
    }

    const updatedOrder = await Order.findById(order._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images'
      })
      .populate('user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Server error while cancelling order' });
  }
});

// @desc    Update order status (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, [
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Valid status is required'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Note cannot exceed 200 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { status, note } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order status
    await order.updateStatus(status, note);

    const updatedOrder = await Order.findById(order._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images'
      })
      .populate('user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error while updating order status' });
  }
});

// @desc    Get order tracking
// @route   GET /api/orders/:id/tracking
// @access  Private
router.get('/:id/tracking', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('orderNumber status timeline shipping');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this order' });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        timeline: order.timeline,
        shipping: order.shipping
      }
    });
  } catch (error) {
    console.error('Get order tracking error:', error);
    res.status(500).json({ error: 'Server error while fetching order tracking' });
  }
});

module.exports = router; 