const express = require('express')
const { v4: uuidv4 } = require('uuid')
const Chat = require('../models/Chat')
const chatbotService = require('../services/chatbot')
const goldPriceService = require('../services/goldPrice')
const { optionalAuth } = require('../middleware/auth')

const router = express.Router()

// POST /api/chat - Send message to AI
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { message, sessionId: providedSessionId } = req.body
    const userId = req.user?._id || null
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' })
    }
    
    // Generate or use provided session ID
    const sessionId = providedSessionId || uuidv4()
    
    // Get or create chat session
    const chat = await Chat.getOrCreateSession(sessionId, userId)
    
    // Add user message to chat
    await chat.addMessage('user', message.trim())
    
    // Get conversation context
    const context = {
      userId,
      conversationHistory: chat.getContextForAI().messages,
      currentGoldPrice: (await goldPriceService.getCurrentPrice()).price
    }
    
    // Process message with AI
    const aiResponse = await chatbotService.processMessage(message, context)
    
    // Robust AI response handling - ensure required fields exist with multiple fallbacks
    let responseMessage = aiResponse?.message || aiResponse?.reply || null
    
    // Critical validation: ensure responseMessage is never null/undefined/empty
    if (!responseMessage || typeof responseMessage !== 'string' || responseMessage.trim().length === 0) {
      responseMessage = 'I apologize for the technical difficulty. How can I help you with gold investment today?'
      console.warn('Using fallback message due to invalid AI response:', aiResponse)
    }
    
    // Ensure responseMessage is trimmed and valid
    responseMessage = responseMessage.trim()
    
    const responseMetadata = aiResponse?.metadata || {}
        
    // Add AI response to chat with fallback values - with final validation
    try {
      await chat.addMessage('assistant', responseMessage, {
        intent: responseMetadata.intent || aiResponse?.intent || 'general',
        confidence: responseMetadata.confidence || aiResponse?.confidence || 0.5,
        shouldOfferPurchase: aiResponse?.shouldOfferPurchase || false,
        requireLogin: aiResponse?.requireLogin || false,
        suggestedAmount: aiResponse?.suggestedAmount || null,
        goldPrice: context.currentGoldPrice,
        suggestions: aiResponse?.suggestions || [],
        source: aiResponse?.source || 'ai'
      })
    } catch (saveError) {
      console.error('Failed to save AI message to database:', saveError)
      // Create a minimal valid message if the save fails
      await chat.addMessage('assistant', 'I\'m ready to help you with gold investment. What would you like to know?', {
        intent: 'general',
        confidence: 0.5,
        shouldOfferPurchase: true,
        requireLogin: false,
        suggestedAmount: null,
        goldPrice: context.currentGoldPrice,
        suggestions: ['Check gold prices', 'Investment advice', 'Buy gold'],
        source: 'fallback_save'
      })
    }
    
    // Prepare response with lenient handling
    const response = {
      sessionId,
      message: {
        id: chat.messages[chat.messages.length - 1]._id,
        content: responseMessage,
        timestamp: new Date(),
        suggestions: aiResponse.suggestions || []
      },
      ai: {
        shouldOfferPurchase: aiResponse.shouldOfferPurchase || false,
        requireLogin: aiResponse.requireLogin || false,
        suggestedAmount: aiResponse.suggestedAmount || null,
        intent: responseMetadata.intent || aiResponse.intent || 'general',
        confidence: responseMetadata.confidence || aiResponse.confidence || 0.5,
        source: aiResponse.source || 'ai'
      },
      context: {
        goldPrice: context.currentGoldPrice,
        isLoggedIn: !!userId,
        conversationLength: chat.messages.length
      }
    }
    
    res.json(response)
  } catch (error) {
    console.error('Chat API error:', error)
    
    // Lenient error handling - try to provide a helpful response even if AI fails
    try {
      const sessionId = req.body.sessionId || uuidv4()
      const fallbackMessage = 'I apologize for the technical difficulty. Gold is currently a stable investment option. How can I help you today?'
      
      res.json({
        sessionId,
        message: {
          id: new Date().getTime(), // Simple fallback ID
          content: fallbackMessage,
          timestamp: new Date(),
          suggestions: ['Check current gold prices', 'Investment advice', 'Start small with ₹500']
        },
        ai: {
          shouldOfferPurchase: true,
          requireLogin: false,
          suggestedAmount: 500,
          intent: 'general',
          confidence: 0.5,
          source: 'fallback'
        },
        context: {
          goldPrice: 6850, // Default reasonable price
          isLoggedIn: !!req.user,
          conversationLength: 1
        },
        error: 'AI_FALLBACK' // Indicate this is a fallback response
      })
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError)
      res.status(500).json({ 
        error: 'Failed to process message',
        message: 'I apologize, but I\'m having technical difficulties. Please try again in a moment.'
      })
    }
  }
})

// GET /api/chat/:sessionId - Get chat history
router.get('/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user?._id || null
    
    const chat = await Chat.findOne({ 
      sessionId, 
      isActive: true,
      $or: [
        { userId: userId },
        { userId: null } // Allow access to anonymous chats
      ]
    })
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' })
    }
    
    const messages = chat.messages.map(msg => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata
    }))
    
    res.json({
      sessionId,
      messages,
      summary: chat.conversationSummary,
      lastActivity: chat.lastActivity,
      isActive: chat.isActive
    })
  } catch (error) {
    console.error('Chat history error:', error)
    res.status(500).json({ error: 'Failed to fetch chat history' })
  }
})

// GET /api/chat - Get user's chat sessions (requires auth)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const chats = await Chat.getUserChats(userId, 10)
    
    const sessions = chats.map(chat => ({
      sessionId: chat.sessionId,
      lastActivity: chat.lastActivity,
      summary: chat.conversationSummary,
      createdAt: chat.createdAt,
      messageCount: chat.messages?.length || 0
    }))
    
    res.json({ sessions })
  } catch (error) {
    console.error('Chat sessions error:', error)
    res.status(500).json({ error: 'Failed to fetch chat sessions' })
  }
})

// DELETE /api/chat/:sessionId - Delete chat session
router.delete('/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user?._id
    
    const query = { sessionId, isActive: true }
    if (userId) {
      query.userId = userId
    }
    
    const chat = await Chat.findOne(query)
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' })
    }
    
    chat.isActive = false
    await chat.save()
    
    res.json({ message: 'Chat session deleted successfully' })
  } catch (error) {
    console.error('Chat deletion error:', error)
    res.status(500).json({ error: 'Failed to delete chat session' })
  }
})

// POST /api/chat/:sessionId/feedback - Submit feedback on AI response
router.post('/:sessionId/feedback', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params
    const { messageId, rating, feedback } = req.body
    const userId = req.user?._id || null
    
    const chat = await Chat.findOne({ sessionId, isActive: true })
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' })
    }
    
    const message = chat.messages.id(messageId)
    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }
    
    // Add feedback to message metadata
    if (!message.metadata) message.metadata = {}
    message.metadata.feedback = {
      rating: rating,
      comment: feedback,
      timestamp: new Date(),
      userId: userId
    }
    
    await chat.save()
    
    res.json({ message: 'Feedback submitted successfully' })
  } catch (error) {
    console.error('Feedback submission error:', error)
    res.status(500).json({ error: 'Failed to submit feedback' })
  }
})

module.exports = router