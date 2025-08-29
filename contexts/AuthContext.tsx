"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

interface User {
  id: string
  name: string
  email: string
  assets: {
    goldGrams: number
    avgPrice: number
    totalInvested: number
  }
  kycStatus: string
  preferences: {
    investmentGoal: number
    riskLevel: string
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (name: string, email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
  token: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Configure axios base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://aurora-backend-sd5l.onrender.com/api' 

    : 'http://localhost:3001/api')

axios.defaults.baseURL = API_BASE_URL

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  // Set up axios interceptor for auth token
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      setToken(storedToken)
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
    }

    // Add request interceptor to include token
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem('auth_token')
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Add response interceptor to handle auth errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('auth_token')
          setToken(null)
          setUser(null)
          delete axios.defaults.headers.common['Authorization']
        }
        return Promise.reject(error)
      }
    )

    return () => {
      axios.interceptors.request.eject(requestInterceptor)
      axios.interceptors.response.eject(responseInterceptor)
    }
  }, [])

  // Verify token on app start
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('auth_token')
      
      if (!storedToken) {
        setLoading(false)
        return
      }

      try {
        const response = await axios.get('/auth/verify')
        setUser(response.data.user)
        setToken(storedToken)
      } catch (error) {
        console.error('Token verification failed:', error)
        localStorage.removeItem('auth_token')
        delete axios.defaults.headers.common['Authorization']
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      const response = await axios.post('/auth/login', { email, password })
      
      const { token: authToken, user: userData } = response.data
      
      // Store token
      localStorage.setItem('auth_token', authToken)
      setToken(authToken)
      setUser(userData)
      
      // Set axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
      
      return { success: true }
    } catch (error: any) {
      console.error('Login error:', error)
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed. Please try again.' 
      }
    } finally {
      setLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string, confirmPassword: string) => {
    try {
      setLoading(true)
      const response = await axios.post('/auth/signup', {
        name,
        email,
        password,
        confirmPassword
      })
      
      const { token: authToken, user: userData } = response.data
      
      // Store token
      localStorage.setItem('auth_token', authToken)
      setToken(authToken)
      setUser(userData)
      
      // Set axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
      
      return { success: true }
    } catch (error: any) {
      console.error('Signup error:', error)
      return { 
        success: false, 
        error: error.response?.data?.error || 'Signup failed. Please try again.' 
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
    
    // Call logout endpoint
    axios.post('/auth/logout').catch(() => {
      // Ignore errors for logout
    })
  }

  const refreshUser = async () => {
    if (!token) return
    
    try {
      const response = await axios.get('/auth/verify')
      setUser(response.data.user)
    } catch (error) {
      console.error('Failed to refresh user:', error)
      logout() // If refresh fails, log out user
    }
  }

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
    token
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Utility function for API calls
export const api = {
  get: (url: string) => axios.get(url),
  post: (url: string, data?: any) => axios.post(url, data),
  put: (url: string, data?: any) => axios.put(url, data),
  delete: (url: string) => axios.delete(url)
}

export default AuthContext
