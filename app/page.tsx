"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useAuth, api } from "../contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { MessageCircle, TrendingUp, Coins, Send, User, Bot, ArrowUp, ChevronDown, LogIn, UserPlus } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-states"

interface GoldPrice {
  price: number
  change: {
    change: number
    changePercent: number
    trend: 'up' | 'down'
  }
  timestamp: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    type?: 'choice_buttons'
    suggestedAmount?: number
    options?: Array<{
      label: string
      action: string
      variant: 'default' | 'outline'
    }>
  }
}

interface ChatResponse {
  sessionId: string
  message: {
    id: string
    content: string
    timestamp: string
  }
  ai: {
    shouldOfferPurchase: boolean
    requireLogin: boolean
    suggestedAmount?: number
    intent: string
    confidence: number
  }
  context: {
    goldPrice: number
    isLoggedIn: boolean
    conversationLength: number
  }
}

export default function AuroraGoldApp() {
  const { user, login, signup, logout, loading } = useAuth()
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState("chat")
  const [chatMessage, setChatMessage] = useState("")
  const [goldAmount, setGoldAmount] = useState("500")
  const [loginForm, setLoginForm] = useState({ email: "", password: "" })
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", confirmPassword: "" })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null)
  const [portfolio, setPortfolio] = useState<any>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch gold price on component mount
  useEffect(() => {
    fetchGoldPrice()
    const interval = setInterval(fetchGoldPrice, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Fetch portfolio data when user logs in
  useEffect(() => {
    if (user) {
      fetchPortfolio()
    }
  }, [user])

  // Initialize chat
  useEffect(() => {
    initializeChat()
  }, [])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchGoldPrice = async () => {
    try {
      console.log('Fetching gold price from API...')
      const response = await api.get('/gold/price')
      console.log('Gold price API response:', response.data)
      
      // Transform the API response to match the frontend interface
      const apiData = response.data
      const transformedData: GoldPrice = {
        price: apiData.current.price,
        change: {
          change: apiData.change.change,
          changePercent: apiData.change.changePercent,
          trend: apiData.change.trend as 'up' | 'down'
        },
        timestamp: apiData.current.timestamp
      }
      console.log('Transformed gold price data:', transformedData)
      setGoldPrice(transformedData)
    } catch (error) {
      console.error('Failed to fetch gold price:', error)
      toast({
        title: "Error",
        description: "Unable to fetch current gold price. Please check your connection.",
        variant: "destructive"
      })
      setGoldPrice(null)
    }
  }

  const fetchPortfolio = async () => {
    try {
      const response = await api.get('/user/portfolio')
      setPortfolio(response.data.portfolio)
    } catch (error) {
      console.error('Failed to fetch portfolio:', error)
    }
  }

  const initializeChat = () => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: 'Welcome to AuroraGold! I\'m Aurora AI, your personal finance assistant. How can I help you today?',
      timestamp: new Date()
    }])
  }

  const sendMessage = async () => {
    if (!chatMessage.trim() || chatLoading) return

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatMessage,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
    setChatMessage("")
    setChatLoading(true)

    try {
      const response = await api.post('/chat', {
        message: chatMessage,
        sessionId
      })
      
      const data: ChatResponse = response.data
      
      // Update session ID if new
      if (!sessionId) {
        setSessionId(data.sessionId)
      }
      
      // Add AI response first - KEEP AI RESPONSE PURE
      const aiMessage: ChatMessage = {
        id: data.message.id,
        role: 'assistant',
        content: data.message.content, // PURE AI RESPONSE - NO MODIFICATIONS
        timestamp: new Date(data.message.timestamp)
      }
      
      // Debug logging to check what content we're getting
      console.log('AI response content:', data.message.content)
      console.log('Is JSON?', data.message.content.startsWith('{') || data.message.content.startsWith('"'))
      
      // If the content looks like JSON, try to extract just the message
      if (data.message.content.startsWith('{') || data.message.content.includes('"message"')) {
        try {
          // Try to extract message from JSON
          const jsonMatch = data.message.content.match(/"message"\s*:\s*"([^"]+)"/)
          if (jsonMatch && jsonMatch[1]) {
            aiMessage.content = jsonMatch[1]
            console.log('Extracted clean message:', aiMessage.content)
          }
        } catch (e) {
          console.log('Failed to parse JSON, using raw content')
          // If parsing fails, check if it's a simple message
          if (data.message.content.length > 200) {
            // If content is too long and looks like JSON, provide fallback
            aiMessage.content = "I'm here to help you with gold investment. What would you like to know?"
          }
        }
      }
      
      setMessages(prev => [...prev, aiMessage])
      
      // Handle AI suggestions
      if (data.ai.requireLogin && !user) {
        toast({
          title: "Login Required",
          description: "Please log in to continue with this action.",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage('login')}
            >
              Login
            </Button>
          )
        })
      }
      
      // Handle suggested amount (separate from AI response)
      if (data.ai.shouldOfferPurchase && data.ai.suggestedAmount) {
        setGoldAmount(data.ai.suggestedAmount.toString())
      }
      
      // ALWAYS ADD CHOICE BUTTONS - Dynamic based on context
      setTimeout(() => {
        console.log('Adding choice buttons...')
        console.log('User message:', chatMessage)
        console.log('AI response:', data.message.content)
        console.log('shouldOfferPurchase:', data.ai.shouldOfferPurchase)
        
        const aiResponseLower = data.message.content.toLowerCase()
        const userMessageLower = chatMessage.toLowerCase()
        
        const isUserExpressingBuyIntent = (
          userMessageLower.includes('buy') ||
          userMessageLower.includes('purchase') ||
          userMessageLower.includes('invest') ||
          userMessageLower.includes('gold') ||
          data.ai.shouldOfferPurchase
        )
        
        const isAISuggestingPurchase = (
          aiResponseLower.includes('buy gold page') ||
          aiResponseLower.includes('visit our buy gold') ||
          aiResponseLower.includes('please visit our buy') ||
          aiResponseLower.includes('for easy purchases') ||
          aiResponseLower.includes('start to building') ||
          aiResponseLower.includes('building your gold portfolio') ||
          data.ai.shouldOfferPurchase
        )
        
        console.log('User buy intent:', isUserExpressingBuyIntent)
        console.log('AI suggesting purchase:', isAISuggestingPurchase)
        
        if (isUserExpressingBuyIntent || isAISuggestingPurchase) {
          // CONTEXTUAL BUTTONS for buy intent
          const buyChoiceMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant', 
            content: '',
            timestamp: new Date(),
            metadata: {
              type: 'choice_buttons',
              suggestedAmount: data.ai.suggestedAmount || 500,
              options: [
                {
                  label: 'Continue to Buy Gold',
                  action: 'navigate_buy',
                  variant: 'default'
                },
                {
                  label: 'Stay on Chat',
                  action: 'stay_chat',
                  variant: 'outline'
                }
              ]
            }
          }
          console.log('Adding buy choice buttons (Continue/Stay)')
          setMessages(prev => [...prev, buyChoiceMessage])
        } else {
          // DEFAULT BUTTONS for normal conversation
          const defaultChoiceMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            metadata: {
              type: 'choice_buttons',
              options: [
                {
                  label: 'Buy ₹500 Gold',
                  action: 'buy_500',
                  variant: 'default'
                },
                {
                  label: 'Show My Portfolio', 
                  action: 'show_portfolio',
                  variant: 'outline'
                },
                {
                  label: 'Gold Price Today',
                  action: 'gold_price',
                  variant: 'outline'
                }
              ]
            }
          }
          console.log('Adding default choice buttons (Buy ₹500/Portfolio/Price)')
          setMessages(prev => [...prev, defaultChoiceMessage])
        }
      }, 1000) // Delay for better UX
      
    } catch (error) {
      console.error('Chat error:', error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      })
    } finally {
      setChatLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive"
      })
      return
    }

    const result = await login(loginForm.email, loginForm.password)
    
    if (result.success) {
      toast({
        title: "Success",
        description: "Welcome back to AuroraGold!"
      })
      setCurrentPage('chat')
      setLoginForm({ email: "", password: "" })
    } else {
      toast({
        title: "Login Failed",
        description: result.error || "Invalid credentials",
        variant: "destructive"
      })
    }
  }

  const handleSignup = async () => {
    if (!signupForm.name || !signupForm.email || !signupForm.password || !signupForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive"
      })
      return
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      })
      return
    }

    const result = await signup(signupForm.name, signupForm.email, signupForm.password, signupForm.confirmPassword)
    
    if (result.success) {
      toast({
        title: "Success",
        description: "Welcome to AuroraGold!"
      })
      setCurrentPage('chat')
      setSignupForm({ name: "", email: "", password: "", confirmPassword: "" })
    } else {
      toast({
        title: "Signup Failed",
        description: result.error || "Failed to create account",
        variant: "destructive"
      })
    }
  }

  const navigationItems = user ? [
    { id: "chat", label: "AI Assistant", icon: MessageCircle },
    { id: "buy", label: "Buy Gold", icon: Coins },
    { id: "portfolio", label: "Portfolio", icon: TrendingUp },
    { id: "profile", label: "Profile", icon: User },
  ] : [
    { id: "chat", label: "AI Assistant", icon: MessageCircle },
    { id: "login", label: "Login", icon: LogIn },
    { id: "signup", label: "Sign Up", icon: UserPlus },
  ]

  const currentPageInfo = navigationItems.find((item) => item.id === currentPage)

  return (
    <div className="min-h-screen aurora-bg">
      {/* Header */}
      <header className="border-b border-border/20 backdrop-blur-sm bg-background/50 sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Image 
                src="/logo.png" 
                alt="AuroraGold Logo" 
                width={40} 
                height={40} 
                className="object-contain sm:w-[60px] sm:h-[60px]" 
                priority
              />
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-wide">AuroraGold</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">AI Finance Assistant</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="glassmorphism bg-transparent text-xs sm:text-sm px-2 sm:px-4">
                    {currentPageInfo && (
                      <>
                        <currentPageInfo.icon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden xs:inline">{currentPageInfo.label}</span>
                        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="glassmorphism border-border/20 w-48">
                  {navigationItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => setCurrentPage(item.id)}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  {user && (
                    <DropdownMenuItem
                      onClick={logout}
                      className="flex items-center gap-2 cursor-pointer text-red-400 text-sm"
                    >
                      <LogIn className="w-4 h-4" />
                      Logout
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Badge variant="secondary" className="glassmorphism text-xs px-2 py-1">
                {(() => {
                  console.log('Gold price state in badge:', goldPrice)
                  return goldPrice?.price ? (
                    <div className="flex items-center">
                      <span className="hidden sm:inline">Gold: </span>
                      <span>₹{goldPrice.price}/g</span>
                      {goldPrice?.change.trend === 'up' ? (
                        <ArrowUp className="w-2 h-2 sm:w-3 sm:h-3 ml-1 text-green-400" />
                      ) : (
                        <ArrowUp className="w-2 h-2 sm:w-3 sm:h-3 ml-1 text-red-400 rotate-180" />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 sm:gap-2">
                      <LoadingSpinner size="sm" />
                      <span className="hidden sm:inline">Loading...</span>
                    </div>
                  )
                })()
                }
              </Badge>
              
              {user && (
                <div className="text-xs sm:text-sm hidden md:block">
                  <span className="text-muted-foreground">Welcome, </span>
                  <span className="font-medium">{user.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Login Page */}
        {currentPage === "login" && (
          <div className="max-w-md mx-auto space-y-6">
            <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
              <CardHeader className="text-center px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl">Welcome Back</CardTitle>
                <CardDescription className="text-sm">Sign in to your AuroraGold account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="glassmorphism border-border/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="glassmorphism border-border/20"
                  />
                </div>
                <Button 
                  className="w-full glow-gold" 
                  size="lg"
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setCurrentPage("signup")}
                    className="text-primary hover:text-primary/80 text-sm"
                  >
                    Don't have an account? Sign up
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Signup Page */}
        {currentPage === "signup" && (
          <div className="max-w-md mx-auto space-y-6">
            <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
              <CardHeader className="text-center px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl">Create Account</CardTitle>
                <CardDescription className="text-sm">Join AuroraGold and start investing in gold</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    placeholder="Enter your full name"
                    value={signupForm.name}
                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                    className="glassmorphism border-border/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    className="glassmorphism border-border/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    placeholder="Create a password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    className="glassmorphism border-border/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    value={signupForm.confirmPassword}
                    onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                    className="glassmorphism border-border/20"
                  />
                </div>
                <Button 
                  className="w-full glow-gold" 
                  size="lg"
                  onClick={handleSignup}
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setCurrentPage("login")}
                    className="text-primary hover:text-primary/80 text-sm"
                  >
                    Already have an account? Sign in
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chat Page */}
        {currentPage === "chat" && (
          <div className="space-y-6">
            <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
              <CardHeader className="px-4 sm:px-6">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10 sm:w-12 sm:h-12 float-animation">
                    <AvatarImage 
                      src="/bot.png" 
                      alt="Aurora AI" 
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-gradient-to-r from-primary to-chart-2 text-primary-foreground">
                      <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-foreground text-lg sm:text-xl">Aurora AI</CardTitle>
                    <CardDescription className="text-sm">Your personal finance assistant</CardDescription>
                  </div>
                  <div className="ml-auto">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full pulse-gold"></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-4 max-h-[60vh] sm:max-h-96 overflow-y-auto scroll-smooth">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-2xl text-sm sm:text-base ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "glassmorphism text-foreground"
                        }`}
                      >
                        {message.metadata?.type === 'choice_buttons' ? (
                          <div className="space-y-3">
                            <p className="text-foreground">{message.content}</p>
                            <div className="flex flex-col gap-2">
                              {message.metadata.options?.map((option, index) => (
                                <Button
                                  key={index}
                                  variant={option.variant as "default" | "outline"}
                                  size="sm"
                                  className={`${option.variant === 'default' ? 'glow-gold' : 'glassmorphism bg-transparent'} text-xs sm:text-sm`}
                                  onClick={() => {
                                    if (option.action === 'navigate_buy') {
                                      setCurrentPage('buy')
                                      if (message.metadata?.suggestedAmount) {
                                        setGoldAmount(message.metadata.suggestedAmount.toString())
                                      }
                                      toast({
                                        title: "Welcome to Buy Gold!",
                                        description: `I've prepared ₹${message.metadata?.suggestedAmount || 500} for you.`,
                                      })
                                    } else if (option.action === 'stay_chat') {
                                      // Stay on chat - add response and restore default buttons
                                      const stayMessage: ChatMessage = {
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: 'Perfect! I\'m here whenever you\'re ready to invest. Feel free to ask me anything about gold investment!',
                                        timestamp: new Date()
                                      }
                                      setMessages(prev => [...prev, stayMessage])
                                      
                                      // Add default choice buttons after staying on chat
                                      setTimeout(() => {
                                        const defaultChoiceMessage: ChatMessage = {
                                          id: (Date.now() + 1).toString(),
                                          role: 'assistant',
                                          content: '',
                                          timestamp: new Date(),
                                          metadata: {
                                            type: 'choice_buttons',
                                            options: [
                                              {
                                                label: 'Buy ₹500 Gold',
                                                action: 'buy_500',
                                                variant: 'default'
                                              },
                                              {
                                                label: 'Show My Portfolio', 
                                                action: 'show_portfolio',
                                                variant: 'outline'
                                              },
                                              {
                                                label: 'Gold Price Today',
                                                action: 'gold_price',
                                                variant: 'outline'
                                              }
                                            ]
                                          }
                                        }
                                        setMessages(prev => [...prev, defaultChoiceMessage])
                                      }, 800) // Short delay for better UX
                                    } else if (option.action === 'buy_500') {
                                      // Handle Buy ₹500 Gold action
                                      setCurrentPage('buy')
                                      setGoldAmount('500')
                                      toast({
                                        title: "Buy Gold",
                                        description: "Let's get you started with ₹500 worth of gold!"
                                      })
                                    } else if (option.action === 'show_portfolio') {
                                      // Handle Show Portfolio action
                                      if (user) {
                                        setCurrentPage('portfolio')
                                        toast({
                                          title: "Portfolio",
                                          description: "Here's your gold investment portfolio."
                                        })
                                      } else {
                                        toast({
                                          title: "Login Required",
                                          description: "Please log in to view your portfolio.",
                                          action: (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setCurrentPage('login')}
                                            >
                                              Login
                                            </Button>
                                          )
                                        })
                                      }
                                    } else if (option.action === 'gold_price') {
                                      // Handle Gold Price Today action
                                      const priceMessage: ChatMessage = {
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: goldPrice?.price 
                                          ? `Today's gold price is ₹${goldPrice.price} per gram. ${goldPrice.change.trend === 'up' ? '📈' : '📉'} It's a ${goldPrice.change.trend === 'up' ? 'good' : 'great'} time to invest!`
                                          : 'Let me fetch the current gold price for you...',
                                        timestamp: new Date()
                                      }
                                      setMessages(prev => [...prev, priceMessage])
                                      
                                      // Fetch latest price if not available
                                      if (!goldPrice?.price) {
                                        fetchGoldPrice()
                                      }
                                    } else if (option.action === 'buy_more') {
                                      // Handle Buy More Gold action
                                      setCurrentPage('buy')
                                      setGoldAmount('500')
                                      toast({
                                        title: "Buy More Gold",
                                        description: "Ready for another investment! Let's buy more gold."
                                      })
                                    } else if (option.action === 'view_portfolio') {
                                      // Handle View Portfolio action
                                      if (user) {
                                        setCurrentPage('portfolio')
                                        toast({
                                          title: "Portfolio",
                                          description: "Here's your updated gold investment portfolio."
                                        })
                                      } else {
                                        toast({
                                          title: "Login Required",
                                          description: "Please log in to view your portfolio."
                                        })
                                      }
                                    } else if (option.action === 'back_to_chat') {
                                      // Handle Back to Chat action
                                      setCurrentPage('chat')
                                      const welcomeBackMessage: ChatMessage = {
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: "Welcome back! I'm here to help with any questions about your gold investments or to assist with future purchases.",
                                        timestamp: new Date()
                                      }
                                      setMessages(prev => [...prev, welcomeBackMessage])
                                    } else if (option.action === 'retry_purchase') {
                                      // Handle Retry Purchase action
                                      const retryMessage: ChatMessage = {
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: "Let's try your purchase again. Make sure you have a stable internet connection and sufficient funds.",
                                        timestamp: new Date()
                                      }
                                      setMessages(prev => [...prev, retryMessage])
                                      
                                      // Add a small delay then show default choice buttons
                                      setTimeout(() => {
                                        const defaultChoiceMessage: ChatMessage = {
                                          id: (Date.now() + 1).toString(),
                                          role: 'assistant',
                                          content: '',
                                          timestamp: new Date(),
                                          metadata: {
                                            type: 'choice_buttons',
                                            options: [
                                              {
                                                label: 'Try Buy ₹500 Gold',
                                                action: 'buy_500',
                                                variant: 'default'
                                              },
                                              {
                                                label: 'Go to Buy Page',
                                                action: 'navigate_buy',
                                                variant: 'outline'
                                              },
                                              {
                                                label: 'Check Gold Price',
                                                action: 'gold_price',
                                                variant: 'outline'
                                              }
                                            ]
                                          }
                                        }
                                        setMessages(prev => [...prev, defaultChoiceMessage])
                                      }, 1000)
                                    } else if (option.action === 'check_price') {
                                      // Handle Check Price action (same as gold_price)
                                      const priceMessage: ChatMessage = {
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: goldPrice?.price 
                                          ? `Current gold price: ₹${goldPrice.price} per gram. ${goldPrice.change.trend === 'up' ? '📈' : '📉'} Market trend: ${goldPrice.change.trend}`
                                          : 'Let me fetch the current gold price for you...',
                                        timestamp: new Date()
                                      }
                                      setMessages(prev => [...prev, priceMessage])
                                      
                                      if (!goldPrice?.price) {
                                        fetchGoldPrice()
                                      }
                                    } else if (option.action === 'get_help') {
                                      // Handle Get Help action
                                      setCurrentPage('chat')
                                      const helpMessage: ChatMessage = {
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: "I'm here to help! Common issues: Check your internet connection, ensure sufficient account balance, or try a different payment method. You can also contact our support team.",
                                        timestamp: new Date()
                                      }
                                      setMessages(prev => [...prev, helpMessage])
                                    }
                                    
                                    // Remove the choice buttons by filtering them out
                                    setMessages(prev => prev.filter(msg => msg.id !== message.id))
                                  }}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-2xl glassmorphism text-foreground">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {/* Buttons removed as requested */}
                </div>

                {/* Message Input */}
                <div className="flex space-x-2 mt-4">
                  <Input
                    placeholder="Ask Aurora anything about gold investment..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !chatLoading && sendMessage()}
                    disabled={chatLoading}
                    className="glassmorphism border-border/20 text-sm sm:text-base"
                  />
                  <Button 
                    onClick={sendMessage} 
                    className="glow-gold px-3 sm:px-4"
                    disabled={chatLoading || !chatMessage.trim()}
                  >
                    <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Buy Gold Page */}
        {currentPage === "buy" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Current Gold Price
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-center space-y-4">
                    {goldPrice?.price ? (
                      <>
                        <div className="text-3xl sm:text-4xl font-bold text-primary">₹{goldPrice.price.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">per gram</div>
                        <Badge variant="secondary" className="glassmorphism">
                          {goldPrice?.change.trend === 'up' ? (
                            <>
                              <ArrowUp className="w-3 h-3 mr-1 text-green-400" />
                              +{goldPrice.change.changePercent}% today
                            </>
                          ) : (
                            <>
                              <ArrowUp className="w-3 h-3 mr-1 text-red-400 rotate-180" />
                              {goldPrice?.change.changePercent}% today
                            </>
                          )}
                        </Badge>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <LoadingSpinner size="lg" text="Fetching live gold price..." />
                        </div>
                        <div className="text-sm text-muted-foreground">per gram</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-lg sm:text-xl">Buy Gold</CardTitle>
                  <CardDescription className="text-sm">Enter amount in INR</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <Input
                    placeholder="Enter amount (₹)"
                    value={goldAmount}
                    onChange={(e) => setGoldAmount(e.target.value)}
                    className="glassmorphism border-border/20 text-lg"
                  />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span>₹{goldAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gold (grams):</span>
                      <span>{goldPrice && goldAmount ? (Number.parseInt(goldAmount) / goldPrice.price).toFixed(3) : 'Loading...'}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transaction fee:</span>
                      <span>₹{Math.round(Number.parseInt(goldAmount) * 0.01)}</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full glow-gold text-center flex items-center justify-center" 
                    size="lg"
                    disabled={!goldPrice || !goldAmount || isNaN(Number(goldAmount)) || Number(goldAmount) < 100}
                    onClick={async () => {
                      if (!user) {
                        toast({
                          title: "Login Required",
                          description: "Please log in to buy gold.",
                          action: (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage('login')}
                            >
                              Login
                            </Button>
                          )
                        })
                        return
                      }

                      if (!goldAmount || isNaN(Number(goldAmount)) || Number(goldAmount) < 100) {
                        toast({
                          title: "Invalid Amount",
                          description: "Please enter a valid amount (minimum ₹100).",
                          variant: "destructive"
                        })
                        return
                      }

                      try {
                        // Create purchase order
                        const orderResponse = await api.post('/gold/purchase', {
                          amountINR: Number(goldAmount),
                          preferredType: 'amount'
                        })

                        const order = orderResponse.data.order
                        
                        // Process payment with Razorpay integration
                        const paymentResponse = await api.post(`/gold/orders/${order.id}/pay`, {
                          paymentMethod: 'UPI'
                        })

                        // Check if it's demo mode or real Razorpay
                        if (paymentResponse.data.note) {
                          // Demo mode - show success with choice buttons
                          toast({
                            title: "Purchase Successful! 🎉",
                            description: `You've bought ${order.grams}g of gold for ₹${order.amountINR}. ${paymentResponse.data.note}`
                          })
                          
                          // Add choice buttons for next action
                          const successMessage: ChatMessage = {
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: `Congratulations! Your gold purchase was successful. You now own ${order.grams}g of gold worth ₹${order.amountINR}.`,
                            timestamp: new Date(),
                            metadata: {
                              type: 'choice_buttons',
                              options: [
                                {
                                  label: 'Buy More Gold',
                                  action: 'buy_more',
                                  variant: 'default'
                                },
                                {
                                  label: 'View Portfolio',
                                  action: 'view_portfolio',
                                  variant: 'outline'
                                },
                                {
                                  label: 'Back to Chat',
                                  action: 'back_to_chat',
                                  variant: 'outline'
                                }
                              ]
                            }
                          }
                          setMessages(prev => [...prev, successMessage])
                          
                        } else if (paymentResponse.data.razorpayOrder) {
                          // Real Razorpay mode - initialize Razorpay
                          const options = {
                            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                            amount: paymentResponse.data.razorpayOrder.amount,
                            currency: paymentResponse.data.razorpayOrder.currency,
                            name: 'AuroraGold',
                            description: `Purchase ${order.grams}g gold`,
                            order_id: paymentResponse.data.razorpayOrder.id,
                            handler: async function (response: any) {
                              try {
                                // Verify payment
                                const verifyResponse = await api.post(`/gold/orders/${order.id}/verify`, {
                                  razorpay_order_id: response.razorpay_order_id,
                                  razorpay_payment_id: response.razorpay_payment_id,
                                  razorpay_signature: response.razorpay_signature
                                })
                                
                                toast({
                                  title: "Payment Verified! 🎉",
                                  description: `Successfully purchased ${order.grams}g of gold for ₹${order.amountINR}.`
                                })
                                
                                // Refresh portfolio and reset amount
                                if (user) {
                                  fetchPortfolio()
                                }
                                setGoldAmount('500')
                                
                              } catch (verifyError) {
                                console.error('Payment verification failed:', verifyError)
                                toast({
                                  title: "Verification Failed",
                                  description: "Payment completed but verification failed. Contact support.",
                                  variant: "destructive"
                                })
                              }
                            },
                            prefill: {
                              name: user.name,
                              email: user.email
                            },
                            theme: {
                              color: '#D4AF37'
                            }
                          }
                          
                          // Initialize Razorpay payment
                          if (typeof window !== 'undefined' && (window as any).Razorpay) {
                            const rzp = new (window as any).Razorpay(options)
                            rzp.open()
                          } else {
                            toast({
                              title: "Payment Gateway Error",
                              description: "Razorpay is not loaded. Please refresh and try again.",
                              variant: "destructive"
                            })
                          }
                        } else {
                          // Fallback success case
                          toast({
                            title: "Purchase Successful! 🎉",
                            description: `You've bought ${order.grams}g of gold for ₹${order.amountINR}.`
                          })
                        }

                        // Refresh portfolio
                        if (user) {
                          fetchPortfolio()
                        }

                        // Reset amount for demo mode
                        if (paymentResponse.data.note) {
                          setGoldAmount('500')
                        }
                        
                      } catch (error: unknown) {
                        console.error('Purchase error:', error)
                        
                        // Properly handle the error typing
                        let errorMessage = "Failed to process purchase. Please try again."
                        let errorDetails = ""
                        
                        if (error && typeof error === 'object' && 'response' in error) {
                          const axiosError = error as { response?: { data?: { error?: string, details?: string }, status?: number } }
                          errorMessage = axiosError.response?.data?.error || errorMessage
                          errorDetails = axiosError.response?.data?.details || ""
                          
                          // Add more context based on status code
                          if (axiosError.response?.status === 500) {
                            errorMessage = "Server error occurred. Please check the console for details."
                          } else if (axiosError.response?.status === 401) {
                            errorMessage = "Authentication failed. Please log in again."
                          } else if (axiosError.response?.status === 404) {
                            errorMessage = "Order not found. Please try creating a new order."
                          }
                        }
                        
                        console.error('Detailed error info:', { errorMessage, errorDetails })
                        
                        toast({
                          title: "Purchase Failed",
                          description: `${errorMessage}${errorDetails ? ` Details: ${errorDetails}` : ''}`,
                          variant: "destructive",
                          action: (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Add choice buttons for retry options
                                const retryMessage: ChatMessage = {
                                  id: Date.now().toString(),
                                  role: 'assistant',
                                  content: 'Your purchase failed. Would you like to try again or explore other options?',
                                  timestamp: new Date(),
                                  metadata: {
                                    type: 'choice_buttons',
                                    options: [
                                      {
                                        label: 'Try Again',
                                        action: 'retry_purchase',
                                        variant: 'default'
                                      },
                                      {
                                        label: 'Check Gold Price',
                                        action: 'check_price',
                                        variant: 'outline'
                                      },
                                      {
                                        label: 'Get Help',
                                        action: 'get_help',
                                        variant: 'outline'
                                      }
                                    ]
                                  }
                                }
                                setMessages(prev => [...prev, retryMessage])
                                setCurrentPage('chat') // Navigate to chat to see the options
                              }}
                            >
                              Options
                            </Button>
                          )
                        })
                      }
                    }}
                  >
                    Buy Now
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Quick Buy Options */}
            <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl">Quick Buy</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {["500", "1000", "2500", "5000"].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      className="glassmorphism h-14 sm:h-16 flex flex-col bg-transparent"
                      onClick={() => setGoldAmount(amount)}
                    >
                      <span className="text-base sm:text-lg font-bold">₹{amount}</span>
                      <span className="text-xs text-muted-foreground">
                        {goldPrice ? (Number.parseInt(amount) / goldPrice.price).toFixed(2) : 'Loading...'}g
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Portfolio Page */}
        {currentPage === "portfolio" && user && portfolio && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
                <CardHeader className="px-4 sm:px-6 pb-2">
                  <CardTitle className="text-sm font-medium">Total Gold</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold text-primary">{portfolio.summary.totalGoldGrams.toFixed(2)}g</div>
                  <p className="text-xs text-muted-foreground">≈ ₹{portfolio.summary.currentValue.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
                <CardHeader className="px-4 sm:px-6 pb-2">
                  <CardTitle className="text-sm font-medium">Today's P&L</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className={`text-xl sm:text-2xl font-bold ${portfolio.todayPerformance.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {portfolio.todayPerformance.trend === 'up' ? '+' : ''}₹{portfolio.todayPerformance.change}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {portfolio.todayPerformance.trend === 'up' ? '+' : ''}{portfolio.todayPerformance.changePercent}%
                  </p>
                </CardContent>
              </Card>

              <Card className="neumorphism border-border/20 mx-2 sm:mx-0 sm:col-span-2 lg:col-span-1">
                <CardHeader className="px-4 sm:px-6 pb-2">
                  <CardTitle className="text-sm font-medium">Total Return</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className={`text-xl sm:text-2xl font-bold ${portfolio.summary.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {portfolio.summary.profitLoss >= 0 ? '+' : ''}₹{portfolio.summary.profitLoss}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {portfolio.summary.profitLossPercent >= 0 ? '+' : ''}{portfolio.summary.profitLossPercent}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-4">
                  {portfolio.recentTransactions.length > 0 ? (
                    portfolio.recentTransactions.map((transaction: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg glassmorphism">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Coins className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm sm:text-base">{transaction.type} Gold</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {new Date(transaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm sm:text-base">₹{transaction.amountINR.toLocaleString()}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{transaction.grams.toFixed(3)}g</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">No transactions yet</p>
                      <p className="text-xs sm:text-sm">Start investing in gold to see your history here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Portfolio Page - Not logged in */}
        {currentPage === "portfolio" && !user && (
          <div className="text-center py-16 mx-2 sm:mx-0">
            <User className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base">Please log in to view your portfolio</p>
            <Button onClick={() => setCurrentPage('login')} className="glow-gold">
              Login Now
            </Button>
          </div>
        )}

        {/* Profile Page */}
        {currentPage === "profile" && user && (
          <div className="space-y-6">
            <Card className="neumorphism border-border/20 mx-2 sm:mx-0">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl">Profile Settings</CardTitle>
                <CardDescription className="text-sm">Manage your AuroraGold account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-4 sm:px-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-12 h-12 sm:w-16 sm:h-16">
                    <AvatarFallback className="bg-gradient-to-r from-primary to-chart-2 text-primary-foreground text-lg sm:text-xl">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">{user.name}</h3>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                    <Badge variant={user.kycStatus === 'VERIFIED' ? 'default' : 'secondary'} className="mt-1 text-xs">
                      KYC: {user.kycStatus}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 text-sm sm:text-base">Investment Goals</h4>
                    <Progress value={(user.assets.totalInvested / user.preferences.investmentGoal) * 100} className="h-2" />
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {((user.assets.totalInvested / user.preferences.investmentGoal) * 100).toFixed(1)}% towards your ₹{user.preferences.investmentGoal.toLocaleString()} goal
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg glassmorphism">
                      <h5 className="font-medium text-sm sm:text-base">Risk Level</h5>
                      <p className="text-xs sm:text-sm text-muted-foreground">{user.preferences.riskLevel}</p>
                    </div>
                    <div className="p-4 rounded-lg glassmorphism">
                      <h5 className="font-medium text-sm sm:text-base">Gold Holdings</h5>
                      <p className="text-xs sm:text-sm text-muted-foreground">{user.assets.goldGrams.toFixed(3)}g</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full glassmorphism bg-transparent text-sm sm:text-base">
                    Edit Profile
                  </Button>
                  <Button variant="outline" className="w-full glassmorphism bg-transparent text-sm sm:text-base">
                    Security Settings
                  </Button>
                  <Button variant="outline" className="w-full glassmorphism bg-transparent text-sm sm:text-base">
                    Notification Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Profile Page - Not logged in */}
        {currentPage === "profile" && !user && (
          <div className="text-center py-16 mx-2 sm:mx-0">
            <User className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base">Please log in to view your profile</p>
            <Button onClick={() => setCurrentPage('login')} className="glow-gold">
              Login Now
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
