"use client"

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, RefreshCw, WifiOff } from 'lucide-react'

// Loading Spinner Component
export function LoadingSpinner({ size = 'default', text }: { size?: 'sm' | 'default' | 'lg', text?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin`} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  )
}

// Loading Card Component
export function LoadingCard({ title, description }: { title?: string, description?: string }) {
  return (
    <Card className="animate-pulse">
      <CardContent className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <LoadingSpinner size="lg" />
          {title && <h3 className="font-medium">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// Error State Component
export function ErrorState({ 
  title = "Something went wrong", 
  message = "An unexpected error occurred. Please try again.", 
  onRetry,
  showRetry = true 
}: { 
  title?: string
  message?: string
  onRetry?: () => void
  showRetry?: boolean 
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {showRetry && onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Network Status Component
export function NetworkStatus({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground p-2 text-center text-sm z-50">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>You're offline. Some features may not work properly.</span>
      </div>
    </div>
  )
}

// Skeleton components for loading states
export function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded w-1/2"></div>
          <div className="h-3 bg-muted rounded w-full"></div>
          <div className="h-3 bg-muted rounded w-2/3"></div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center space-x-3 p-3 rounded-lg border">
          <div className="w-8 h-8 bg-muted rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
          <div className="h-4 bg-muted rounded w-16"></div>
        </div>
      ))}
    </div>
  )
}

// Retry wrapper component
export function RetryWrapper({ 
  children, 
  fallback, 
  onRetry 
}: { 
  children: React.ReactNode
  fallback: React.ReactNode
  onRetry: () => void 
}) {
  const [hasError, setHasError] = React.useState(false)

  React.useEffect(() => {
    setHasError(false)
  }, [children])

  const handleRetry = () => {
    setHasError(false)
    onRetry()
  }

  if (hasError) {
    return (
      <ErrorState 
        onRetry={handleRetry}
        title="Failed to load"
        message="Unable to load this content. Please try again."
      />
    )
  }

  return (
    <React.Suspense fallback={fallback}>
      {children}
    </React.Suspense>
  )
}