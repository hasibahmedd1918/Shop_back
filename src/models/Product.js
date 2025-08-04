const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['shirts', 'pants', 'dresses', 'skirts', 'jackets', 'coats', 'shoes', 'accessories', 'underwear', 'sportswear']
  },
  subcategory: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['men', 'women', 'unisex'],
    required: [true, 'Gender is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  discount: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    default: 0
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  colors: [{
    name: {
      type: String,
      required: true
    },
    hex: String,
    available: {
      type: Boolean,
      default: true
    }
  }],
  sizes: [{
    size: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      required: true
    },
    available: {
      type: Boolean,
      default: true
    },
    stock: {
      type: Number,
      min: [0, 'Stock cannot be negative'],
      default: 0
    }
  }],
  tags: [String],
  features: [String],
  materials: [String],
  care: [String],
  measurements: {
    chest: String,
    waist: String,
    hips: String,
    length: String,
    sleeve: String,
    inseam: String
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [500, 'Review comment cannot exceed 500 characters']
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNew: {
    type: Boolean,
    default: false
  },
  isOnSale: {
    type: Boolean,
    default: false
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  weight: {
    type: Number,
    min: [0, 'Weight cannot be negative']
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  shipping: {
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    freeShipping: {
      type: Boolean,
      default: false
    }
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  aiFeatures: {
    virtualTryOn: {
      type: Boolean,
      default: false
    },
    sizeRecommendation: {
      type: Boolean,
      default: false
    },
    styleMatching: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1, gender: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isNew: 1 });
productSchema.index({ isOnSale: 1 });

// Virtual for discounted price
productSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return this.price - (this.price * this.discount / 100);
  }
  return this.price;
});

// Virtual for availability
productSchema.virtual('isAvailable').get(function() {
  return this.isActive && this.sizes.some(size => size.available && size.stock > 0);
});

// Method to update average rating
productSchema.methods.updateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.ratings.average = 0;
    this.ratings.count = 0;
  } else {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.ratings.average = totalRating / this.reviews.length;
    this.ratings.count = this.reviews.length;
  }
  return this.save();
};

// Pre-save middleware to update average rating
productSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    this.updateAverageRating();
  }
  next();
});

module.exports = mongoose.model('Product', productSchema); 