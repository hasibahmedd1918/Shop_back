const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async generateResponse(userMessage, context = {}) {
    try {
      // First, analyze if user is asking for products
      const productRequest = this.analyzeProductRequest(userMessage);
      
      if (productRequest.shouldSearch) {
        // Search products from database
        const products = await this.searchProducts(productRequest);
        
        // Generate response with actual products
        const response = await this.generateProductResponse(userMessage, products, context);
        
        return {
          success: true,
          content: response.content,
          suggestions: response.suggestions,
          products: products, // Include actual products
          searchQuery: productRequest.searchQuery
        };
      } else {
        // Regular conversation response
        const prompt = this.buildPrompt(userMessage, context);
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        
        return {
          success: true,
          content: response.text(),
          suggestions: this.generateSuggestions(userMessage, context)
        };
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getFallbackResponse(userMessage, context);
    }
  }

  analyzeProductRequest(message) {
    const lowerMessage = message.toLowerCase();
    
    // Keywords that indicate product search
    const productKeywords = [
      'show me', 'find', 'search', 'looking for', 'want', 'need',
      'punjabi', 'saree', 'shirt', 'dress', 'kurti', 'panjabi',
      'শাড়ি', 'পাঞ্জাবি', 'শার্ট', 'পোশাক', 'কুর্তি',
      'under', 'below', 'less than', 'budget', 'price'
    ];

    const hasProductKeywords = productKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (!hasProductKeywords) {
      return { shouldSearch: false };
    }

    // Extract search parameters
    const searchQuery = this.extractSearchQuery(message);
    
    return {
      shouldSearch: true,
      searchQuery: searchQuery
    };
  }

  extractSearchQuery(message) {
    const lowerMessage = message.toLowerCase();
    
    // Extract product type
    let productType = '';
    const productTypes = {
      'punjabi': 'punjabi',
      'panjabi': 'punjabi',
      'পাঞ্জাবি': 'punjabi',
      'saree': 'saree',
      'শাড়ি': 'saree',
      'shirt': 'shirt',
      'শার্ট': 'shirt',
      'dress': 'dress',
      'পোশাক': 'dress',
      'kurti': 'kurti',
      'কুর্তি': 'kurti'
    };

    for (const [keyword, type] of Object.entries(productTypes)) {
      if (lowerMessage.includes(keyword)) {
        productType = type;
        break;
      }
    }

    // Extract price range
    let maxPrice = null;
    const priceMatch = lowerMessage.match(/(?:under|below|less than|maximum|upto)\s*(\d+)\s*(?:tk|taka|৳|tk\.)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1]);
    }

    // Extract gender
    let gender = '';
    if (lowerMessage.includes('men') || lowerMessage.includes('পুরুষ')) {
      gender = 'men';
    } else if (lowerMessage.includes('women') || lowerMessage.includes('মহিলা')) {
      gender = 'women';
    }

    // Extract category
    let category = '';
    if (productType === 'punjabi') {
      category = 'shirts';
    } else if (productType === 'saree') {
      category = 'dresses';
    } else if (productType === 'kurti') {
      category = 'dresses';
    }

    return {
      productType,
      maxPrice,
      gender,
      category,
      originalMessage: message
    };
  }

  async searchProducts(searchQuery) {
    try {
      const filter = {
        isActive: true,
        'sizes.available': true,
        'sizes.stock': { $gt: 0 }
      };

      // Add category filter
      if (searchQuery.category) {
        filter.category = searchQuery.category;
      }

      // Add gender filter
      if (searchQuery.gender) {
        filter.gender = searchQuery.gender;
      }

      // Add price filter
      if (searchQuery.maxPrice) {
        filter.price = { $lte: searchQuery.maxPrice };
      }

      // Add text search for product type
      if (searchQuery.productType) {
        filter.$or = [
          { name: { $regex: searchQuery.productType, $options: 'i' } },
          { description: { $regex: searchQuery.productType, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery.productType, 'i')] } }
        ];
      }

      const products = await Product.find(filter)
        .limit(8)
        .select('name description brand price originalPrice discount images colors sizes category gender ratings')
        .sort({ ratings: -1, price: 1 });

      return products;
    } catch (error) {
      console.error('Product search error:', error);
      return [];
    }
  }

  async generateProductResponse(userMessage, products, context) {
    const prompt = `
You are an AI fashion assistant for "GenAI Fashion", a premium e-commerce store in Bangladesh.

USER MESSAGE: "${userMessage}"

I found ${products.length} products matching your request. Here are the details:

${products.map((product, index) => `
${index + 1}. ${product.name}
   - Brand: ${product.brand}
   - Price: ৳${product.price}${product.originalPrice ? ` (Original: ৳${product.originalPrice})` : ''}
   - Rating: ${product.ratings.average.toFixed(1)}/5 (${product.ratings.count} reviews)
   - Available sizes: ${product.sizes.filter(s => s.available && s.stock > 0).map(s => s.size).join(', ')}
`).join('\n')}

Please provide a helpful response that:
1. Acknowledges the user's request
2. Mentions the number of products found
3. Highlights key features of the products (price, rating, availability)
4. Encourages them to view the products
5. Offer to help with more specific requirements
6. Keep the tone friendly and helpful
7. Include some Bengali if the original message was in Bengali

Respond in a conversational tone and make it sound natural.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        content: response.text(),
        suggestions: this.generateProductSuggestions(products, userMessage)
      };
    } catch (error) {
      // Fallback response if AI fails
      return {
        content: this.generateFallbackProductResponse(products, userMessage),
        suggestions: this.generateProductSuggestions(products, userMessage)
      };
    }
  }

  generateFallbackProductResponse(products, userMessage) {
    const isBengali = /[অ-হ]/.test(userMessage);
    
    if (products.length === 0) {
      return isBengali 
        ? "দুঃখিত, আপনার চাহিদা অনুযায়ী কোন পণ্য পাওয়া যায়নি। আপনি কি অন্য কোন ধরনের পোশাক খুঁজছেন?"
        : "Sorry, I couldn't find any products matching your requirements. Would you like to search for something else?";
    }

    const response = isBengali
      ? `আপনার চাহিদা অনুযায়ী ${products.length}টি পণ্য পেয়েছি! এগুলো দেখুন:`
      : `I found ${products.length} products matching your request! Here they are:`;

    return response;
  }

  generateProductSuggestions(products, userMessage) {
    const suggestions = [];
    
    if (products.length > 0) {
      suggestions.push('Show me more options');
      suggestions.push('Filter by size');
      suggestions.push('Sort by price');
    }
    
    // Add contextual suggestions based on the search
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes('punjabi') || lowerMessage.includes('পাঞ্জাবি')) {
      suggestions.push('Show me sarees');
      suggestions.push('Traditional wear');
    } else if (lowerMessage.includes('saree') || lowerMessage.includes('শাড়ি')) {
      suggestions.push('Show me punjabis');
      suggestions.push('Modern dresses');
    }
    
    suggestions.push('Help me find something else');
    
    return suggestions.slice(0, 4);
  }

  buildPrompt(userMessage, context) {
    return `
You are an AI fashion assistant for "GenAI Fashion", a premium e-commerce store in Bangladesh. 

CONTEXT:
- Store: GenAI Fashion (Bangladesh)
- Currency: ৳ (Bangladeshi Taka)
- Products: Traditional wear (sarees, punjabis), modern fashion, casual clothing
- User Context: ${JSON.stringify(context)}

GUIDELINES:
1. Provide helpful, friendly, and personalized fashion advice
2. Respond in a conversational tone
3. Include specific product recommendations when relevant
4. Support both English and Bengali languages
5. Consider user preferences, budget, and occasion
6. Provide actionable advice and next steps
7. If the user is asking for a product, you should search the database for the product and return the product details.
8.If the user asks for a product or asks directive question try to answer that concisely.
9.Provide short and clear answer to the user . No need to be too verbose.
10. Answer the question only no need to drag the previous converstaion or the search.

USER MESSAGE: "${userMessage}"

Please provide a helpful response that addresses the user's needs while promoting our fashion store.
`;
  }

  generateSuggestions(userMessage, context) {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('saree') || lowerMessage.includes('শাড়ি')) {
      return ['Show me red sarees', 'Traditional silk sarees', 'Wedding saree collection', 'Budget-friendly sarees'];
    }
    if (lowerMessage.includes('punjabi') || lowerMessage.includes('পাঞ্জাবি')) {
      return ['Men\'s punjabi collection', 'Wedding punjabi', 'Casual punjabi', 'Designer punjabi'];
    }
    if (lowerMessage.includes('size') || lowerMessage.includes('measurement')) {
      return ['Size guide', 'Virtual try-on', 'Measurements help', 'Fit recommendations'];
    }
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('৳')) {
      return ['Current deals', 'Budget options', 'Premium collection', 'Sale items'];
    }
    
    return ['Show me new arrivals', 'Help me find an outfit', 'What\'s my size?', 'Track my order'];
  }

  getFallbackResponse(userMessage, context) {
    const responses = {
      greeting: [
        "Hello! I'm your AI fashion assistant. How can I help you find the perfect outfit today?",
        "Welcome to GenAI Fashion! I'm here to help you discover amazing fashion pieces. What are you looking for?"
      ],
      general: [
        "I'd love to help you with that! Could you tell me more about what you're looking for?",
        "That's interesting! Let me help you find the perfect fashion solution. What specific style are you interested in?"
      ]
    };

    const isGreeting = /hello|hi|hey|good morning|good afternoon/i.test(userMessage);
    const category = isGreeting ? 'greeting' : 'general';
    const response = responses[category][Math.floor(Math.random() * responses[category].length)];

    return {
      success: true,
      content: response,
      suggestions: this.generateSuggestions(userMessage, context)
    };
  }
}

module.exports = new GeminiService(); 