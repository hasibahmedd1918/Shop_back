const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
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
    addedAt: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      maxlength: [200, 'Note cannot exceed 200 characters']
    }
  }],
  name: {
    type: String,
    default: 'My Wishlist',
    maxlength: [100, 'Wishlist name cannot exceed 100 characters']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });

// Virtual for item count
wishlistSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Method to add item to wishlist
wishlistSchema.methods.addItem = function(productId, note = '') {
  const existingItem = this.items.find(item => 
    item.product.toString() === productId.toString()
  );

  if (!existingItem) {
    this.items.push({
      product: productId,
      note
    });
    this.lastUpdated = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove item from wishlist
wishlistSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => 
    item.product.toString() !== productId.toString()
  );
  this.lastUpdated = new Date();
  return this.save();
};

// Method to update item note
wishlistSchema.methods.updateItemNote = function(productId, note) {
  const item = this.items.find(item => 
    item.product.toString() === productId.toString()
  );
  
  if (item) {
    item.note = note;
    this.lastUpdated = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Item not found in wishlist'));
};

// Method to clear wishlist
wishlistSchema.methods.clearWishlist = function() {
  this.items = [];
  this.lastUpdated = new Date();
  return this.save();
};

// Method to check if item exists in wishlist
wishlistSchema.methods.hasItem = function(productId) {
  return this.items.some(item => 
    item.product.toString() === productId.toString()
  );
};

module.exports = mongoose.model('Wishlist', wishlistSchema); 