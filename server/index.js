require('dotenv').config({ path: '.env' })
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const { 
  errorHandler, 
  createRateLimit, 
  sanitizeInput, 
  securityHeaders 
} = require('./middleware/errorHandler')

// Import routes
const authRoutes = require('./routes/auth')
const chatRoutes = require('./routes/chat')
const goldRoutes = require('./routes/gold')
const userRoutes = require('./routes/user')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(securityHeaders)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true
}))

// Rate limiting
app.use('/api/auth', createRateLimit({ max: 10, windowMs: 15 * 60 * 1000 }))
app.use('/api/chat', createRateLimit({ max: 50, windowMs: 15 * 60 * 1000 }))
app.use('/api', createRateLimit({ max: 100, windowMs: 15 * 60 * 1000 }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(sanitizeInput)

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')
  } catch (err) {
    console.error('MongoDB connection error:', err.message)
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Running in development mode without database connection')
    } else {
      console.error('Database connection failed in production')
      process.exit(1)
    }
  }
}

connectDB()

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/gold', goldRoutes)
app.use('/api/user', userRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Aurora Gold API is running',
    timestamp: new Date().toISOString()
  })
})

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Environment validation
console.log('Environment Variables Check:')
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ SET' : '❌ NOT SET')
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ NOT SET')
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ SET' : '❌ NOT SET')
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? '✅ SET' : '❌ NOT SET')
console.log('RAZORPAY_SECRET:', process.env.RAZORPAY_SECRET ? '✅ SET' : '❌ NOT SET')

// Check critical environment variables
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET is not set!')
  console.error('This will cause authentication failures.')
  console.error('Please set JWT_SECRET in your .env file.')
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV}`)
})

module.exports = app