const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    size: {
      type: String,
    },
    color: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    originalPrice: Number,
    discount: {
      type: Number,
      default: 0
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  shipping: {
    type: Number,
    default: 0,
    min: [0, 'Shipping cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  total: {
    type: Number,
    default: 0,
    min: [0, 'Total cannot be negative']
  },
  coupon: {
    code: String,
    discount: Number,
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    appliedAt: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });

// Virtual for item count
cartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to add item to cart
cartSchema.methods.addItem = function(productId, quantity, size, color, price) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() && 
    item.size === size && 
    item.color === color
  );

  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
  } else {
    this.items.push({
      product: productId,
      quantity,
      size,
      color,
      price,
      originalPrice: price
    });
  }

  this.lastUpdated = new Date();
  return this.calculateTotals();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (item) {
    if (quantity <= 0) {
      this.items = this.items.filter(item => item._id.toString() !== itemId);
    } else {
      item.quantity = quantity;
    }
    this.lastUpdated = new Date();
    return this.calculateTotals();
  }
  return Promise.reject(new Error('Item not found in cart'));
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId);
  this.lastUpdated = new Date();
  return this.calculateTotals();
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.subtotal = 0;
  this.tax = 0;
  this.shipping = 0;
  this.discount = 0;
  this.total = 0;
  this.coupon = {};
  this.lastUpdated = new Date();
  return this.save();
};

// Method to calculate totals
cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => {
    const itemTotal = item.price * item.quantity;
    return total + itemTotal;
  }, 0);

  // Apply coupon discount if exists
  let discountAmount = 0;
  if (this.coupon && this.coupon.discount) {
    if (this.coupon.type === 'percentage') {
      discountAmount = (this.subtotal * this.coupon.discount) / 100;
    } else {
      discountAmount = this.coupon.discount;
    }
    this.discount = Math.min(discountAmount, this.subtotal);
  }

  // Calculate shipping (free shipping over $50)
  this.shipping = this.subtotal >= 50 ? 0 : 5.99;

  // Calculate tax (8.5% for example)
  this.tax = (this.subtotal - this.discount) * 0.085;

  this.total = this.subtotal + this.tax + this.shipping - this.discount;
  this.lastUpdated = new Date();

  return this.save();
};

// Method to apply coupon
cartSchema.methods.applyCoupon = function(couponCode, discount, type = 'percentage') {
  this.coupon = {
    code: couponCode,
    discount,
    type,
    appliedAt: new Date()
  };
  return this.calculateTotals();
};

// Method to remove coupon
cartSchema.methods.removeCoupon = function() {
  this.coupon = {};
  return this.calculateTotals();
};

// Note: Removed pre-save middleware to avoid infinite loop
// calculateTotals() already calls save(), so pre-save was causing issues

module.exports = mongoose.model('Cart', cartSchema); 