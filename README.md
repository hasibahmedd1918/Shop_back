# AI Fashion E-commerce Backend

A comprehensive Node.js backend for an AI-powered fashion e-commerce platform with advanced features like virtual try-on, size recommendations, and style matching.

## 🚀 Features

### Core E-commerce Features
- **User Authentication & Authorization** - JWT-based authentication with role-based access
- **Product Management** - Complete CRUD operations with advanced filtering and search
- **Shopping Cart** - Full cart functionality with coupon support
- **Order Management** - Complete order lifecycle with status tracking
- **Wishlist** - Save and manage favorite products
- **User Profiles** - Comprehensive user management with address handling

### AI-Powered Features
- **Virtual Try-On** - Simulate clothing on user photos
- **Size Recommendations** - AI-driven size suggestions based on measurements
- **Style Matching** - Personalized style recommendations
- **Smart Product Filtering** - Advanced search and filtering capabilities

### Security & Performance
- **Rate Limiting** - Protection against abuse
- **Input Validation** - Comprehensive request validation
- **Error Handling** - Robust error management
- **Database Indexing** - Optimized queries for performance
- **CORS Support** - Cross-origin resource sharing
- **Compression** - Response compression for faster loading

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator
- **Security**: helmet, cors, rate-limiting
- **File Upload**: multer
- **Real-time**: Socket.io

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/ai-fashion-db

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d

   # File Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📁 Project Structure

```
backend/
├── src/
│   ├── models/           # Database models
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── Cart.js
│   │   └── Wishlist.js
│   ├── routes/           # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── products.js
│   │   ├── cart.js
│   │   ├── orders.js
│   │   ├── wishlist.js
│   │   └── ai.js
│   ├── middleware/       # Custom middleware
│   │   └── auth.js
│   └── server.js         # Main server file
├── uploads/              # File uploads directory
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Forgot password
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - Get all products (with filtering)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)
- `POST /api/products/:id/reviews` - Add product review
- `GET /api/products/categories` - Get categories and brands
- `GET /api/products/featured` - Get featured products
- `GET /api/products/new-arrivals` - Get new arrivals
- `GET /api/products/sale` - Get sale products

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:itemId` - Update cart item
- `DELETE /api/cart/items/:itemId` - Remove item from cart
- `DELETE /api/cart` - Clear cart
- `POST /api/cart/coupon` - Apply coupon
- `DELETE /api/cart/coupon` - Remove coupon
- `GET /api/cart/summary` - Get cart summary

### Orders
- `POST /api/orders` - Create order from cart
- `GET /api/orders` - Get user's orders
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/cancel` - Cancel order
- `PUT /api/orders/:id/status` - Update order status (Admin)
- `GET /api/orders/:id/tracking` - Get order tracking

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/addresses` - Add address
- `PUT /api/users/addresses/:addressId` - Update address
- `DELETE /api/users/addresses/:addressId` - Delete address
- `GET /api/users/addresses` - Get user addresses

### Wishlist
- `GET /api/wishlist` - Get user's wishlist
- `POST /api/wishlist/items` - Add item to wishlist
- `DELETE /api/wishlist/items/:productId` - Remove item from wishlist
- `PUT /api/wishlist/items/:productId` - Update wishlist item note
- `DELETE /api/wishlist` - Clear wishlist
- `GET /api/wishlist/check/:productId` - Check if product is in wishlist
- `POST /api/wishlist/items/:productId/move-to-cart` - Move item to cart

### AI Features
- `POST /api/ai/size-recommendation` - Get size recommendation
- `POST /api/ai/style-recommendations` - Get style recommendations
- `POST /api/ai/virtual-tryon` - Virtual try-on simulation
- `GET /api/ai/features` - Get AI features status
- `GET /api/ai/products` - Get products with AI features

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Database Models

### User Model
- Basic info (name, email, password)
- Profile preferences (size, style, colors, brands)
- Multiple addresses
- Role-based access (user/admin)

### Product Model
- Comprehensive product details
- Multiple images and colors
- Size and stock management
- Reviews and ratings
- AI features flags

### Order Model
- Complete order information
- Status tracking with timeline
- Payment and shipping details
- Address management

### Cart Model
- Shopping cart functionality
- Coupon support
- Automatic total calculation

### Wishlist Model
- User wishlist management
- Notes and organization

## 🚀 Development

### Running in Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
```

### Database Seeding
```bash
# Add sample data to database
npm run seed
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/ai-fashion-db |
| `JWT_SECRET` | JWT secret key | fallback-secret |
| `JWT_EXPIRE` | JWT expiration | 7d |
| `CORS_ORIGIN` | CORS origin | http://localhost:3000 |

## 🔒 Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Authentication**: Stateless authentication
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request validation
- **CORS**: Cross-origin resource sharing
- **Helmet**: Security headers
- **Compression**: Response compression

## 📈 Performance Optimizations

- **Database Indexing**: Optimized queries
- **Pagination**: Efficient data loading
- **Caching**: Response caching (can be implemented)
- **Compression**: Reduced response size
- **Query Optimization**: Efficient database queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions, please open an issue in the repository.

## 🔄 API Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

Error responses:

```json
{
  "error": "Error message",
  "details": [
    // Validation errors
  ]
}
```

## 🎯 Next Steps

- [ ] Add comprehensive test suite
- [ ] Implement real-time notifications
- [ ] Add payment gateway integration
- [ ] Implement advanced AI features
- [ ] Add analytics and reporting
- [ ] Implement caching layer
- [ ] Add Docker support
- [ ] Implement email notifications 