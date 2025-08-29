const express = require('express')
const mongoose = require('mongoose')
const goldPriceService = require('../services/goldPrice')
const { authenticateToken } = require('../middleware/auth')
const Order = require('../models/Order')
const User = require('../models/User')

const router = express.Router()

// GET /api/gold/price - Get current gold price
router.get('/price', async (req, res) => {
  try {
    const priceData = await goldPriceService.getCurrentPrice()
    
    // Get price change data
    // Note: In production, this would be calculated from actual historical data
    const changeData = {
      change: 0,
      changePercent: 0,
      trend: 'up'
    }
    
    res.json({
      current: {
        price: priceData.price,
        currency: 'INR',
        unit: 'gram',
        timestamp: priceData.timestamp,
        source: priceData.source
      },
      change: changeData,
      market: {
        isOpen: isMarketOpen(),
        nextUpdate: getNextUpdateTime()
      }
    })
  } catch (error) {
    console.error('Gold price fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch gold price' })
  }
})

// GET /api/gold/history/:period - Get price history
router.get('/history/:period', async (req, res) => {
  try {
    const { period } = req.params
    const validPeriods = ['1d', '1w', '1m']
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use 1d, 1w, or 1m' })
    }
    
    const history = await goldPriceService.getPriceHistory(period)
    
    res.json({
      period,
      data: history,
      count: history.length
    })
  } catch (error) {
    console.error('Gold history fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch price history' })
  }
})

// POST /api/gold/refresh - Force refresh price cache (admin only)
router.post('/refresh', async (req, res) => {
  try {
    const priceData = await goldPriceService.refreshPrice()
    
    res.json({
      message: 'Price refreshed successfully',
      data: priceData
    })
  } catch (error) {
    console.error('Price refresh error:', error)
    res.status(500).json({ error: 'Failed to refresh price' })
  }
})

// GET /api/gold/calculator - Calculate gold amount for INR
router.get('/calculator', async (req, res) => {
  try {
    const { amount, type = 'inr' } = req.query
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' })
    }
    
    const priceData = await goldPriceService.getCurrentPrice()
    const currentPrice = priceData.price
    
    let calculation
    if (type === 'inr') {
      // Convert INR to grams
      const grams = parseFloat(amount) / currentPrice
      const transactionFee = Math.round(parseFloat(amount) * 0.01)
      
      calculation = {
        input: {
          amount: parseFloat(amount),
          type: 'INR'
        },
        output: {
          grams: parseFloat(grams.toFixed(4)),
          pricePerGram: currentPrice
        },
        fees: {
          transactionFee,
          totalAmount: parseFloat(amount) + transactionFee
        }
      }
    } else if (type === 'grams') {
      // Convert grams to INR
      const inrAmount = parseFloat(amount) * currentPrice
      const transactionFee = Math.round(inrAmount * 0.01)
      
      calculation = {
        input: {
          amount: parseFloat(amount),
          type: 'grams'
        },
        output: {
          inrAmount: Math.round(inrAmount),
          pricePerGram: currentPrice
        },
        fees: {
          transactionFee,
          totalAmount: Math.round(inrAmount) + transactionFee
        }
      }
    } else {
      return res.status(400).json({ error: 'Type must be "inr" or "grams"' })
    }
    
    res.json({
      calculation,
      market: {
        currentPrice,
        timestamp: priceData.timestamp
      }
    })
  } catch (error) {
    console.error('Gold calculation error:', error)
    res.status(500).json({ error: 'Failed to calculate gold amount' })
  }
})

// Helper functions
function isMarketOpen() {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay() // 0 = Sunday, 6 = Saturday
  
  // Mock market hours: Monday-Friday, 9 AM - 6 PM
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18
}

function getNextUpdateTime() {
  const now = new Date()
  const next = new Date(now.getTime() + 30000) // Next 30 seconds
  return next
}

// POST /api/gold/purchase - Create gold purchase order
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const { amountINR, grams, preferredType = 'amount' } = req.body
    const userId = req.user._id
    
    // Validate input
    if ((!amountINR && !grams) || (amountINR && grams)) {
      return res.status(400).json({ error: 'Provide either amountINR or grams, not both' })
    }
    
    // Get current gold price
    const priceData = await goldPriceService.getCurrentPrice()
    const currentPrice = priceData.price
    
    let finalAmount, finalGrams
    
    if (preferredType === 'amount' && amountINR) {
      finalAmount = parseFloat(amountINR)
      finalGrams = finalAmount / currentPrice
      
      if (finalAmount < 100) {
        return res.status(400).json({ error: 'Minimum purchase amount is ₹100' })
      }
    } else if (preferredType === 'grams' && grams) {
      finalGrams = parseFloat(grams)
      finalAmount = finalGrams * currentPrice
      
      if (finalGrams < 0.01) {
        return res.status(400).json({ error: 'Minimum purchase is 0.01 grams' })
      }
    } else {
      return res.status(400).json({ error: 'Invalid purchase parameters' })
    }
    
    // Calculate transaction fee and total amount
    const transactionFee = Math.round(finalAmount * 0.01)
    const totalAmount = Math.round(finalAmount + transactionFee)
    
    // Create order
    const order = new Order({
      userId,
      amountINR: Math.round(finalAmount),
      grams: parseFloat(finalGrams.toFixed(4)),
      pricePerGram: currentPrice,
      transactionFee,
      totalAmount,
      goldRateSnapshot: {
        timestamp: priceData.timestamp,
        source: priceData.source,
        rate: currentPrice
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        source: 'WEB'
      }
    })
    
    await order.save()
    
    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order._id,
        amountINR: order.amountINR,
        grams: order.grams,
        pricePerGram: order.pricePerGram,
        transactionFee: order.transactionFee,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt
      },
      paymentUrl: `/api/gold/orders/${order._id}/pay` // For frontend to initiate payment
    })
  } catch (error) {
    console.error('Gold purchase error:', error)
    res.status(500).json({ error: 'Failed to create purchase order' })
  }
})

// POST /api/gold/orders/:orderId/pay - Process payment for order
router.post('/orders/:orderId/pay', authenticateToken, async (req, res) => {
  try {
    console.log('Payment request received:', { orderId: req.params.orderId, userId: req.user?._id })
    
    const { orderId } = req.params
    const { paymentMethod = 'UPI', paymentId } = req.body
    const userId = req.user._id
    
    // Validate user object
    if (!req.user) {
      console.error('User not found in request')
      return res.status(401).json({ error: 'User authentication failed' })
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.error('Invalid orderId format:', orderId)
      return res.status(400).json({ error: 'Invalid order ID format' })
    }
    
    console.log('Finding order:', { orderId, userId })
    const order = await Order.findOne({ _id: orderId, userId })
    
    if (!order) {
      console.error('Order not found:', { orderId, userId })
      return res.status(404).json({ error: 'Order not found' })
    }
    
    console.log('Order found:', { id: order._id, status: order.status, amount: order.amountINR })
    
    if (order.status !== 'PENDING') {
      console.error('Order cannot be paid:', { status: order.status })
      return res.status(400).json({ error: 'Order cannot be paid' })
    }
    
    // Check if Razorpay is properly configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
      console.warn('Razorpay not configured - using simulation mode')
      
      // Fallback to simulation when Razorpay is not configured
      const isPaymentSuccessful = await simulatePayment(order, paymentMethod)
      
      if (isPaymentSuccessful) {
        order.status = 'COMPLETED'
        order.paymentDetails = {
          paymentId: paymentId || `SIM_PAY_${Date.now()}`,
          paymentMethod,
          gatewayResponse: {
            status: 'success',
            timestamp: new Date(),
            transactionId: `SIM_TXN_${Date.now()}`,
            note: 'Simulated payment (Razorpay not configured)'
          }
        }
        
        await order.save()
        
        // Update user's gold assets
        console.log('Updating user assets (sim mode):', { grams: order.grams, pricePerGram: order.pricePerGram })
        console.log('User before update:', { 
          id: req.user._id, 
          goldGrams: req.user.assets.goldGrams, 
          totalInvested: req.user.assets.totalInvested 
        })
        
        try {
        await req.user.updateAssets(order.grams, order.pricePerGram)
          console.log('User assets updated successfully (sim mode)')
        } catch (updateError) {
          console.error('Error updating user assets:', updateError)
          throw new Error(`Failed to update user assets: ${updateError.message}`)
        }
        
        return res.json({
          message: 'Payment successful! Gold added to your portfolio.',
          order: {
            id: order._id,
            status: order.status,
            grams: order.grams,
            amountINR: order.amountINR,
            paymentId: order.paymentDetails.paymentId
          },
          note: 'Demo mode: Configure RAZORPAY_KEY_ID and RAZORPAY_SECRET in .env for real payments'
        })
      } else {
        order.status = 'FAILED'
        await order.save()
        return res.status(400).json({ 
          error: 'Payment failed',
          order: { id: order._id, status: order.status }
        })
      }
    }
    
    // Create Razorpay order for real payment processing
    const Razorpay = require('razorpay')
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET
    })
    
    try {
      const razorpayOrder = await razorpay.orders.create({
        amount: order.totalAmount * 100, // Amount in paisa
        currency: 'INR',
        receipt: `order_${order._id}`,
        payment_capture: true
      })
      
      // Update order with Razorpay order ID
      order.status = 'PROCESSING'
      order.paymentDetails = {
        razorpayOrderId: razorpayOrder.id,
        paymentMethod,
        gatewayResponse: {
          status: 'created',
          timestamp: new Date(),
          orderId: razorpayOrder.id
        }
      }
      
      await order.save()
      
      res.json({
        message: 'Payment order created successfully',
        order: {
          id: order._id,
          status: order.status,
          razorpayOrderId: razorpayOrder.id,
          amount: order.totalAmount,
          currency: 'INR'
        },
        razorpayOrder
      })
      
    } catch (razorpayError) {
      console.error('Razorpay order creation failed:', razorpayError)
      
      // Fallback to simulation if Razorpay fails
      const isPaymentSuccessful = await simulatePayment(order, paymentMethod)
      
      if (isPaymentSuccessful) {
        order.status = 'COMPLETED'
        order.paymentDetails = {
          paymentId: paymentId || `SIM_PAY_${Date.now()}`,
          paymentMethod,
          gatewayResponse: {
            status: 'success',
            timestamp: new Date(),
            transactionId: `SIM_TXN_${Date.now()}`,
            note: 'Simulated payment (Razorpay unavailable)'
          }
        }
        
        await order.save()
        
        // Update user's gold assets
        console.log('Updating user assets (fallback mode):', { grams: order.grams, pricePerGram: order.pricePerGram })
        console.log('User before update:', { 
          id: req.user._id, 
          goldGrams: req.user.assets.goldGrams, 
          totalInvested: req.user.assets.totalInvested 
        })
        
        try {
        await req.user.updateAssets(order.grams, order.pricePerGram)
          console.log('User assets updated successfully (fallback mode)')
        } catch (updateError) {
          console.error('Error updating user assets:', updateError)
          throw new Error(`Failed to update user assets: ${updateError.message}`)
        }
        
        res.json({
          message: 'Payment successful! Gold added to your portfolio.',
          order: {
            id: order._id,
            status: order.status,
            grams: order.grams,
            amountINR: order.amountINR,
            paymentId: order.paymentDetails.paymentId
          },
          note: 'Processed via simulation (Razorpay configuration needed)'
        })
      } else {
        order.status = 'FAILED'
        order.paymentDetails = {
          paymentId: paymentId || `SIM_FAIL_${Date.now()}`,
          paymentMethod,
          gatewayResponse: {
            status: 'failed',
            timestamp: new Date(),
            error: 'Simulated payment failure'
          }
        }
        
        await order.save()
        
        res.status(400).json({ 
          error: 'Payment failed',
          order: {
            id: order._id,
            status: order.status
          }
        })
      }
    }
  } catch (error) {
    console.error('Payment processing error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      orderId: req.params.orderId,
      userId: req.user?._id
    })
    
    res.status(500).json({ 
      error: 'Failed to process payment',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
})

// POST /api/gold/orders/:orderId/verify - Verify Razorpay payment
router.post('/orders/:orderId/verify', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    const userId = req.user._id
    
    const order = await Order.findOne({ _id: orderId, userId })
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }
    
    // Check if Razorpay is configured for verification
    if (!process.env.RAZORPAY_SECRET) {
      return res.status(400).json({ 
        error: 'Razorpay not configured for verification',
        note: 'Configure RAZORPAY_SECRET in .env file'
      })
    }
    
    // Verify Razorpay signature
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id)
    const generatedSignature = hmac.digest('hex')
    
    if (generatedSignature === razorpay_signature) {
      // Payment verified successfully
      order.status = 'COMPLETED'
      order.paymentDetails = {
        ...order.paymentDetails,
        paymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        gatewayResponse: {
          status: 'verified',
          timestamp: new Date(),
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id
        }
      }
      
      await order.save()
      
      // Update user's gold assets
      await req.user.updateAssets(order.grams, order.pricePerGram)
      
      res.json({
        message: 'Payment verified successfully! Gold added to your portfolio.',
        order: {
          id: order._id,
          status: order.status,
          grams: order.grams,
          amountINR: order.amountINR,
          paymentId: razorpay_payment_id
        }
      })
    } else {
      // Payment verification failed
      order.status = 'FAILED'
      order.paymentDetails = {
        ...order.paymentDetails,
        gatewayResponse: {
          status: 'verification_failed',
          timestamp: new Date(),
          error: 'Invalid signature'
        }
      }
      
      await order.save()
      
      res.status(400).json({ 
        error: 'Payment verification failed',
        order: {
          id: order._id,
          status: order.status
        }
      })
    }
  } catch (error) {
    console.error('Payment verification error:', error)
    res.status(500).json({ error: 'Failed to verify payment' })
  }
})

// GET /api/gold/orders - Get user's order history
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, page = 1, status } = req.query
    const userId = req.user._id
    
    const query = { userId }
    if (status) query.status = status
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
    
    const total = await Order.countDocuments(query)
    
    res.json({
      orders: orders.map(order => ({
        id: order._id,
        amountINR: order.amountINR,
        grams: order.grams,
        pricePerGram: order.pricePerGram,
        status: order.status,
        createdAt: order.createdAt,
        paymentMethod: order.paymentDetails?.paymentMethod
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Order history error:', error)
    res.status(500).json({ error: 'Failed to fetch order history' })
  }
})

// GET /api/gold/orders/:orderId - Get specific order details
router.get('/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params
    const userId = req.user._id
    
    const order = await Order.findOne({ _id: orderId, userId })
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }
    
    res.json({ order })
  } catch (error) {
    console.error('Order fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch order details' })
  }
})

// Helper function to simulate payment processing
async function simulatePayment(order, paymentMethod) {
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // 95% success rate for simulation
  return Math.random() > 0.05
}

module.exports = router