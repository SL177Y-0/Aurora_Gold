const axios = require('axios')
const goldPriceService = require('./goldPrice')

class ChatbotService {
  constructor() {
    // Gemini 1.5 Flash API configuration (optimized for token efficiency)
    this.geminiApiKey = process.env.GEMINI_API_KEY
    this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'
    
    // Optimized caching for better user experience
    this.responseCache = new Map()
    this.cacheExpiry = 20 * 60 * 1000 // 20 minutes cache (balanced)
    
    // Request throttling for efficiency
    this.requestQueue = []
    this.processing = false
    this.lastRequestTime = 0
    this.minRequestInterval = 3000 // 3 seconds between requests (more responsive)
    
    // Fallback responses when API limit is reached
    this.fallbackResponses = {
      greeting: {
        message: "Hello! I'm Aurora AI, your gold investment assistant. Ready to explore smart gold investments?",
        suggestions: ["Check gold prices", "Visit Buy Gold page", "Investment advice"]
      },
      gold_general: {
        message: "Gold is a stable investment option. Visit our Buy Gold page for current market conditions and easy investing!",
        suggestions: ["Go to Buy Gold page", "Buy ₹500 gold", "Check portfolio"]
      },
      purchase_intent: {
        message: "Great choice! Visit the Buy Gold page to start investing. I recommend starting with ₹1000 - ₹2500 for diversification.",
        suggestions: ["Visit Buy Gold page", "Buy ₹1000", "Learn more"]
      },
      portfolio_check: {
        message: "To check your portfolio, please log in. After investing on the Buy Gold page, you can track your holdings!",
        suggestions: ["Login", "Visit Buy Gold page", "Investment tips"]
      }
    }
    
    // Simplified prompt for clean text responses
    this.systemPrompt = `You are Aurora AI, a helpful gold investment assistant. Respond naturally and conversationally about gold investment topics. Keep responses brief (1-2 sentences), helpful, and encouraging. When users show interest in buying gold, suggest they visit the Buy Gold page for easy investing with amounts like ₹500, ₹1000, ₹2500, or ₹5000. Do not use JSON format - just provide a natural, helpful response.`

    this.goldInvestmentKeywords = [
      'gold', 'invest', 'buy', 'purchase', 'portfolio', 'price', 'rate',
      'savings', 'money', 'investment', 'returns', 'profit', 'market'
    ]
  }

  // Main chat processing method with heavy optimization for free tier
  async processMessage(message, context = {}) {
    try {
      const { userId, conversationHistory = [], currentGoldPrice } = context
      
      // Check cache first (30 minute cache)
      const cacheKey = `${message.toLowerCase().trim()}_${userId || 'guest'}`
      const cachedResponse = this.getCachedResponse(cacheKey)
      if (cachedResponse) {
        return cachedResponse
      }
      
      // Get current gold price if not provided
      const goldPrice = currentGoldPrice || (await goldPriceService.getCurrentPrice()).price
      
      // Analyze user intent
      const intent = this.analyzeIntent(message)
      
      let response
      
      // Try AI response with throttling, fallback to predefined responses
      if (this.shouldUseAI() && await this.checkApiAvailability()) {
        try {
          response = await this.getThrottledAIResponse(message, intent, goldPrice, userId)
        } catch (error) {
          console.warn('Gemini API failed, using fallback:', error.message)
          response = this.getFallbackResponse(intent, goldPrice)
        }
      } else {
        // Use fallback responses to save API calls
        response = this.getFallbackResponse(intent, goldPrice)
      }
      
      // Cache the response
      this.setCachedResponse(cacheKey, response)
      
      return {
        ...response,
        metadata: {
          intent: intent.category,
          confidence: intent.confidence,
          goldPrice,
          timestamp: new Date(),
          source: response.source || 'ai'
        }
      }
    } catch (error) {
      console.error('Chatbot processing error:', error)
      return this.getErrorResponse()
    }
  }

  // Analyze user intent from message
  analyzeIntent(message) {
    const lowerMessage = message.toLowerCase()
    
    // Gold investment intent
    const goldKeywords = this.goldInvestmentKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    )
    
    if (goldKeywords.length > 0) {
      if (lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
        return { category: 'purchase_intent', confidence: 0.9, keywords: goldKeywords }
      }
      if (lowerMessage.includes('price') || lowerMessage.includes('rate')) {
        return { category: 'price_inquiry', confidence: 0.8, keywords: goldKeywords }
      }
      if (lowerMessage.includes('portfolio') || lowerMessage.includes('holdings')) {
        return { category: 'portfolio_check', confidence: 0.9, keywords: goldKeywords }
      }
      return { category: 'gold_general', confidence: 0.7, keywords: goldKeywords }
    }
    
    // Greeting
    if (lowerMessage.match(/^(hi|hello|hey|good|greetings)/)) {
      return { category: 'greeting', confidence: 0.9, keywords: [] }
    }
    
    return { category: 'general', confidence: 0.5, keywords: [] }
  }

  // Cache management methods
  getCachedResponse(key) {
    const cached = this.responseCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.response
    }
    this.responseCache.delete(key)
    return null
  }
  
  setCachedResponse(key, response) {
    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    })
    
    // Limit cache size to prevent memory issues
    if (this.responseCache.size > 100) {
      const firstKey = this.responseCache.keys().next().value
      this.responseCache.delete(firstKey)
    }
  }
  
  // Check if we should use AI (throttling logic)
  shouldUseAI() {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    return timeSinceLastRequest >= this.minRequestInterval
  }
  
  // Check API availability for Gemini
  async checkApiAvailability() {
    return this.geminiApiKey && this.geminiApiKey !== 'your-gemini-api-key-here'
  }
  
  // Get AI response with throttling
  async getThrottledAIResponse(message, intent, goldPrice, userId) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ message, intent, goldPrice, userId, resolve, reject })
      this.processQueue()
    })
  }
  
  // Process request queue with throttling
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return
    
    this.processing = true
    
    while (this.requestQueue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest))
      }
      
      const request = this.requestQueue.shift()
      try {
        const response = await this.getGeminiResponse(request.message, request.intent, request.goldPrice, request.userId)
        this.lastRequestTime = Date.now()
        request.resolve(response)
      } catch (error) {
        request.reject(error)
      }
    }
    
    this.processing = false
  }
  
  // Get Gemini 1.5 Flash response using ultra-optimized prompts
  async getGeminiResponse(message, intent, goldPrice, userId) {
    try {
      // Improved prompt with clearer context
      const prompt = `Context: Gold price ₹${goldPrice}/gram. User: ${userId ? 'logged in' : 'guest'}. Message: "${message}". ${this.systemPrompt}`
      
      console.log('Chatbot Gemini Request:', { prompt: prompt.substring(0, 100) + '...', intent: intent.category })
      
      const requestBody = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          maxOutputTokens: 120, // Slightly more for complete JSON responses
          temperature: 0.3, // Lower temperature for more consistent JSON
          topP: 0.8
        }
      }
      
      const response = await axios.post(
        `${this.geminiApiUrl}?key=${this.geminiApiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      )
      
      console.log('Chatbot Gemini Response Status:', response.status)
      
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiText = response.data.candidates[0].content.parts[0].text.trim()
        console.log('Chatbot Gemini Response Text:', aiText)
        return this.parseGeminiResponse(aiText, intent, goldPrice)
      }
      
      throw new Error('Invalid Gemini API response')
    } catch (error) {
      console.error('Chatbot Gemini API error:', error.response?.data || error.message)
      throw error
    }
  }
  
  // Parse Gemini response with priority for clean text
  parseGeminiResponse(aiText, intent, goldPrice) {
    console.log('Parsing chatbot response:', aiText)
    
    try {
      // Strategy 1: If it looks like clean text (preferred), use it directly
      if (!aiText.startsWith('{') && !aiText.includes('"message"') && aiText.length < 300) {
        console.log('Using clean text response')
        const response = {
          message: aiText.trim(),
          suggestions: this.getDefaultSuggestions(intent),
          source: 'gemini_text',
          metadata: {
            intent: intent.category,
            confidence: intent.confidence || 0.9,
            goldPrice,
            timestamp: new Date(),
            source: 'gemini_text'
          },
          // Legacy compatibility fields
          shouldOfferPurchase: intent.category === 'purchase_intent',
          requireLogin: intent.category === 'portfolio_check',
          suggestedAmount: intent.category === 'purchase_intent' ? 1000 : null
        }
        console.log('Returning clean text response:', { message: response.message, hasMessage: !!response.message })
        return response
      }
      
      // Strategy 2: Try to find complete JSON object (backup)
      const jsonMatch = aiText.match(/\{[^{}]*"message"[^{}]*"suggestions"[^{}]*\}/)
      if (jsonMatch) {
        console.log('Found JSON match:', jsonMatch[0])
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.message && parsed.suggestions) {
          console.log('Successfully parsed JSON response')
          const response = {
            message: parsed.message,
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : this.getDefaultSuggestions(intent),
            source: 'gemini_json',
            metadata: {
              intent: intent.category,
              confidence: intent.confidence || 0.8,
              goldPrice,
              timestamp: new Date(),
              source: 'gemini_json'
            },
            // Legacy compatibility fields
            shouldOfferPurchase: intent.category === 'purchase_intent',
            requireLogin: intent.category === 'portfolio_check',
            suggestedAmount: intent.category === 'purchase_intent' ? 1000 : null
          }
          console.log('Returning parsed JSON response:', { message: response.message, hasMessage: !!response.message })
          return response
        }
      }
      
      // Strategy 3: Extract message from any JSON structure
      const messageMatch = aiText.match(/"message"\s*:\s*"([^"]+)"/)
      if (messageMatch && messageMatch[1]) {
        console.log('Extracted message from JSON:', messageMatch[1])
        const response = {
          message: messageMatch[1],
          suggestions: this.getDefaultSuggestions(intent),
          source: 'gemini_extracted',
          metadata: {
            intent: intent.category,
            confidence: intent.confidence || 0.7,
            goldPrice,
            timestamp: new Date(),
            source: 'gemini_extracted'
          },
          // Legacy compatibility fields
          shouldOfferPurchase: intent.category === 'purchase_intent',
          requireLogin: intent.category === 'portfolio_check',
          suggestedAmount: intent.category === 'purchase_intent' ? 1000 : null
        }
        console.log('Returning extracted response:', { message: response.message, hasMessage: !!response.message })
        return response
      }
      
      // Strategy 4: Use first sentence if response is too long
      if (aiText.length > 200) {
        const firstSentence = aiText.split('.')[0] + '.'
        if (firstSentence.length > 10 && firstSentence.length < 200) {
          console.log('Using first sentence of long response')
          const response = {
            message: firstSentence.trim(),
            suggestions: this.getDefaultSuggestions(intent),
            source: 'gemini_truncated',
            metadata: {
              intent: intent.category,
              confidence: intent.confidence || 0.6,
              goldPrice,
              timestamp: new Date(),
              source: 'gemini_truncated'
            },
            // Legacy compatibility fields
            shouldOfferPurchase: intent.category === 'purchase_intent',
            requireLogin: intent.category === 'portfolio_check',
            suggestedAmount: intent.category === 'purchase_intent' ? 1000 : null
          }
          console.log('Returning truncated response:', { message: response.message, hasMessage: !!response.message })
          return response
        }
      }
      
      // Fallback: Use the text as-is if it's reasonable length
      console.log('Using fallback with original text')
      const response = {
        message: aiText.length < 300 ? aiText.trim() : `I'm here to help you with gold investment. Current price is ₹${goldPrice}/g.`,
        suggestions: this.getDefaultSuggestions(intent),
        source: 'gemini_fallback',
        metadata: {
          intent: intent.category,
          confidence: intent.confidence || 0.5,
          goldPrice,
          timestamp: new Date(),
          source: 'gemini_fallback'
        },
        // Legacy compatibility fields
        shouldOfferPurchase: intent.category === 'purchase_intent',
        requireLogin: intent.category === 'portfolio_check',
        suggestedAmount: intent.category === 'purchase_intent' ? 1000 : null
      }
      console.log('Returning fallback response:', { message: response.message, hasMessage: !!response.message })
      return response
    } catch (error) {
      console.error('Failed to parse Gemini chatbot response:', error)
      const fallbackResponse = this.getFallbackResponse(intent, goldPrice)
      console.log('Returning error fallback response:', { message: fallbackResponse.message, hasMessage: !!fallbackResponse.message })
      return fallbackResponse
    }
  }
  
  // Get fallback responses when AI is unavailable
  getFallbackResponse(intent, goldPrice) {
    const baseResponse = this.fallbackResponses[intent.category] || this.fallbackResponses.gold_general
    
    // Enhanced fallback with consistent structure and legacy compatibility
    return {
      message: baseResponse.message.replace('Rs XXX', `₹${goldPrice || 6850}`),
      suggestions: baseResponse.suggestions || ['Check gold prices', 'Investment advice', 'Portfolio help'],
      source: 'fallback',
      metadata: {
        intent: intent.category,
        confidence: intent.confidence || 0.5,
        goldPrice: goldPrice || 6850,
        timestamp: new Date(),
        source: 'fallback'
      },
      // Legacy compatibility fields for lenient operation
      shouldOfferPurchase: intent.category === 'purchase_intent',
      requireLogin: intent.category === 'portfolio_check',
      suggestedAmount: intent.category === 'purchase_intent' ? 1000 : null
    }
  }
  
  // Get default suggestions based on intent
  getDefaultSuggestions(intent) {
    const suggestionMap = {
      greeting: ["Check gold prices", "Investment advice", "Portfolio help"],
      gold_general: ["Buy ₹500 gold", "Buy ₹1000 gold", "Check portfolio"],
      purchase_intent: ["Buy ₹1000", "Buy ₹2500", "Learn more"],
      portfolio_check: ["Login", "Sign up", "Investment tips"],
      price_inquiry: ["Buy now", "Set alert", "Price history"]
    }
    
    return suggestionMap[intent.category] || suggestionMap.gold_general
  }

  // Error response with enhanced structure for lenient operation
  getErrorResponse() {
    return {
      message: "I apologize, but I'm having a temporary issue. Let me help you with gold investment opportunities - would you like to know about current gold prices?",
      suggestions: ["Check gold prices", "Investment advice", "Try again"],
      source: 'error',
      metadata: {
        error: true,
        intent: 'error',
        confidence: 0.3,
        goldPrice: 6850,
        timestamp: new Date(),
        source: 'error'
      },
      // Legacy compatibility fields for lenient operation
      shouldOfferPurchase: true,
      requireLogin: false,
      suggestedAmount: 500
    }
  }
}

module.exports = new ChatbotService()