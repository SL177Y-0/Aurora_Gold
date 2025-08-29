const axios = require('axios')

class GoldPriceService {
  constructor() {
    this.cache = {
      price: null,
      lastUpdated: null,
      cacheDuration: 3 * 60 * 1000 // 3 minutes cache (balanced for Gemini)
    }
    
    // Gemini 1.5 Flash API configuration
    this.geminiApiKey = process.env.GEMINI_API_KEY
    this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'
    
    // Optimized pricing parameters
    this.basePrice = 6800 // Base gold price in INR
    this.priceVariation = 200 // +/- variation
    
    // Smart AI usage - less frequent but more accurate
    this.lastAiFetch = 0
    this.aiFetchInterval = 10 * 60 * 1000 // 10 minutes between AI calls
  }

  // Get current gold price with caching
  async getCurrentPrice() {
    const now = Date.now()
    
    // Return cached price if still valid
    if (this.cache.price && 
        this.cache.lastUpdated && 
        (now - this.cache.lastUpdated) < this.cache.cacheDuration) {
      return {
        price: this.cache.price,
        source: 'cache',
        timestamp: new Date(this.cache.lastUpdated),
        currency: 'INR'
      }
    }

    try {
      // Try to fetch from external API
      const price = await this.fetchFromAPI()
      
      // Update cache
      this.cache.price = price
      this.cache.lastUpdated = now
      
      return {
        price,
        source: 'api',
        timestamp: new Date(now),
        currency: 'INR'
      }
    } catch (error) {
      console.error('Gold API error details:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      
      // Return cached price if available, otherwise throw error
      if (this.cache.price && this.cache.lastUpdated) {
        console.log('Returning cached price due to API error:', this.cache.price)
        return {
          price: this.cache.price,
          source: 'cache_fallback',
          timestamp: new Date(this.cache.lastUpdated),
          currency: 'INR',
          error: 'API temporarily unavailable'
        }
      }
      
      throw new Error('Gold price service unavailable and no cached data available')
    }
  }

  // Fetch from API with optimized Gemini usage and better error handling
  async fetchFromAPI() {
    const now = Date.now()
    
    // Use Gemini every 10 minutes for more accurate pricing
    if (this.geminiApiKey && 
        this.geminiApiKey !== 'your-gemini-api-key-here' && 
        (now - this.lastAiFetch) >= this.aiFetchInterval) {
      try {
        console.log('Attempting to fetch gold price from Gemini API...')
        const aiPrice = await this.fetchFromGemini()
        this.lastAiFetch = now
        console.log('Successfully fetched price from Gemini:', aiPrice)
        return aiPrice
      } catch (error) {
        console.warn('Gemini API failed, using simulated price:', {
          message: error.message,
          stack: error.stack,
          response: error.response?.data
        })
      }
    } else {
      const timeUntilNext = this.aiFetchInterval - (now - this.lastAiFetch)
      console.log(`Skipping Gemini API call. Next call in ${Math.round(timeUntilNext / 1000)} seconds`)
    }
    
    // Use simulated realistic price with minor fluctuations
    const simulatedPrice = this.generateRealisticPrice()
    console.log('Using simulated price:', simulatedPrice)
    return simulatedPrice
  }
  
  // Generate realistic price with minor fluctuations
  generateRealisticPrice() {
    const now = Date.now()
    const hourOfDay = new Date().getHours()
    
    // Simulate market fluctuations based on time
    const timeVariation = Math.sin((hourOfDay / 24) * Math.PI * 2) * 50
    const randomVariation = (Math.random() - 0.5) * 100
    
    const price = Math.round(this.basePrice + timeVariation + randomVariation)
    
    // Ensure price stays within reasonable bounds
    return Math.max(6200, Math.min(7200, price))
  }

  // Fetch gold price using Gemini 1.5 Flash (robust implementation)
  async fetchFromGemini() {
    try {
      // Improved prompt that asks for estimate in realistic range
      const prompt = `Give me an approximate 24k gold price per gram in Indian Rupees (current range 6200-7200). Reply with just a number like 6850.`
      
      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 30, // Slightly more for clearer responses
          temperature: 0.1, // Lower temperature for more predictable responses
          topP: 0.8
        }
      }
      
      console.log('Gemini Request:', { prompt, config: requestBody.generationConfig })
      
      const response = await axios.post(
        `${this.geminiApiUrl}?key=${this.geminiApiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000 // Increased timeout
        }
      )
      
      console.log('Gemini Response Status:', response.status)
      console.log('Gemini Response Data:', JSON.stringify(response.data, null, 2))
      
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = response.data.candidates[0].content.parts[0].text.trim()
        console.log('Gemini Response Text:', text)
        
        const price = this.parseGoldPriceFromText(text)
        if (price) {
          console.log('Successfully parsed price:', price)
          return price
        }
      }
      
      throw new Error(`Invalid Gemini response format. Response: ${JSON.stringify(response.data)}`)
    } catch (error) {
      console.error('Gemini gold price error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      })
      throw error
    }
  }
  
  // Robust price parsing with multiple strategies
  parseGoldPriceFromText(text) {
    console.log('Parsing text for price:', text)
    
    // Strategy 1: Find standalone numbers (most common)
    const numberMatch = text.match(/\b(\d{4,5})\b/)
    if (numberMatch) {
      const price = parseInt(numberMatch[1])
      if (this.isValidGoldPrice(price)) {
        console.log('Found price using Strategy 1 (standalone number):', price)
        return price
      }
    }
    
    // Strategy 2: Find numbers with currency symbols or words
    const currencyMatches = [
      text.match(/₹\s*(\d{4,5})/), // ₹6850
      text.match(/Rs\.?\s*(\d{4,5})/i), // Rs 6850 or Rs. 6850
      text.match(/INR\s*(\d{4,5})/i), // INR 6850
      text.match(/rupees?\s*(\d{4,5})/i), // rupees 6850
      text.match(/(\d{4,5})\s*rupees?/i), // 6850 rupees
      text.match(/(\d{4,5})\s*INR/i), // 6850 INR
    ]
    
    for (const match of currencyMatches) {
      if (match) {
        const price = parseInt(match[1])
        if (this.isValidGoldPrice(price)) {
          console.log('Found price using Strategy 2 (currency format):', price)
          return price
        }
      }
    }
    
    // Strategy 3: Find numbers with commas (6,850)
    const commaMatch = text.match(/\b(\d{1,2},\d{3})\b/)
    if (commaMatch) {
      const price = parseInt(commaMatch[1].replace(',', ''))
      if (this.isValidGoldPrice(price)) {
        console.log('Found price using Strategy 3 (comma format):', price)
        return price
      }
    }
    
    // Strategy 4: Any sequence of 4-5 digits (last resort)
    const allNumbers = text.match(/\d{4,5}/g)
    if (allNumbers) {
      for (const numStr of allNumbers) {
        const price = parseInt(numStr)
        if (this.isValidGoldPrice(price)) {
          console.log('Found price using Strategy 4 (any digits):', price)
          return price
        }
      }
    }
    
    console.log('No valid price found in text using any strategy')
    return null
  }
  
  // Validate if a price is within reasonable gold price range (more flexible)
  isValidGoldPrice(price) {
    const isValid = price >= 5500 && price <= 8000 // Expanded range for AI responses
    console.log(`Validating price ${price}: ${isValid ? 'VALID' : 'INVALID'}`)
    return isValid
  }

  // Get price history - use efficient simulation to avoid AI costs
  async getPriceHistory(period = '1d') {
    try {
      // Generate realistic historical data without AI to save costs
      const currentPrice = this.cache.price || await this.generateRealisticPrice()
      const historyData = this.generatePriceHistory(currentPrice, period)
      
      return historyData
    } catch (error) {
      console.error('Historical price generation error:', error.message)
      throw new Error(`Historical price data unavailable: ${error.message}`)
    }
  }
  
  // Generate realistic price history without AI
  generatePriceHistory(currentPrice, period) {
    const now = new Date()
    const data = []
    
    let dataPoints, timeInterval, startTime
    
    switch (period) {
      case '1d':
        dataPoints = 24
        timeInterval = 60 * 60 * 1000 // 1 hour
        startTime = now.getTime() - (24 * 60 * 60 * 1000)
        break
      case '1w':
        dataPoints = 7
        timeInterval = 24 * 60 * 60 * 1000 // 1 day
        startTime = now.getTime() - (7 * 24 * 60 * 60 * 1000)
        break
      case '1m':
        dataPoints = 30
        timeInterval = 24 * 60 * 60 * 1000 // 1 day
        startTime = now.getTime() - (30 * 24 * 60 * 60 * 1000)
        break
      default:
        dataPoints = 24
        timeInterval = 60 * 60 * 1000
        startTime = now.getTime() - (24 * 60 * 60 * 1000)
    }
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(startTime + (i * timeInterval))
      
      // Generate realistic price variation
      const variation = (Math.random() - 0.5) * 200 // +/- 100 INR
      const trendVariation = Math.sin((i / dataPoints) * Math.PI) * 150
      const price = Math.round(currentPrice + variation + trendVariation)
      
      data.push({
        timestamp: timestamp.toISOString(),
        price: Math.max(6000, Math.min(7500, price)),
        volume: Math.floor(Math.random() * 1000) + 100
      })
    }
    
    return data
  }

  // Calculate price change percentage
  calculatePriceChange(currentPrice, previousPrice) {
    const change = currentPrice - previousPrice
    const changePercent = (change / previousPrice) * 100
    
    return {
      change: Math.round(change),
      changePercent: parseFloat(changePercent.toFixed(2)),
      trend: change >= 0 ? 'up' : 'down'
    }
  }

  // Force cache refresh
  async refreshPrice() {
    this.cache.price = null
    this.cache.lastUpdated = null
    return this.getCurrentPrice()
  }
  
  // Test method for debugging Gemini API responses
  async testGeminiAPI() {
    try {
      console.log('=== TESTING GEMINI API ===')
      console.log('API Key configured:', !!this.geminiApiKey)
      console.log('API URL:', this.geminiApiUrl)
      
      const price = await this.fetchFromGemini()
      console.log('=== TEST SUCCESSFUL ===')
      console.log('Retrieved price:', price)
      return { success: true, price }
    } catch (error) {
      console.log('=== TEST FAILED ===')
      console.error('Error details:', error)
      return { 
        success: false, 
        error: error.message,
        details: error.response?.data 
      }
    }
  }
}

module.exports = new GoldPriceService()