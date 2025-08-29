const { z } = require('zod')

// Auth validation schemas
const authSchemas = {
  signup: z.object({
    body: z.object({
      name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters')
        .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
      email: z.string()
        .email('Invalid email format')
        .max(255, 'Email must be less than 255 characters'),
      password: z.string()
        .min(6, 'Password must be at least 6 characters')
        .max(128, 'Password must be less than 128 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
      confirmPassword: z.string()
    }).refine(data => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    })
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password is required')
    })
  })
}

// Chat validation schemas
const chatSchemas = {
  sendMessage: z.object({
    body: z.object({
      message: z.string()
        .min(1, 'Message cannot be empty')
        .max(1000, 'Message must be less than 1000 characters')
        .trim(),
      sessionId: z.string().uuid().optional()
    })
  }),

  feedback: z.object({
    body: z.object({
      messageId: z.string().min(1, 'Message ID is required'),
      rating: z.number().min(1).max(5),
      feedback: z.string().max(500, 'Feedback must be less than 500 characters').optional()
    }),
    params: z.object({
      sessionId: z.string().uuid('Invalid session ID')
    })
  })
}

// Gold API validation schemas
const goldSchemas = {
  purchase: z.object({
    body: z.object({
      amountINR: z.number()
        .positive('Amount must be positive')
        .min(100, 'Minimum purchase amount is ₹100')
        .max(1000000, 'Maximum purchase amount is ₹10,00,000')
        .optional(),
      grams: z.number()
        .positive('Grams must be positive')
        .min(0.001, 'Minimum purchase is 0.001 grams')
        .max(1000, 'Maximum purchase is 1000 grams')
        .optional(),
      preferredType: z.enum(['amount', 'grams']).default('amount')
    }).refine(data => {
      return (data.amountINR && !data.grams) || (!data.amountINR && data.grams)
    }, {
      message: 'Provide either amountINR or grams, not both'
    })
  }),

  payment: z.object({
    body: z.object({
      paymentMethod: z.enum(['UPI', 'CARD', 'NET_BANKING', 'WALLET']).default('UPI'),
      paymentId: z.string().optional()
    }),
    params: z.object({
      orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID')
    })
  }),

  calculator: z.object({
    query: z.object({
      amount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid amount format'),
      type: z.enum(['inr', 'grams']).default('inr')
    })
  }),

  history: z.object({
    params: z.object({
      period: z.enum(['1d', '1w', '1m'], 'Invalid period. Use 1d, 1w, or 1m')
    })
  }),

  orders: z.object({
    query: z.object({
      limit: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : 10),
      page: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : 1),
      status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional()
    })
  })
}

// User validation schemas
const userSchemas = {
  updatePreferences: z.object({
    body: z.object({
      investmentGoal: z.number()
        .positive('Investment goal must be positive')
        .min(1000, 'Investment goal must be at least ₹1,000')
        .max(10000000, 'Investment goal must be less than ₹1,00,00,000')
        .optional(),
      riskLevel: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']).optional()
    }).refine(data => {
      return Object.keys(data).length > 0
    }, {
      message: 'At least one field must be provided'
    })
  }),

  analytics: z.object({
    query: z.object({
      period: z.enum(['1d', '1w', '1m']).default('1m')
    })
  })
}

// Common parameter validation
const commonSchemas = {
  mongoId: z.object({
    params: z.object({
      id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format')
    })
  }),

  pagination: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : 1),
      limit: z.string().regex(/^\d+$/).optional().transform(val => val ? Math.min(parseInt(val), 100) : 10)
    })
  })
}

module.exports = {
  authSchemas,
  chatSchemas,
  goldSchemas,
  userSchemas,
  commonSchemas
}