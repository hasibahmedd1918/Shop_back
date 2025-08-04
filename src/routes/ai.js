const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Import chat routes
const chatRoutes = require('./ai/chat.routes');
router.use(chatRoutes);

// @desc    Get size recommendation
// @route   POST /api/ai/size-recommendation
// @access  Private
router.post('/size-recommendation', protect, [
  body('height')
    .isFloat({ min: 100, max: 250 })
    .withMessage('Height must be between 100 and 250 cm'),
  body('weight')
    .isFloat({ min: 30, max: 200 })
    .withMessage('Weight must be between 30 and 200 kg'),
  body('chest')
    .isFloat({ min: 60, max: 150 })
    .withMessage('Chest measurement must be between 60 and 150 cm'),
  body('waist')
    .isFloat({ min: 50, max: 150 })
    .withMessage('Waist measurement must be between 50 and 150 cm'),
  body('hips')
    .optional()
    .isFloat({ min: 60, max: 150 })
    .withMessage('Hips measurement must be between 60 and 150 cm'),
  body('inseam')
    .optional()
    .isFloat({ min: 50, max: 100 })
    .withMessage('Inseam measurement must be between 50 and 100 cm'),
  body('gender')
    .isIn(['men', 'women'])
    .withMessage('Gender must be men or women'),
  body('category')
    .isIn(['shirts', 'pants', 'dresses', 'skirts', 'jackets', 'coats', 'shoes'])
    .withMessage('Valid category is required')
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

    const { height, weight, chest, waist, hips, inseam, gender, category } = req.body;

    // Simple size recommendation algorithm
    // In a real application, this would use ML models
    let recommendedSize = 'M';
    let confidence = 0.8;

    // Basic size calculation based on chest measurement
    if (gender === 'men') {
      if (chest < 90) recommendedSize = 'S';
      else if (chest >= 90 && chest < 100) recommendedSize = 'M';
      else if (chest >= 100 && chest < 110) recommendedSize = 'L';
      else if (chest >= 110 && chest < 120) recommendedSize = 'XL';
      else recommendedSize = 'XXL';
    } else {
      if (chest < 85) recommendedSize = 'XS';
      else if (chest >= 85 && chest < 95) recommendedSize = 'S';
      else if (chest >= 95 && chest < 105) recommendedSize = 'M';
      else if (chest >= 105 && chest < 115) recommendedSize = 'L';
      else if (chest >= 115 && chest < 125) recommendedSize = 'XL';
      else recommendedSize = 'XXL';
    }

    // Adjust confidence based on measurements consistency
    if (Math.abs(chest - waist) > 30) {
      confidence = 0.6;
    }

    // Get products in recommended size
    const products = await Product.find({
      gender,
      category,
      isActive: true,
      'sizes.size': recommendedSize,
      'sizes.available': true,
      'sizes.stock': { $gt: 0 }
    })
    .limit(10)
    .select('name brand price originalPrice discount images colors sizes');

    res.json({
      success: true,
      data: {
        recommendedSize,
        confidence,
        measurements: { height, weight, chest, waist, hips, inseam },
        recommendedProducts: products,
        alternativeSizes: getAlternativeSizes(recommendedSize)
      }
    });
  } catch (error) {
    console.error('Size recommendation error:', error);
    res.status(500).json({ error: 'Server error while generating size recommendation' });
  }
});

// @desc    Get style recommendations
// @route   POST /api/ai/style-recommendations
// @access  Private
router.post('/style-recommendations', protect, [
  body('preferences')
    .isArray()
    .withMessage('Preferences must be an array'),
  body('preferences.*')
    .isIn(['casual', 'formal', 'sporty', 'vintage', 'bohemian', 'minimalist'])
    .withMessage('Invalid style preference'),
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number'),
  body('occasion')
    .optional()
    .isIn(['work', 'casual', 'formal', 'sport', 'party', 'date'])
    .withMessage('Valid occasion is required')
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

    const { preferences, budget, occasion, gender } = req.body;

    // Build filter based on preferences
    const filter = {
      isActive: true,
      'sizes.available': true,
      'sizes.stock': { $gt: 0 }
    };

    if (gender) filter.gender = gender;
    if (budget) filter.price = { $lte: budget };

    // Get products matching preferences
    const products = await Product.find(filter)
      .limit(20)
      .select('name brand price originalPrice discount images colors sizes category');

    // Simple style matching algorithm
    const styleMatches = products.map(product => {
      let matchScore = 0;
      
      // Score based on category and preferences
      if (preferences.includes('casual') && ['shirts', 'pants', 'dresses'].includes(product.category)) {
        matchScore += 0.3;
      }
      if (preferences.includes('formal') && ['shirts', 'pants', 'dresses', 'jackets'].includes(product.category)) {
        matchScore += 0.3;
      }
      if (preferences.includes('sporty') && ['sportswear', 'shoes'].includes(product.category)) {
        matchScore += 0.4;
      }

      // Score based on occasion
      if (occasion === 'work' && ['shirts', 'pants', 'dresses'].includes(product.category)) {
        matchScore += 0.2;
      }
      if (occasion === 'casual' && ['shirts', 'pants', 'dresses'].includes(product.category)) {
        matchScore += 0.2;
      }

      return {
        product,
        matchScore: Math.min(matchScore, 1),
        recommendations: generateStyleRecommendations(product, preferences, occasion)
      };
    });

    // Sort by match score
    styleMatches.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: {
        recommendations: styleMatches.slice(0, 10),
        preferences,
        occasion,
        totalMatches: styleMatches.length
      }
    });
  } catch (error) {
    console.error('Style recommendations error:', error);
    res.status(500).json({ error: 'Server error while generating style recommendations' });
  }
});

// @desc    Virtual try-on simulation
// @route   POST /api/ai/virtual-tryon
// @access  Private
router.post('/virtual-tryon', protect, [
  body('productId')
    .isMongoId()
    .withMessage('Valid product ID is required'),
  body('userImage')
    .isURL()
    .withMessage('Valid user image URL is required'),
  body('size')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Size is required')
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

    const { productId, userImage, size } = req.body;

    // Check if product exists and supports virtual try-on
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.aiFeatures.virtualTryOn) {
      return res.status(400).json({ error: 'This product does not support virtual try-on' });
    }

    // Simulate virtual try-on processing
    // In a real application, this would use computer vision and AI models
    const tryOnResult = {
      status: 'processing',
      estimatedTime: 30, // seconds
      resultUrl: null,
      confidence: 0.85,
      fitAnalysis: {
        shoulders: 'Good fit',
        chest: 'Slightly loose',
        waist: 'Perfect fit',
        length: 'Appropriate'
      },
      recommendations: [
        'This size fits well overall',
        'Consider trying a smaller size for a tighter fit',
        'The length is perfect for your height'
      ]
    };

    // Simulate processing delay
    setTimeout(() => {
      tryOnResult.status = 'completed';
      tryOnResult.resultUrl = `https://example.com/tryon-result-${Date.now()}.jpg`;
    }, 5000);

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          brand: product.brand,
          images: product.images
        },
        tryOnResult,
        userImage,
        selectedSize: size
      }
    });
  } catch (error) {
    console.error('Virtual try-on error:', error);
    res.status(500).json({ error: 'Server error while processing virtual try-on' });
  }
});

// @desc    Get AI features status
// @route   GET /api/ai/features
// @access  Public
router.get('/features', async (req, res) => {
  try {
    const features = {
      virtualTryOn: {
        available: true,
        description: 'Try clothes virtually using your photo',
        supportedCategories: ['shirts', 'dresses', 'jackets']
      },
      sizeRecommendation: {
        available: true,
        description: 'Get personalized size recommendations',
        supportedCategories: ['shirts', 'pants', 'dresses', 'jackets', 'coats']
      },
      styleMatching: {
        available: true,
        description: 'Get style recommendations based on preferences',
        supportedCategories: ['all']
      },
      colorAnalysis: {
        available: false,
        description: 'Analyze colors that match your skin tone',
        supportedCategories: []
      }
    };

    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    console.error('Get AI features error:', error);
    res.status(500).json({ error: 'Server error while fetching AI features' });
  }
});

// @desc    Get products with AI features
// @route   GET /api/ai/products
// @access  Public
router.get('/products', optionalAuth, async (req, res) => {
  try {
    const { feature, category, gender } = req.query;

    const filter = {
      isActive: true,
      'sizes.available': true,
      'sizes.stock': { $gt: 0 }
    };

    if (feature === 'virtualTryOn') {
      filter['aiFeatures.virtualTryOn'] = true;
    }
    if (feature === 'sizeRecommendation') {
      filter['aiFeatures.sizeRecommendation'] = true;
    }
    if (feature === 'styleMatching') {
      filter['aiFeatures.styleMatching'] = true;
    }
    if (category) filter.category = category;
    if (gender) filter.gender = gender;

    const products = await Product.find(filter)
      .limit(20)
      .select('name brand price originalPrice discount images colors sizes aiFeatures category');

    res.json({
      success: true,
      data: {
        products,
        total: products.length,
        feature: feature || 'all'
      }
    });
  } catch (error) {
    console.error('Get AI products error:', error);
    res.status(500).json({ error: 'Server error while fetching AI products' });
  }
});

// Helper functions
function getAlternativeSizes(recommendedSize) {
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const currentIndex = sizeOrder.indexOf(recommendedSize);
  
  const alternatives = [];
  if (currentIndex > 0) {
    alternatives.push(sizeOrder[currentIndex - 1]);
  }
  if (currentIndex < sizeOrder.length - 1) {
    alternatives.push(sizeOrder[currentIndex + 1]);
  }
  
  return alternatives;
}

function generateStyleRecommendations(product, preferences, occasion) {
  const recommendations = [];
  
  if (preferences.includes('casual')) {
    recommendations.push('Perfect for casual wear');
  }
  if (preferences.includes('formal')) {
    recommendations.push('Great for formal occasions');
  }
  if (occasion === 'work') {
    recommendations.push('Professional and office-appropriate');
  }
  if (occasion === 'date') {
    recommendations.push('Stylish and date-night ready');
  }
  
  return recommendations;
}

module.exports = router; 