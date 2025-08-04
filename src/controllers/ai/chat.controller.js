const GeminiService = require('../../services/gemini.service');
const { body, validationResult } = require('express-validator');

class ChatController {
  async sendMessage(req, res) {
    try {
      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { message, context = {} } = req.body;
      const userId = req.user?.id;

      // Build enhanced context
      const enhancedContext = {
        ...context,
        userId,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        sessionId: req.session?.id
      };

      // Generate AI response with product search
      const aiResponse = await GeminiService.generateResponse(message, enhancedContext);

      // Log interaction for analytics
      ChatController.logChatInteraction(userId, message, aiResponse, enhancedContext);

      res.json({
        success: true,
        data: {
          response: aiResponse.content,
          suggestions: aiResponse.suggestions,
          products: aiResponse.products || [], // Include found products
          searchQuery: aiResponse.searchQuery || null,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Chat controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process chat message'
      });
    }
  }

  static logChatInteraction(userId, userMessage, aiResponse, context) {
    console.log('Chat Interaction:', {
      userId,
      userMessage,
      aiResponse: aiResponse.content,
      productsFound: aiResponse.products?.length || 0,
      searchQuery: aiResponse.searchQuery,
      context,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new ChatController(); 