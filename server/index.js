require('dotenv').config({ path: '.env' })
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const { 
  errorHandler, 
  sanitizeInput, 
  securityHeaders 
} = require('./middleware/errorHandler')
const rateLimit = require('express-rate-limit')

// Import routes
const authRoutes = require('./routes/auth')
const chatRoutes = require('./routes/chat')
const goldRoutes = require('./routes/gold')
const userRoutes = require('./routes/user')

const app = express()

// Middleware
app.use(securityHeaders)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [FRONTEND_URL, 'https://aurora-gold-pi.vercel.app'] 
    : ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true
}))

// Trust proxy for accurate IP detection in cloud environments
app.set('trust proxy', true)

// Modify rate limiting to work with proxied environments
const createRateLimit = ({ max, windowMs }) => {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
      // Use X-Forwarded-For header or fallback to IP
      return req.get('X-Forwarded-For')?.split(',')[0].trim() || req.ip
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000)
      })
    }
  })
}

// Update rate limiting middleware to use the new configuration
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

// Dynamic port configuration for cloud deployment
const PORT = process.env.PORT || process.env.NODE_PORT || 3001

// Enhanced server startup with detailed logging
const startServer = () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running successfully!`);
    console.log(`   • Port: ${PORT}`);
    console.log(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   • Timestamp: ${new Date().toISOString()}`);
    
    // Optional: Log network interfaces for debugging
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    console.log('   • Network Interfaces:');
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      networkInterfaces[interfaceName].forEach((details) => {
        if (details.family === 'IPv4' && !details.internal) {
          console.log(`     - ${interfaceName}: ${details.address}`);
        }
      });
    });
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed. Process terminated.');
      process.exit(0);
    });
  });

  return server;
};

// Start the server
startServer();

module.exports = app