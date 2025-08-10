const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Product = require('../models/Product');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all products with filtering and pagination
// @route   GET /api/products
// @access  Public
router.get('/', optionalAuth, [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .custom((value) => {
      if (value === 'undefined' || value === undefined) {
        return true; // Skip validation for undefined values
      }
      return ['shirts', 'pants', 'dresses', 'skirts', 'jackets', 'coats', 'shoes', 'accessories', 'underwear', 'sportswear'].includes(value);
    })
    .withMessage('Invalid category'),
  query('gender')
    .optional()
    .isIn(['men', 'women', 'unisex'])
    .withMessage('Invalid gender'),
  query('brand')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Brand cannot be empty'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),
  query('sort')
    .optional()
    .custom((value) => {
      if (value === 'name') {
        return true; // Allow 'name' as alias for 'name_asc'
      }
      return ['price_asc', 'price_desc', 'newest', 'oldest', 'rating', 'name_asc', 'name_desc'].includes(value);
    })
    .withMessage('Invalid sort option'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search term cannot be empty')
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

    const {
      page = 1,
      limit = 12,
      category,
      gender,
      brand,
      minPrice,
      maxPrice,
      sort = 'newest',
      search,
      size,
      color,
      featured,
      onSale,
      newArrivals
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (category && category !== 'undefined') filter.category = category;
    if (gender) filter.gender = gender;
    if (brand) filter.brand = { $regex: brand, $options: 'i' };
    if (featured === 'true') filter.isFeatured = true;
    if (onSale === 'true') filter.isOnSale = true;
    if (newArrivals === 'true') filter.isNew = true;

    // Price filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Search functionality
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price_asc':
        sortObj = { price: 1 };
        break;
      case 'price_desc':
        sortObj = { price: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      case 'rating':
        sortObj = { 'ratings.average': -1 };
        break;
      case 'name':
      case 'name_asc':
        sortObj = { name: 1 };
        break;
      case 'name_desc':
        sortObj = { name: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reviews.user', 'firstName lastName avatar');

    // Get total count for pagination
    const total = await Product.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error while fetching products' });
  }
});



// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    const brands = await Product.distinct('brand');

    res.json({
      success: true,
      data: {
        categories,
        brands
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error while fetching categories' });
  }
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const featuredProducts = await Product.find({ 
      isFeatured: true, 
      isActive: true 
    })
    .limit(8)
    .populate('reviews.user', 'firstName lastName avatar');

    res.json({
      success: true,
      data: featuredProducts
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ error: 'Server error while fetching featured products' });
  }
});

// @desc    Get new arrivals
// @route   GET /api/products/new-arrivals
// @access  Public
router.get('/new-arrivals', async (req, res) => {
  try {
    const newArrivals = await Product.find({ 
      isNew: true, 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('reviews.user', 'firstName lastName avatar');

    res.json({
      success: true,
      data: newArrivals
    });
  } catch (error) {
    console.error('Get new arrivals error:', error);
    res.status(500).json({ error: 'Server error while fetching new arrivals' });
  }
});

// @desc    Get sale products
// @route   GET /api/products/sale
// @access  Public
router.get('/sale', async (req, res) => {
  try {
    const saleProducts = await Product.find({ 
      isOnSale: true, 
      isActive: true 
    })
    .sort({ discount: -1 })
    .limit(8)
    .populate('reviews.user', 'firstName lastName avatar');

    res.json({
      success: true,
      data: saleProducts
    });
  } catch (error) {
    console.error('Get sale products error:', error);
    res.status(500).json({ error: 'Server error while fetching sale products' });
  }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('reviews.user', 'firstName lastName avatar')
      .populate('reviews', '-__v');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.isActive) {
      return res.status(404).json({ error: 'Product not available' });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Server error while fetching product' });
  }
});

// @desc    Create product (Admin only)
// @route   POST /api/products
// @access  Private/Admin
router.post('/', protect, authorize('admin'), [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Product name is required and must be less than 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Product description is required and must be less than 2000 characters'),
  body('brand')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Brand is required'),
  body('category')
    .isIn(['shirts', 'pants', 'dresses', 'skirts', 'jackets', 'coats', 'shoes', 'accessories', 'underwear', 'sportswear'])
    .withMessage('Invalid category'),
  body('gender')
    .isIn(['men', 'women', 'unisex'])
    .withMessage('Invalid gender'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('images')
    .isArray({ min: 1 })
    .withMessage('At least one image is required'),
  body('images.*.url')
    .isURL()
    .withMessage('Invalid image URL'),
  body('colors')
    .isArray({ min: 1 })
    .withMessage('At least one color is required'),
  body('sizes')
    .isArray({ min: 1 })
    .withMessage('At least one size is required')
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

    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error while creating product' });
  }
});

// @desc    Update product (Admin only)
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error while updating product' });
  }
});

// @desc    Delete product (Admin only)
// @route   DELETE /api/products/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error while deleting product' });
  }
});

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
router.post('/:id/reviews', protect, [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters')
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

    const { rating, comment, images } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    // Add review
    product.reviews.push({
      user: req.user.id,
      rating,
      comment,
      images: images || []
    });

    await product.save();

    // Populate user info for the new review
    const updatedProduct = await Product.findById(req.params.id)
      .populate('reviews.user', 'firstName lastName avatar');

    res.json({
      success: true,
      message: 'Review added successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ error: 'Server error while adding review' });
  }
});

module.exports = router; 