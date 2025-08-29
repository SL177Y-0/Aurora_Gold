


https://github.com/user-attachments/assets/8fb89a25-07e3-4da8-9d5d-0571c177206b


# 🌟 Aurora Gold - AI-Powered Digital Gold Investment Platform

*Where artificial intelligence meets precious metals investment*

Welcome to Aurora Gold, a cutting-edge digital gold investment platform that combines the timeless value of gold with modern AI technology. This isn't just another fintech app – it's your personal financial companion powered by Google Gemini AI, designed to make gold investment accessible, intelligent, and profitable.

## 🚀 What Makes Aurora Gold Special?

Aurora Gold isn't your typical investment platform. We've crafted something truly unique:

- **Real-time AI Assistant**: Meet Aurora AI, your personal finance companion powered by Google Gemini
- **Live Gold Pricing**: Real-time gold prices fetched directly through AI, no more outdated data
- **Intelligent Investment Nudging**: Our AI analyzes market conditions and suggests optimal investment amounts
- **Seamless User Experience**: Built with Next.js 15 and React 19 for lightning-fast performance
- **Production-Ready Architecture**: Enterprise-grade security with JWT authentication and MongoDB

## 🏗️ Architecture Overview

### Frontend Powerhouse
- **Next.js 15** with App Router for modern React development
- **React 19** for cutting-edge component architecture
- **TypeScript** for type-safe development
- **Tailwind CSS** with custom glassmorphism design
- **Radix UI** components for accessibility and consistency

### Backend Excellence
- **Express.js** API server with enterprise middleware
- **MongoDB** for scalable data storage
- **Google Gemini 1.5 Flash** for AI chat and pricing intelligence (token-optimized)
- **Aggressive caching and throttling** for efficient API usage
- **JWT Authentication** for secure user sessions
- **Rate Limiting** and security headers for production readiness

### AI Integration
- **Direct Gemini 1.5 Flash API** calls (no third-party packages)
- **Token-optimized prompts** for efficient API usage
- **Real-time gold price fetching** through AI (with intelligent caching)
- **Intelligent chat responses** with investment nudging
- **Historical price simulation** for chart data
- **Smart throttling** to manage API usage efficiently

## 🛠️ Getting Started

### Prerequisites
Before diving into Aurora Gold, make sure you have:
- Node.js 18+ installed
- MongoDB instance (local or cloud)
- Google Gemini API key (with token optimization)
- A good cup of coffee ☕

### 1. Clone and Install
```bash
# Clone the repository
git clone <your-repo-url>
cd Aurora_Gold

# Install dependencies
npm install
# or if you prefer pnpm
pnpm install
```

### 2. Environment Configuration
**IMPORTANT**: Create a `.env` file in the root directory (same level as package.json):

```env
# Database Configuration (REQUIRED)
MONGODB_URI=mongodb+srv://your-username:password@cluster.mongodb.net/aurora_gold

# Authentication (CRITICAL - REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=365d

# Google Gemini AI Configuration (REQUIRED)
GEMINI_API_KEY=your-gemini-api-key-here

# App Configuration
NODE_ENV=development
PORT=3001

# Payment Gateway - Razorpay Integration (REQUIRED for payments)
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_SECRET=your_razorpay_secret_here

# Frontend Razorpay Configuration (REQUIRED for payments)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id_here
```

### 3. Database Setup
Aurora Gold uses MongoDB for data storage. The application will automatically create the necessary collections on first run:
- `users` - User accounts and preferences
- `orders` - Gold purchase transactions
- `chats` - AI conversation history

### 4. Payment Gateway Setup (Razorpay)

To enable real payment processing, you need to configure Razorpay:

1. **Create Razorpay Account**
   - Visit [https://dashboard.razorpay.com/](https://dashboard.razorpay.com/)
   - Sign up for a free account
   - Complete the verification process

2. **Get API Keys**
   - Navigate to Settings → API Keys
   - Generate API keys for Test Mode
   - Copy the Key ID and Secret

3. **Configure Environment Variables**
   ```env
   # Backend Razorpay configuration
   RAZORPAY_KEY_ID=rzp_test_your_key_id_here
   RAZORPAY_SECRET=your_razorpay_secret_here
   
   # Frontend configuration
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id_here
   ```

4. **Test Mode vs Live Mode**
   - Use `rzp_test_` prefixed keys for development
   - Switch to `rzp_live_` keys for production
   - Demo mode activates automatically if Razorpay isn't configured

### 5. Launch the Application
```bash
# Start the backend server
npm run server
# or
node server/index.js

# In a new terminal, start the frontend
npm run dev
# or
next dev
```

Visit `http://localhost:3000` and watch Aurora Gold come to life! 🎉

**Payment Testing**: If Razorpay credentials aren't configured, the app automatically uses demo mode with simulated successful payments.

## 🌐 Deployment Guide

### Production Environment Setup

#### Frontend Deployment (Vercel Recommended)
```bash
# Build the application
npm run build

# Deploy to Vercel
vercel --prod
```

#### Backend Deployment (Railway/Heroku/DigitalOcean)
```bash
# Set production environment variables
NODE_ENV=production
PORT=3001
MONGODB_URI=your-production-mongodb-uri
GEMINI_API_KEY=your-production-gemini-key

# Start the production server
npm start
```

#### Environment Variables for Production
- Set `NODE_ENV=production`
- Update `NEXTAUTH_URL` to your production domain
- Configure CORS origins in `server/index.js`
- Ensure MongoDB URI points to production database
- Use production-grade JWT secrets

#### Security Considerations
- Enable HTTPS in production
- Configure proper CORS origins
- Set up MongoDB authentication
- Use environment-specific API keys
- Enable rate limiting (already configured)

## 💡 Key Features Deep Dive

### Aurora AI Assistant
Our crown jewel – an intelligent financial assistant that:
- Provides real-time gold market insights
- Suggests personalized investment amounts
- Understands user intent and responds contextually
- Guides users through the investment process
- Never uses mock data – everything is real-time!

### Real-Time Gold Pricing
Gone are the days of outdated pricing:
- Live prices fetched through Google Gemini 1.5 Flash (optimized intervals)
- Ultra-minimal prompts for efficient token usage
- No hardcoded fallbacks or mock data
- Historical price simulation for analysis
- Smart caching to balance accuracy and efficiency

### Integrated Payment System
Secure and seamless payment processing:
- **Razorpay Integration**: Industry-standard payment gateway
- **Demo Mode**: Automatic fallback when Razorpay credentials aren't configured
- **Smart Choice Buttons**: Interactive purchase flow with user-friendly options
- **Payment Verification**: Robust signature verification for security
- **Real-time Updates**: Instant portfolio updates after successful purchases

### Seamless User Experience
- Glassmorphism design for modern aesthetics
- Responsive across all device sizes
- Lightning-fast navigation with Next.js App Router
- Error boundaries for graceful error handling

## 🎯 Our Development Philosophy

### • Real-Time First Approach
We eliminated ALL mock data from the codebase. Every price, every calculation, every AI response is fetched in real-time. This ensures users always get accurate, up-to-date information.

### • AI-Powered Everything
Instead of static APIs, we leverage Google Gemini 1.5 Flash for:
- Dynamic gold price fetching (token-optimized with caching)
- Intelligent conversation handling
- Market analysis and insights
- Investment guidance and recommendations
- All with efficient token usage and smart throttling

### • Production-Ready Architecture
Built with scalability in mind:
- Proper error handling throughout
- Rate limiting for API protection
- Security middleware implementation
- Optimized database queries

## 🚧 Challenges & Solutions

### Challenge 1: Real-Time Data Reliability
**Problem**: Ensuring consistent, accurate gold prices without fallbacks
**Solution**: Implemented robust error handling with user notifications instead of mock fallbacks

### Challenge 2: AI Response Consistency
**Problem**: Maintaining consistent AI responses for financial advice
**Solution**: Carefully crafted system prompts with structured JSON response format

### Challenge 3: Performance Optimization
**Problem**: Balancing real-time data with application performance
**Solution**: Smart caching mechanisms with 30-second intervals for price updates

### Challenge 4: Security First
**Problem**: Protecting financial data and user privacy
**Solution**: JWT authentication, rate limiting, input sanitization, and security headers

## 🔧 Development Scripts

```bash
# Frontend development
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run start        # Start production build
npm run lint         # Run ESLint

# Backend development
npm run server       # Start Express server
npm run server:dev   # Start with nodemon for development

# Database
npm run db:reset     # Reset database (if needed)
```

## 🏆 Production Checklist

Before going live, ensure:
- [ ] All environment variables are set
- [ ] MongoDB is properly configured
- [ ] Gemini API key is active and has sufficient quota
- [ ] CORS origins are configured for production domain
- [ ] Rate limiting is enabled
- [ ] Error tracking is set up (Sentry recommended)
- [ ] SSL certificates are configured
- [ ] Database backups are scheduled

## 🎨 Customization

### Styling
Aurora Gold uses Tailwind CSS with custom configurations:
- Glassmorphism effects in `globals.css`
- Custom color palette for gold theme
- Responsive design patterns
- Dark/light mode support (extendable)

### AI Personality
Customize Aurora AI's personality in `server/services/chatbot.js`:
- Modify system prompts
- Adjust nudging strategies
- Customize response templates

### Features Extension
The modular architecture makes it easy to add:
- Additional investment products (silver, platinum)
- Advanced analytics dashboards
- Social trading features
- Mobile app integration

### Monitoring
- Server health check endpoint: `/api/health`
- Database connection monitoring in logs
- AI API call tracking and error handling

### Backup Strategy
- Regular MongoDB backups
- Environment variable documentation
- Code repository with proper branching

## 🚀 Deployment Guide for Separate Frontend and Backend

### Project Structure
```
aurora-gold/
├── server/           # Backend Node.js server
│   ├── package.json
│   └── index.js
├── package.json      # Root workspace package
└── ...
```

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Render account
- Vercel account

### Local Development
```bash
# Install root dependencies and set up workspaces
npm install  # or pnpm install

# Run frontend in development
npm run dev

# Run backend in development
npm run server:dev
```

### Render Deployment (Backend)
1. Create a new Web Service in Render
2. Connect to your GitHub repository
3. Configure settings:
   - **Root Directory**: `server`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Branch**: `main`

#### Required Environment Variables
```
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=long_random_secret_key
FRONTEND_URL=https://your-vercel-domain.vercel.app
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_SECRET=your_razorpay_secret
```

### Vercel Deployment (Frontend)
1. Import your GitHub repository
2. Configure build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

#### Frontend Environment Variables
```
NEXT_PUBLIC_API_BASE_URL=https://your-render-backend-domain.onrender.com/api
NODE_ENV=production
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key
```

### 🔒 Security Best Practices
- Use strong, unique secrets
- Rotate credentials periodically
- Enable IP restrictions
- Use environment-specific configurations

### 🛠 Troubleshooting
- Check deployment logs in Render and Vercel
- Verify environment variables
- Ensure CORS settings are correct

### 📊 Monitoring
- Set up monitoring in Render and Vercel dashboards
- Use error tracking services like Sentry
- Monitor performance and set up alerts

