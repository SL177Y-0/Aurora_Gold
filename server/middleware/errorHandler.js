const { z } = require('zod')

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err)

  // Zod validation error handling
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    })
  }

  // Generic server error
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  })
}

const sanitizeInput = (req, res, next) => {
  // Basic input sanitization
  Object.keys(req.body).forEach(key => {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].trim()
    }
  })
  next()
}

const createRateLimit = ({ max, windowMs }) => {
  const rateLimit = require('express-rate-limit')
  return rateLimit({
    windowMs: windowMs,
    max: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests, please try again later.'
    }
  })
}

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
}

module.exports = {
  errorHandler,
  sanitizeInput,
  createRateLimit,
  securityHeaders
}