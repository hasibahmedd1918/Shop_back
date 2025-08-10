const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const debug = require('../utils/debug');

const router = express.Router();

// Request logging middleware for orders
const logOrderRequest = (req, res, next) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  req.requestId = requestId;
  
  debug.request(req.method, req.path, {
    requestId,
    userId: req.user?.id || 'unauthenticated',
    body: req.body,
    params: req.params,
    query: req.query
  }, requestId);
  
  next();
};

// Response logging middleware for orders
const logOrderResponse = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
    
    debug.response(req.method, req.path, res.statusCode, {
      requestId: req.requestId,
      success: responseData.success,
      message: responseData.message || responseData.error,
      dataLength: responseData.data ? Object.keys(responseData.data).length : 0
    }, req.requestId);
    
    originalSend.call(this, data);
  };
  next();
};

// @desc    Create order from cart
// @route   POST /api/orders
// @access  Private
router.post('/', protect, logOrderRequest, logOrderResponse, [
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
    .isIn(['credit_card', 'debit_card', 'paypal', 'stripe', 'apple_pay', 'google_pay', 'bkash', 'nagad', 'rocket'])
    .withMessage('Valid payment method is required'),
  body('mobileNumber')
    .if(body('paymentMethod').isIn(['bkash', 'nagad', 'rocket']))
    .notEmpty()
    .withMessage('Mobile number is required for mobile banking payment'),
  body('transactionNumber')
    .if(body('paymentMethod').isIn(['bkash', 'nagad', 'rocket']))
    .notEmpty()
    .withMessage('Transaction number is required for mobile banking payment'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
  try {
    debug.info('🛒 CREATE ORDER', `Starting order creation for user: ${req.user.id}`, {
      userId: req.user.id,
      paymentMethod: req.body.paymentMethod,
      hasShippingAddress: !!req.body.shippingAddress
    }, req.requestId);

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debug.validation.error(errors.array(), req.body, req.requestId);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    debug.success('✅ VALIDATION PASSED', 'Request validation passed', null, req.requestId);

    const { shippingAddress, billingAddress, paymentMethod, mobileNumber, transactionNumber, notes } = req.body;

    // Get user's cart
    debug.info('🛒 FETCHING CART', `Fetching cart for user: ${req.user.id}`, null, req.requestId);
    
    const cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images isActive'
      });

    if (!cart) {
      debug.error('❌ CART NOT FOUND', `No cart found for user: ${req.user.id}`, null, req.requestId);
      return res.status(400).json({ error: 'Cart not found' });
    }

    if (cart.items.length === 0) {
      debug.error('❌ EMPTY CART', `Cart is empty for user: ${req.user.id}`, {
        cartId: cart._id,
        itemCount: cart.items.length
      }, req.requestId);
      return res.status(400).json({ error: 'Cart is empty' });
    }

    debug.success('✅ CART FOUND', `Cart found with ${cart.items.length} items`, {
      cartId: cart._id,
      itemCount: cart.items.length,
      subtotal: cart.subtotal,
      total: cart.total
    }, req.requestId);

    // Validate all products are still available
    debug.info('🔍 VALIDATING PRODUCTS', `Validating ${cart.items.length} products`, null, req.requestId);
    
    for (const item of cart.items) {
      debug.debug('🔍 CHECKING PRODUCT', `Checking product: ${item.product.name}`, {
        productId: item.product._id,
        productName: item.product.name,
        isActive: item.product.isActive,
        size: item.size,
        quantity: item.quantity
      }, req.requestId);

      if (!item.product.isActive) {
        debug.error('❌ PRODUCT INACTIVE', `Product ${item.product.name} is no longer available`, {
          productId: item.product._id,
          productName: item.product.name
        }, req.requestId);
        return res.status(400).json({ 
          error: `Product ${item.product.name} is no longer available` 
        });
      }

      // Check stock
      const product = await Product.findById(item.product._id);
      let sizeInfo;
      
      // Handle products that don't require specific sizes
      if (product.sizes.length === 0) {
        debug.debug('📏 NO SIZE REQUIRED', `Product ${item.product._id} doesn't require specific sizes`, null, req.requestId);
        sizeInfo = { size: item.size, available: true, stock: product.stock || 999 };
      } else {
        sizeInfo = product.sizes.find(s => s.size === item.size);
        
        if (!sizeInfo) {
          debug.error('❌ SIZE NOT FOUND', `Size ${item.size} not found for product ${item.product.name}`, {
            productId: item.product._id,
            productName: item.product.name,
            requestedSize: item.size,
            availableSizes: product.sizes.map(s => s.size)
          }, req.requestId);
          return res.status(400).json({ 
            error: `Size ${item.size} not available for ${item.product.name}` 
          });
        }
      }
      
      // Check stock (only for products with sizes)
      if (product.sizes.length > 0) {
        if (sizeInfo.stock < item.quantity) {
          debug.error('❌ INSUFFICIENT STOCK', `Insufficient stock for ${item.product.name}`, {
            productId: item.product._id,
            productName: item.product.name,
            size: item.size,
            requestedQuantity: item.quantity,
            availableStock: sizeInfo.stock
          }, req.requestId);
          return res.status(400).json({ 
            error: `Insufficient stock for ${item.product.name} in size ${item.size}` 
          });
        }
      } else {
        // For products without sizes, check general stock
        if (product.stock < item.quantity) {
          debug.error('❌ INSUFFICIENT STOCK', `Insufficient stock for ${item.product.name}`, {
            productId: item.product._id,
            productName: item.product.name,
            requestedQuantity: item.quantity,
            availableStock: product.stock
          }, req.requestId);
          return res.status(400).json({ 
            error: `Insufficient stock for ${item.product.name}` 
          });
        }
      }

      debug.success('✅ PRODUCT VALID', `Product ${item.product.name} validated`, {
        productId: item.product._id,
        productName: item.product.name,
        size: item.size,
        quantity: item.quantity,
        availableStock: sizeInfo.stock
      }, req.requestId);
    }

    debug.success('✅ ALL PRODUCTS VALID', `All ${cart.items.length} products validated successfully`, null, req.requestId);

    // Create order items
    debug.info('📝 CREATING ORDER ITEMS', `Creating order items from cart`, {
      itemCount: cart.items.length
    }, req.requestId);

    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: item.price,
      originalPrice: item.originalPrice,
      discount: item.discount
    }));

    debug.success('✅ ORDER ITEMS CREATED', `Order items created successfully`, {
      itemCount: orderItems.length
    }, req.requestId);

    // Prepare payment details
    debug.info('💳 PREPARING PAYMENT', `Preparing payment details for method: ${paymentMethod}`, {
      paymentMethod,
      isMobileBanking: ['bkash', 'nagad', 'rocket'].includes(paymentMethod)
    }, req.requestId);

    const paymentDetails = {};
    if (['bkash', 'nagad', 'rocket'].includes(paymentMethod)) {
      paymentDetails.mobileNumber = mobileNumber;
      paymentDetails.transactionNumber = transactionNumber;
      paymentDetails.paymentMethod = paymentMethod;
      
      debug.success('✅ MOBILE PAYMENT DETAILS', `Mobile payment details prepared`, {
        mobileNumber,
        transactionNumber,
        paymentMethod
      }, req.requestId);
    }

    // Create order
    debug.info('📦 CREATING ORDER', `Creating order in database`, {
      userId: req.user.id,
      itemCount: orderItems.length,
      subtotal: cart.subtotal,
      total: cart.total
    }, req.requestId);

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal: cart.subtotal,
      tax: cart.tax,
      shipping: cart.shipping,
      discount: cart.discount,
      total: cart.total,
      paymentMethod,
      paymentDetails,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes: {
        customer: notes
      }
    });

    debug.success('✅ ORDER CREATED', `Order created successfully`, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.total
    }, req.requestId);

    // Update product stock
    debug.info('📦 UPDATING STOCK', `Updating stock for ${cart.items.length} products`, null, req.requestId);
    
    for (const item of cart.items) {
      debug.debug('📦 UPDATING PRODUCT STOCK', `Updating stock for ${item.product.name}`, {
        productId: item.product._id,
        productName: item.product.name,
        size: item.size,
        quantity: item.quantity
      }, req.requestId);

      const product = await Product.findById(item.product._id);
      const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
      if (sizeIndex !== -1) {
        const oldStock = product.sizes[sizeIndex].stock;
        product.sizes[sizeIndex].stock -= item.quantity;
        if (product.sizes[sizeIndex].stock === 0) {
          product.sizes[sizeIndex].available = false;
        }
        await product.save();
        
        debug.success('✅ STOCK UPDATED', `Stock updated for ${item.product.name}`, {
          productId: item.product._id,
          productName: item.product.name,
          size: item.size,
          oldStock,
          newStock: product.sizes[sizeIndex].stock,
          available: product.sizes[sizeIndex].available
        }, req.requestId);
      }
    }

    debug.success('✅ ALL STOCK UPDATED', `Stock updated for all products`, null, req.requestId);

    // Clear cart
    debug.info('🧹 CLEARING CART', `Clearing cart after order creation`, {
      cartId: cart._id
    }, req.requestId);

    await cart.clearCart();

    debug.success('✅ CART CLEARED', `Cart cleared successfully`, {
      cartId: cart._id
    }, req.requestId);

    // Populate order with product details
    debug.info('📋 POPULATING ORDER', `Populating order with product details`, {
      orderId: order._id
    }, req.requestId);

    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images'
      })
      .populate('user', 'firstName lastName email');

    debug.success('✅ ORDER POPULATED', `Order populated successfully`, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      itemCount: populatedOrder.items.length
    }, req.requestId);

    debug.success('🎉 ORDER CREATION COMPLETE', `Order creation completed successfully`, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      itemCount: order.items.length
    }, req.requestId);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: populatedOrder
    });
  } catch (error) {
    debug.error('❌ ORDER CREATION ERROR', `Error creating order: ${error.message}`, {
      stack: error.stack,
      userId: req.user.id,
      body: req.body
    }, req.requestId);
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