const { z } = require('zod')

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err)

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    })
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(400).json({
      error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
    })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' })
  }

  // Zod validation errors
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    })
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    return res.status(503).json({
      error: 'Database temporarily unavailable. Please try again later.'
    })
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: err.retryAfter
    })
  }

  // Default to 500 server error
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body)
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query)
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params)
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

// Rate limiting configuration
const createRateLimit = (options = {}) => {
  const rateLimit = require('express-rate-limit')
  
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000) || 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health'
    }
  })
}

// Input sanitization
const sanitizeInput = (req, res, next) => {
  const sanitizeObj = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS attacks
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim()
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObj(obj[key])
      }
    }
  }

  if (req.body) sanitizeObj(req.body)
  if (req.query) sanitizeObj(req.query)
  if (req.params) sanitizeObj(req.params)
  
  next()
}

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  next()
}

module.exports = {
  errorHandler,
  asyncHandler,
  validateRequest,
  createRateLimit,
  sanitizeInput,
  securityHeaders
}