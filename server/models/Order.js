const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amountINR: {
    type: Number,
    required: true,
    min: 1
  },
  grams: {
    type: Number,
    required: true,
    min: 0.001
  },
  pricePerGram: {
    type: Number,
    required: true,
    min: 1
  },
  transactionFee: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  paymentDetails: {
    paymentId: String,
    paymentMethod: {
      type: String,
      enum: ['UPI', 'CARD', 'NET_BANKING', 'WALLET'],
      default: 'UPI'
    },
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  goldRateSnapshot: {
    timestamp: {
      type: Date,
      default: Date.now
    },
    source: String,
    rate: Number
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      enum: ['WEB', 'MOBILE', 'API'],
      default: 'WEB'
    }
  }
}, {
  timestamps: true
})

// Calculate transaction fee (1% of amount)
orderSchema.pre('save', function(next) {
  if (!this.transactionFee) {
    this.transactionFee = Math.round(this.amountINR * 0.01)
  }
  
  if (!this.totalAmount) {
    this.totalAmount = this.amountINR + this.transactionFee
  }
  
  next()
})

// Static method to get user's order history
orderSchema.statics.getUserOrders = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email')
}

// Static method to get order statistics
orderSchema.statics.getOrderStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), status: 'COMPLETED' } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: '$amountINR' },
        totalGrams: { $sum: '$grams' },
        avgOrderValue: { $avg: '$amountINR' }
      }
    }
  ])
}

module.exports = mongoose.model('Order', orderSchema)