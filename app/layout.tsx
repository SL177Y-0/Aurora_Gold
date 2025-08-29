import type React from "react"
import type { Metadata } from "next"
import { Unica_One } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "../contexts/AuthContext"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import ErrorBoundary from "@/components/ErrorBoundary"

const unicaOne = Unica_One({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-unica-one",
})

export const metadata: Metadata = {
  title: "AuroraGold - AI Finance Assistant",
  description: "Futuristic AI-powered gold trading platform",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className={`font-sans ${unicaOne.variable} dark antialiased aurora-bg`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
