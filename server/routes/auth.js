const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { authenticateToken } = require('../middleware/auth')
const { validateRequest, asyncHandler } = require('../middleware/errorHandler')
const { authSchemas } = require('../validation/schemas')

const router = express.Router()

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )
}

// POST /api/auth/signup
router.post('/signup', validateRequest(authSchemas.signup), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body
  
  // Check if user already exists
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists with this email' })
  }
  
  // Create new user
  const user = new User({
    name,
    email,
    passwordHash: password // Will be hashed by pre-save hook
  })
  
  await user.save()
  
  const token = generateToken(user._id)
  
  res.status(201).json({
    message: 'User created successfully',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      assets: user.assets,
      kycStatus: user.kycStatus,
      preferences: user.preferences
    }
  })
}))

// POST /api/auth/login
router.post('/login', validateRequest(authSchemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body
  
  // Find user by email
  const user = await User.findOne({ 
    email,
    isActive: true 
  })
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  
  // Check password
  const isPasswordValid = await user.comparePassword(password)
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  
  const token = generateToken(user._id)
  
  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      assets: user.assets,
      kycStatus: user.kycStatus,
      preferences: user.preferences
    }
  })
}))

// GET /api/auth/verify
router.get('/verify', authenticateToken, asyncHandler(async (req, res) => {
  res.json({
    message: 'Token is valid',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      assets: req.user.assets,
      kycStatus: req.user.kycStatus,
      preferences: req.user.preferences
    }
  })
}))

// POST /api/auth/logout
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // In a production app, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' })
}))

// PUT /api/auth/profile
router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const updates = {}
  const { name, preferences } = req.body
  
  if (name) {
    if (typeof name !== 'string' || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 2 and 50 characters' })
    }
    updates.name = name.trim()
  }
  
  if (preferences) {
    if (preferences.investmentGoal) {
      if (typeof preferences.investmentGoal !== 'number' || preferences.investmentGoal < 1000) {
        return res.status(400).json({ error: 'Investment goal must be at least ₹1,000' })
      }
      updates['preferences.investmentGoal'] = preferences.investmentGoal
    }
    if (preferences.riskLevel) {
      if (!['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'].includes(preferences.riskLevel)) {
        return res.status(400).json({ error: 'Invalid risk level' })
      }
      updates['preferences.riskLevel'] = preferences.riskLevel
    }
  }
  
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid updates provided' })
  }
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, select: '-passwordHash' }
  )
  
  res.json({
    message: 'Profile updated successfully',
    user
  })
}))

module.exports = router