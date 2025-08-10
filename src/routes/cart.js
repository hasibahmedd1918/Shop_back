const express = require('express');
const { body, validationResult } = require('express-validator');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const debug = require('../utils/debug');

const router = express.Router();

// Request logging middleware
const logRequest = (req, res, next) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  req.requestId = requestId;
  
  debug.request(req.method, req.path, {
    requestId,
    userId: req.user?.id || 'unauthenticated',
    body: req.body,
    params: req.params,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    }
  }, requestId);
  
  next();
};

// Response logging middleware
const logResponse = (req, res, next) => {
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

// Rate limiting for cart operations
const cartLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: 'Too many cart operations. Please wait a moment.'
  }
});

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
router.get('/', protect, logRequest, logResponse, async (req, res) => {
  try {
    debug.info('🔍 GET CART', `Fetching cart for user: ${req.user.id}`, null, req.requestId);
    
    let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    
    if (!cart) {
      debug.warn('📝 CREATE CART', `No cart found, creating new cart for user: ${req.user.id}`, null, req.requestId);
      cart = new Cart({ user: req.user.id, items: [] });
      await cart.save();
      debug.success('✅ CART CREATED', `New cart created with ID: ${cart._id}`, null, req.requestId);
    } else {
      debug.success('📦 CART FOUND', `Cart found with ${cart.items.length} items`, null, req.requestId);
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    debug.error('❌ GET CART ERROR', `Error fetching cart: ${error.message}`, {
      stack: error.stack,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cart'
    });
  }
});

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
router.post('/items', protect, cartLimiter, logRequest, logResponse, [
  body('productId')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Quantity must be between 1 and 10'),
  body('size')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Size must be between 1 and 20 characters'),
  body('color')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Color must be between 1 and 30 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debug.validation.error(errors.array(), req.body, req.requestId);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { productId, quantity, size, color } = req.body;
    debug.cart.add(req.user.id, productId, {
      quantity,
      size,
      color
    }, req.requestId);

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      debug.product.notFound(productId, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    debug.product.found(productId, {
      productName: product.name,
      productPrice: product.price,
      productActive: product.isActive
    }, req.requestId);

    // Check if product is active
    if (!product.isActive) {
      debug.error('❌ PRODUCT INACTIVE', `Product ${productId} is not active`, null, req.requestId);
      return res.status(400).json({
        success: false,
        error: 'Product is not available'
      });
    }

    // Check stock availability for specific size
    const selectedSize = size || 'Free Size';
    let sizeInfo;
    
    // Handle products that don't require specific sizes (like accessories)
    if (product.sizes.length === 0) {
      debug.debug('📏 NO SIZE REQUIRED', `Product ${productId} doesn't require specific sizes`, null, req.requestId);
      // For products without sizes, we'll use 'Free Size' as a placeholder
      sizeInfo = { size: 'Free Size', available: true, stock: product.stock || 999 };
    } else {
      // For products with sizes, find the specific size
      sizeInfo = product.sizes.find(s => s.size === selectedSize);
      
      debug.debug('📏 SIZE CHECK', `Checking size availability for ${selectedSize}`, {
        selectedSize,
        availableSizes: product.sizes.map(s => ({ size: s.size, stock: s.stock, available: s.available })),
        sizeInfo: sizeInfo ? { size: sizeInfo.size, stock: sizeInfo.stock, available: sizeInfo.available } : null
      }, req.requestId);
      
      if (!sizeInfo) {
        debug.error('❌ SIZE NOT AVAILABLE', `Size ${selectedSize} not available for product ${productId}`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Size ${selectedSize} is not available for this product`
        });
      }
    }

    // Check availability and stock (only for products with sizes)
    if (product.sizes.length > 0) {
      if (!sizeInfo.available) {
        debug.error('❌ SIZE UNAVAILABLE', `Size ${selectedSize} is currently unavailable`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Size ${selectedSize} is currently unavailable`
        });
      }

      if (sizeInfo.stock < quantity) {
        debug.error('❌ INSUFFICIENT STOCK', `Only ${sizeInfo.stock} available, requested ${quantity}`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Only ${sizeInfo.stock} items available in size ${selectedSize}`
        });
      }
    } else {
      // For products without sizes, check general stock
      if (product.stock < quantity) {
        debug.error('❌ INSUFFICIENT STOCK', `Only ${product.stock} available, requested ${quantity}`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Only ${product.stock} items available`
        });
      }
    }

    debug.success('✅ STOCK AVAILABLE', `Stock check passed: ${sizeInfo.stock} available`, null, req.requestId);

    let cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      debug.warn('📝 CREATE CART', `No cart found, creating new cart for user: ${req.user.id}`, null, req.requestId);
      cart = new Cart({ user: req.user.id, items: [] });
    } else {
      debug.info('📦 CART FOUND', `Existing cart found with ${cart.items.length} items`, null, req.requestId);
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.product.toString() === productId &&
      item.size === selectedSize &&
      item.color === (color || 'Default')
    );

    if (existingItemIndex > -1) {
      debug.warn('🔄 UPDATE EXISTING', `Item already exists in cart, updating quantity`, null, req.requestId);
      
      // Check if adding more would exceed stock
      const newTotalQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newTotalQuantity > sizeInfo.stock) {
        debug.error('❌ STOCK EXCEEDED', `Cannot add ${quantity} more items. Only ${sizeInfo.stock - cart.items[existingItemIndex].quantity} more available`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Cannot add ${quantity} more items. Only ${sizeInfo.stock - cart.items[existingItemIndex].quantity} more available in size ${selectedSize}`
        });
      }
      
      // Update existing item quantity
      const oldQuantity = cart.items[existingItemIndex].quantity;
      cart.items[existingItemIndex].quantity = newTotalQuantity;
      debug.success('✅ QUANTITY UPDATED', `Updated quantity from ${oldQuantity} to ${newTotalQuantity}`, null, req.requestId);
    } else {
      debug.success('➕ ADD NEW ITEM', `Adding new item to cart`, null, req.requestId);
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        size: selectedSize,
        color: color || 'Default',
        price: product.price,
        originalPrice: product.originalPrice || product.price
      });
    }

    debug.debug('💾 SAVING CART', `Saving cart changes`, null, req.requestId);
    await cart.save();
    await cart.calculateTotals();
    await cart.populate('items.product');

    debug.success('✅ CART UPDATED', `Cart successfully updated`, {
      totalItems: cart.items.length,
      totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.subtotal,
      total: cart.total
    }, req.requestId);

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    debug.error('❌ ADD TO CART ERROR', `Error adding item to cart: ${error.message}`, {
      stack: error.stack,
      body: req.body,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to add item to cart'
    });
  }
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private
router.put('/items/:itemId', protect, cartLimiter, logRequest, logResponse, [
  body('quantity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Quantity must be between 1 and 10')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debug.validation.error(errors.array(), req.body, req.requestId);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { quantity } = req.body;
    const { itemId } = req.params;

    debug.cart.update(req.user.id, itemId, {
      newQuantity: quantity
    }, req.requestId);

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      debug.error('❌ CART NOT FOUND', `Cart not found for user: ${req.user.id}`, null, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      debug.error('❌ ITEM NOT FOUND', `Item ${itemId} not found in cart`, null, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    const cartItem = cart.items[itemIndex];
    debug.success('✅ ITEM FOUND', `Found item in cart`, {
      itemId,
      currentQuantity: cartItem.quantity,
      productId: cartItem.product,
      size: cartItem.size,
      color: cartItem.color
    }, req.requestId);

    // Check stock availability for the specific size
    const product = await Product.findById(cartItem.product);
    if (!product) {
      debug.product.notFound(cartItem.product, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    let sizeInfo;
    // Handle products that don't require specific sizes
    if (product.sizes.length === 0) {
      debug.debug('📏 NO SIZE REQUIRED', `Product ${cartItem.product} doesn't require specific sizes`, null, req.requestId);
      sizeInfo = { size: cartItem.size, available: true, stock: product.stock || 999 };
    } else {
      sizeInfo = product.sizes.find(s => s.size === cartItem.size);
      
      if (!sizeInfo) {
        debug.error('❌ SIZE NOT AVAILABLE', `Size ${cartItem.size} not available for product ${cartItem.product}`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Size ${cartItem.size} is not available for this product`
        });
      }
    }
    
    // Check availability and stock (only for products with sizes)
    if (product.sizes.length > 0) {
      if (!sizeInfo.available) {
        debug.error('❌ SIZE UNAVAILABLE', `Size ${cartItem.size} is currently unavailable`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Size ${cartItem.size} is currently unavailable`
        });
      }

      if (sizeInfo.stock < quantity) {
        debug.error('❌ INSUFFICIENT STOCK', `Only ${sizeInfo.stock} available, requested ${quantity}`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Only ${sizeInfo.stock} items available in size ${cartItem.size}`
        });
      }
    } else {
      // For products without sizes, check general stock
      if (product.stock < quantity) {
        debug.error('❌ INSUFFICIENT STOCK', `Only ${product.stock} available, requested ${quantity}`, null, req.requestId);
        return res.status(400).json({
          success: false,
          error: `Only ${product.stock} items available`
        });
      }
    }

    debug.success('✅ STOCK CHECK PASSED', `Stock check passed: ${sizeInfo.stock} available`, null, req.requestId);

    const oldQuantity = cartItem.quantity;
    cart.items[itemIndex].quantity = quantity;
    
    debug.debug('💾 SAVING CART', `Saving cart with updated quantity`, null, req.requestId);
    await cart.save();
    await cart.calculateTotals();
    await cart.populate('items.product');

    debug.success('✅ QUANTITY UPDATED', `Quantity updated from ${oldQuantity} to ${quantity}`, {
      itemId,
      oldQuantity,
      newQuantity: quantity,
      totalItems: cart.items.length
    }, req.requestId);

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    debug.error('❌ UPDATE CART ERROR', `Error updating cart item: ${error.message}`, {
      stack: error.stack,
      body: req.body,
      params: req.params,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to update cart item'
    });
  }
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private
router.delete('/items/:itemId', protect, cartLimiter, logRequest, logResponse, async (req, res) => {
  try {
    const { itemId } = req.params;

    debug.cart.remove(req.user.id, itemId, req.requestId);

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      debug.error('❌ CART NOT FOUND', `Cart not found for user: ${req.user.id}`, null, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      debug.error('❌ ITEM NOT FOUND', `Item ${itemId} not found in cart`, null, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    const removedItem = cart.items[itemIndex];
    debug.warn('📦 ITEM FOUND', `Found item to remove`, {
      itemId,
      productId: removedItem.product,
      quantity: removedItem.quantity,
      size: removedItem.size,
      color: removedItem.color
    }, req.requestId);

    cart.items.splice(itemIndex, 1);
    
    debug.debug('💾 SAVING CART', `Saving cart after item removal`, null, req.requestId);
    await cart.save();
    await cart.calculateTotals();
    await cart.populate('items.product');

    debug.success('✅ ITEM REMOVED', `Item successfully removed from cart`, {
      itemId,
      remainingItems: cart.items.length,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0)
    }, req.requestId);

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    debug.error('❌ REMOVE CART ERROR', `Error removing item from cart: ${error.message}`, {
      stack: error.stack,
      params: req.params,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to remove item from cart'
    });
  }
});

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
router.delete('/', protect, cartLimiter, logRequest, logResponse, async (req, res) => {
  try {
    debug.cart.clear(req.user.id, req.requestId);

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      debug.error('❌ CART NOT FOUND', `Cart not found for user: ${req.user.id}`, null, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemCount = cart.items.length;
    debug.warn('📦 CART FOUND', `Found cart with ${itemCount} items to clear`, null, req.requestId);

    cart.items = [];
    
    debug.debug('💾 SAVING CART', `Saving empty cart`, null, req.requestId);
    await cart.save();
    await cart.calculateTotals();

    debug.success('✅ CART CLEARED', `Cart successfully cleared`, {
      clearedItems: itemCount,
      remainingItems: cart.items.length
    }, req.requestId);

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    debug.error('❌ CLEAR CART ERROR', `Error clearing cart: ${error.message}`, {
      stack: error.stack,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cart'
    });
  }
});

// @desc    Get cart summary (count, total)
// @route   GET /api/cart/summary
// @access  Private
router.get('/summary', protect, logRequest, logResponse, async (req, res) => {
  try {
    debug.info('📊 GET CART SUMMARY', `Getting cart summary for user: ${req.user.id}`, null, req.requestId);

    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      debug.warn('📦 EMPTY CART', `Cart is empty or not found`, null, req.requestId);
      return res.json({
        success: true,
        data: {
          itemCount: 0,
          totalItems: 0,
          subtotal: 0,
          total: 0
        }
      });
    }

    const summary = {
      itemCount: cart.items.length,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      total: cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    debug.success('✅ SUMMARY CALCULATED', `Cart summary calculated`, summary, req.requestId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    debug.error('❌ SUMMARY ERROR', `Error getting cart summary: ${error.message}`, {
      stack: error.stack,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to get cart summary'
    });
  }
});

// @desc    Apply coupon to cart
// @route   POST /api/cart/coupon
// @access  Private
router.post('/coupon', protect, cartLimiter, logRequest, logResponse, [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Coupon code must be between 1 and 20 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debug.validation.error(errors.array(), req.body, req.requestId);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { code } = req.body;

    debug.info('🎫 APPLY COUPON', `Applying coupon code: ${code}`, {
      couponCode: code,
      userId: req.user.id
    }, req.requestId);

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      debug.error('❌ CART NOT FOUND', `Cart not found for user: ${req.user.id}`, null, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    if (cart.items.length === 0) {
      debug.error('❌ EMPTY CART', `Cannot apply coupon to empty cart`, null, req.requestId);
      return res.status(400).json({
        success: false,
        error: 'Cannot apply coupon to empty cart'
      });
    }

    // Simple coupon validation (in a real app, you'd check against a database)
    const validCoupons = {
      'WELCOME10': { discount: 10, type: 'percentage' },
      'SAVE20': { discount: 20, type: 'percentage' },
      'FREESHIP': { discount: 5.99, type: 'fixed' }
    };

    const coupon = validCoupons[code.toUpperCase()];
    if (!coupon) {
      debug.error('❌ INVALID COUPON', `Invalid coupon code: ${code}`, null, req.requestId);
      return res.status(400).json({
        success: false,
        error: 'Invalid coupon code'
      });
    }

    debug.success('✅ VALID COUPON', `Coupon validated`, {
      code: code.toUpperCase(),
      discount: coupon.discount,
      type: coupon.type
    }, req.requestId);

    // Apply coupon
    cart.coupon = {
      code: code.toUpperCase(),
      discount: coupon.discount,
      type: coupon.type,
      appliedAt: new Date()
    };

    debug.debug('💾 SAVING CART', `Saving cart with applied coupon`, null, req.requestId);
    await cart.save();
    await cart.calculateTotals();
    await cart.populate('items.product');

    debug.success('✅ COUPON APPLIED', `Coupon successfully applied`, {
      couponCode: cart.coupon.code,
      discount: cart.coupon.discount,
      discountType: cart.coupon.type,
      subtotal: cart.subtotal,
      total: cart.total
    }, req.requestId);

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: cart
    });
  } catch (error) {
    debug.error('❌ COUPON ERROR', `Error applying coupon: ${error.message}`, {
      stack: error.stack,
      body: req.body,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to apply coupon'
    });
  }
});

// @desc    Remove coupon from cart
// @route   DELETE /api/cart/coupon
// @access  Private
router.delete('/coupon', protect, cartLimiter, logRequest, logResponse, async (req, res) => {
  try {
    debug.info('🗑️ REMOVE COUPON', `Removing coupon from cart for user: ${req.user.id}`, null, req.requestId);

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      debug.error('❌ CART NOT FOUND', `Cart not found for user: ${req.user.id}`, null, req.requestId);
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const removedCoupon = cart.coupon;
    debug.warn('🎫 COUPON FOUND', `Found coupon to remove`, {
      couponCode: removedCoupon.code,
      discount: removedCoupon.discount,
      type: removedCoupon.type
    }, req.requestId);

    cart.coupon = {};
    
    debug.debug('💾 SAVING CART', `Saving cart after coupon removal`, null, req.requestId);
    await cart.save();
    await cart.calculateTotals();
    await cart.populate('items.product');

    debug.success('✅ COUPON REMOVED', `Coupon successfully removed`, {
      removedCoupon: removedCoupon.code,
      newSubtotal: cart.subtotal,
      newTotal: cart.total
    }, req.requestId);

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      data: cart
    });
  } catch (error) {
    debug.error('❌ REMOVE COUPON ERROR', `Error removing coupon: ${error.message}`, {
      stack: error.stack,
      userId: req.user.id
    }, req.requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to remove coupon'
    });
  }
});

module.exports = router; 