const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  kycStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING'
  },
  assets: {
    goldGrams: {
      type: Number,
      default: 0,
      min: 0
    },
    avgPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    totalInvested: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  preferences: {
    investmentGoal: {
      type: Number,
      default: 50000
    },
    riskLevel: {
      type: String,
      enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
      default: 'CONSERVATIVE'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next()
  
  try {
    const salt = await bcrypt.genSalt(12)
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash)
}

// Calculate current portfolio value
userSchema.methods.calculatePortfolioValue = function(currentGoldPrice) {
  return this.assets.goldGrams * currentGoldPrice
}

// Calculate profit/loss
userSchema.methods.calculateProfitLoss = function(currentGoldPrice) {
  const currentValue = this.calculatePortfolioValue(currentGoldPrice)
  return currentValue - this.assets.totalInvested
}

// Update assets after purchase
userSchema.methods.updateAssets = function(grams, pricePerGram) {
  try {
    console.log('UpdateAssets called with:', { grams, pricePerGram })
    console.log('Current assets:', { 
      goldGrams: this.assets.goldGrams, 
      totalInvested: this.assets.totalInvested,
      avgPrice: this.assets.avgPrice
    })
    
    const newTotalGrams = this.assets.goldGrams + grams
    const newTotalInvested = this.assets.totalInvested + (grams * pricePerGram)
    
    // Validate inputs
    if (isNaN(grams) || grams <= 0) {
      throw new Error(`Invalid grams value: ${grams}`)
    }
    if (isNaN(pricePerGram) || pricePerGram <= 0) {
      throw new Error(`Invalid pricePerGram value: ${pricePerGram}`)
    }
    
    this.assets.goldGrams = newTotalGrams
    this.assets.totalInvested = newTotalInvested
    this.assets.avgPrice = newTotalGrams > 0 ? newTotalInvested / newTotalGrams : 0
    
    console.log('New assets calculated:', {
      goldGrams: this.assets.goldGrams,
      totalInvested: this.assets.totalInvested,
      avgPrice: this.assets.avgPrice
    })
    
    return this.save()
  } catch (error) {
    console.error('UpdateAssets error:', error)
    throw error
  }
}

// Hide sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject()
  delete user.passwordHash
  return user
}

module.exports = mongoose.model('User', userSchema)