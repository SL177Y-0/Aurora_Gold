const express = require('express')
const User = require('../models/User')
const Order = require('../models/Order')
const goldPriceService = require('../services/goldPrice')
const { authenticateToken } = require('../middleware/auth')

const router = express.Router()

// GET /api/user/portfolio - Get user's complete portfolio
router.get('/portfolio', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id
    const currentPriceData = await goldPriceService.getCurrentPrice()
    const currentPrice = currentPriceData.price
    
    // Get user with current assets
    const user = await User.findById(userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Calculate current portfolio value
    const currentValue = user.calculatePortfolioValue(currentPrice)
    const profitLoss = user.calculateProfitLoss(currentPrice)
    const profitLossPercent = user.assets.totalInvested > 0 
      ? ((profitLoss / user.assets.totalInvested) * 100).toFixed(2)
      : 0
    
    // Get recent transactions
    const recentOrders = await Order.find({ userId, status: 'COMPLETED' })
      .sort({ createdAt: -1 })
      .limit(5)
    
    // Calculate today's P&L based on actual price movements
    // Note: In production, this would be calculated from actual historical price data
    const todayChange = 0
    const todayChangePercent = 0
    
    const portfolio = {
      summary: {
        totalGoldGrams: user.assets.goldGrams,
        avgPrice: user.assets.avgPrice,
        totalInvested: user.assets.totalInvested,
        currentValue: Math.round(currentValue),
        profitLoss: Math.round(profitLoss),
        profitLossPercent: parseFloat(profitLossPercent),
        currentGoldPrice: currentPrice,
        lastUpdated: currentPriceData.timestamp
      },
      todayPerformance: {
        change: Math.round(todayChange),
        changePercent: parseFloat(todayChangePercent.toString()),
        trend: todayChange >= 0 ? 'up' : 'down'
      },
      recentTransactions: recentOrders.map(order => ({
        id: order._id,
        date: order.createdAt,
        type: 'BUY',
        amountINR: order.amountINR,
        grams: order.grams,
        pricePerGram: order.pricePerGram,
        status: order.status
      })),
      goalProgress: {
        target: user.preferences.investmentGoal,
        achieved: user.assets.totalInvested,
        percentage: Math.min(100, (user.assets.totalInvested / user.preferences.investmentGoal) * 100).toFixed(1)
      }
    }
    
    res.json({ portfolio })
  } catch (error) {
    console.error('Portfolio fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch portfolio' })
  }
})

module.exports = router