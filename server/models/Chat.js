const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    intent: String, // e.g., 'gold_purchase', 'price_inquiry', 'portfolio_check'
    confidence: Number,
    shouldOfferPurchase: Boolean,
    requireLogin: Boolean,
    suggestedAmount: Number,
    goldPrice: Number
  }
})

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for anonymous users
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  conversationSummary: {
    userIntent: String,
    topicsDiscussed: [String],
    purchaseInterest: {
      type: Boolean,
      default: false
    },
    lastGoldPriceShown: Number
  }
}, {
  timestamps: true
})

// Update last activity on message add
chatSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastActivity = new Date()
  }
  next()
})

// Add message method
chatSchema.methods.addMessage = function(role, content, metadata = {}) {
  // Validate required fields before adding
  if (!role || typeof role !== 'string' || role.trim().length === 0) {
    throw new Error('Message role is required and must be a non-empty string')
  }
  
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    console.error('Invalid content provided to addMessage:', { role, content, metadata })
    throw new Error('Message content is required and must be a non-empty string')
  }
  
  // Ensure role is valid
  const validRoles = ['user', 'assistant']
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`)
  }
  
  this.messages.push({
    role: role.trim(),
    content: content.trim(),
    metadata: metadata || {}
  })
  
  // Update conversation summary based on message
  if (role === 'user' && content.toLowerCase().includes('gold')) {
    this.conversationSummary.purchaseInterest = true
    this.conversationSummary.topicsDiscussed.push('gold_investment')
  }
  
  return this.save()
}

// Get conversation context for AI
chatSchema.methods.getContextForAI = function(limit = 10) {
  const recentMessages = this.messages
    .slice(-limit)
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  
  return {
    messages: recentMessages,
    summary: this.conversationSummary,
    userId: this.userId
  }
}

// Static method to create or get session
chatSchema.statics.getOrCreateSession = async function(sessionId, userId = null) {
  let chat = await this.findOne({ sessionId, isActive: true })
  
  if (!chat) {
    chat = new this({
      sessionId,
      userId,
      messages: [{
        role: 'assistant',
        content: 'Welcome to AuroraGold! I\'m Aurora AI, your personal finance assistant. How can I help you today?',
        metadata: { intent: 'greeting' }
      }],
      conversationSummary: {
        topicsDiscussed: [],
        purchaseInterest: false
      }
    })
    await chat.save()
  }
  
  return chat
}

// Static method to get user's chat history
chatSchema.statics.getUserChats = function(userId, limit = 5) {
  return this.find({ userId, isActive: true })
    .sort({ lastActivity: -1 })
    .limit(limit)
    .select('sessionId lastActivity conversationSummary createdAt')
}

module.exports = mongoose.model('Chat', chatSchema)