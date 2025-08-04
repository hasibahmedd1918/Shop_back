const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('addresses');

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error while fetching profile' });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('preferences.size')
    .optional()
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
    .withMessage('Invalid size preference'),
  body('preferences.style')
    .optional()
    .isArray()
    .withMessage('Style preferences must be an array'),
  body('preferences.colors')
    .optional()
    .isArray()
    .withMessage('Color preferences must be an array'),
  body('preferences.brands')
    .optional()
    .isArray()
    .withMessage('Brand preferences must be an array')
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

    const { firstName, lastName, phone, preferences, avatar } = req.body;

    const user = await User.findById(req.user.id);

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    const updatedUser = await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error while updating profile' });
  }
});

// @desc    Add address
// @route   POST /api/users/addresses
// @access  Private
router.post('/addresses', protect, [
  body('type')
    .isIn(['home', 'work', 'other'])
    .withMessage('Valid address type is required'),
  body('street')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Street address is required'),
  body('city')
    .trim()
    .isLength({ min: 1 })
    .withMessage('City is required'),
  body('state')
    .trim()
    .isLength({ min: 1 })
    .withMessage('State is required'),
  body('zipCode')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Zip code is required'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Country is required'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean')
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

    const { type, street, city, state, zipCode, country = 'US', isDefault = false } = req.body;

    const user = await User.findById(req.user.id);

    // If this is the default address, remove default from other addresses
    if (isDefault) {
      user.addresses.forEach(address => {
        address.isDefault = false;
      });
    }

    // Add new address
    user.addresses.push({
      type,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault
    });

    const updatedUser = await user.save();

    res.json({
      success: true,
      message: 'Address added successfully',
      data: updatedUser.addresses
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ error: 'Server error while adding address' });
  }
});

// @desc    Update address
// @route   PUT /api/users/addresses/:addressId
// @access  Private
router.put('/addresses/:addressId', protect, [
  body('type')
    .optional()
    .isIn(['home', 'work', 'other'])
    .withMessage('Valid address type is required'),
  body('street')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Street address is required'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('City is required'),
  body('state')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('State is required'),
  body('zipCode')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Zip code is required'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Country is required'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean')
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

    const { addressId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user.id);

    // Find the address
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If setting as default, remove default from other addresses
    if (updateData.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Update address
    Object.assign(address, updateData);

    const updatedUser = await user.save();

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: updatedUser.addresses
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Server error while updating address' });
  }
});

// @desc    Delete address
// @route   DELETE /api/users/addresses/:addressId
// @access  Private
router.delete('/addresses/:addressId', protect, async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);

    // Find the address
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Remove address
    user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);

    const updatedUser = await user.save();

    res.json({
      success: true,
      message: 'Address deleted successfully',
      data: updatedUser.addresses
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Server error while deleting address' });
  }
});

// @desc    Get user addresses
// @route   GET /api/users/addresses
// @access  Private
router.get('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');

    res.json({
      success: true,
      data: user.addresses
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ error: 'Server error while fetching addresses' });
  }
});

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isActive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
});

// @desc    Get single user (Admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('addresses');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Server error while fetching user' });
  }
});

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error while updating user' });
  }
});

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error while deleting user' });
  }
});

module.exports = router; 