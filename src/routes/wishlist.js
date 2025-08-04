const express = require('express');
const { body, validationResult } = require('express-validator');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images colors sizes isActive'
      });

    if (!wishlist) {
      // Create new wishlist if doesn't exist
      wishlist = await Wishlist.create({ user: req.user.id });
    }

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ error: 'Server error while fetching wishlist' });
  }
});

// @desc    Add item to wishlist
// @route   POST /api/wishlist/items
// @access  Private
router.post('/items', protect, [
  body('productId')
    .isMongoId()
    .withMessage('Valid product ID is required'),
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

    const { productId, note } = req.body;

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.isActive) {
      return res.status(400).json({ error: 'Product is not available' });
    }

    // Get or create wishlist
    let wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.id });
    }

    // Add item to wishlist
    await wishlist.addItem(productId, note);

    // Populate product details
    const updatedWishlist = await Wishlist.findById(wishlist._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images colors sizes isActive'
      });

    res.json({
      success: true,
      message: 'Item added to wishlist successfully',
      data: updatedWishlist
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ error: 'Server error while adding item to wishlist' });
  }
});

// @desc    Remove item from wishlist
// @route   DELETE /api/wishlist/items/:productId
// @access  Private
router.delete('/items/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    // Check if item exists in wishlist
    const wishlistItem = wishlist.items.find(item => 
      item.product.toString() === productId
    );
    if (!wishlistItem) {
      return res.status(404).json({ error: 'Item not found in wishlist' });
    }

    // Remove item
    await wishlist.removeItem(productId);

    // Populate product details
    const updatedWishlist = await Wishlist.findById(wishlist._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images colors sizes isActive'
      });

    res.json({
      success: true,
      message: 'Item removed from wishlist successfully',
      data: updatedWishlist
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ error: 'Server error while removing item from wishlist' });
  }
});

// @desc    Update wishlist item note
// @route   PUT /api/wishlist/items/:productId
// @access  Private
router.put('/items/:productId', protect, [
  body('note')
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

    const { productId } = req.params;
    const { note } = req.body;

    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    // Update item note
    await wishlist.updateItemNote(productId, note);

    // Populate product details
    const updatedWishlist = await Wishlist.findById(wishlist._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images colors sizes isActive'
      });

    res.json({
      success: true,
      message: 'Wishlist item note updated successfully',
      data: updatedWishlist
    });
  } catch (error) {
    console.error('Update wishlist item error:', error);
    res.status(500).json({ error: 'Server error while updating wishlist item' });
  }
});

// @desc    Clear wishlist
// @route   DELETE /api/wishlist
// @access  Private
router.delete('/', protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    await wishlist.clearWishlist();

    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      data: wishlist
    });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({ error: 'Server error while clearing wishlist' });
  }
});

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
router.get('/check/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      return res.json({
        success: true,
        data: { isInWishlist: false }
      });
    }

    const isInWishlist = wishlist.hasItem(productId);

    res.json({
      success: true,
      data: { isInWishlist }
    });
  } catch (error) {
    console.error('Check wishlist error:', error);
    res.status(500).json({ error: 'Server error while checking wishlist' });
  }
});

// @desc    Move wishlist item to cart
// @route   POST /api/wishlist/items/:productId/move-to-cart
// @access  Private
router.post('/items/:productId/move-to-cart', protect, [
  body('size')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Size is required'),
  body('color')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Color is required'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
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

    const { productId } = req.params;
    const { size, color, quantity } = req.body;

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.isActive) {
      return res.status(400).json({ error: 'Product is not available' });
    }

    // Check if size is available
    const sizeInfo = product.sizes.find(s => s.size === size && s.available);
    if (!sizeInfo) {
      return res.status(400).json({ error: 'Selected size is not available' });
    }

    // Check if color is available
    const colorInfo = product.colors.find(c => c.name === color && c.available);
    if (!colorInfo) {
      return res.status(400).json({ error: 'Selected color is not available' });
    }

    // Check stock
    if (sizeInfo.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock for selected quantity' });
    }

    // Get wishlist
    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    // Check if item exists in wishlist
    const wishlistItem = wishlist.items.find(item => 
      item.product.toString() === productId
    );
    if (!wishlistItem) {
      return res.status(404).json({ error: 'Item not found in wishlist' });
    }

    // Import Cart model
    const Cart = require('../models/Cart');

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = await Cart.create({ user: req.user.id });
    }

    // Calculate price (considering discounts)
    const price = product.discount > 0 
      ? product.price - (product.price * product.discount / 100)
      : product.price;

    // Add item to cart
    await cart.addItem(productId, quantity, size, color, price);

    // Remove item from wishlist
    await wishlist.removeItem(productId);

    // Populate cart with product details
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.product',
        select: 'name brand price originalPrice discount images colors sizes isActive'
      });

    res.json({
      success: true,
      message: 'Item moved to cart successfully',
      data: {
        cart: updatedCart,
        wishlistItemCount: wishlist.itemCount
      }
    });
  } catch (error) {
    console.error('Move to cart error:', error);
    res.status(500).json({ error: 'Server error while moving item to cart' });
  }
});

module.exports = router; 