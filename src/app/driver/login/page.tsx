"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Truck, ArrowRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function DriverLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // Check if driver exists with this email
      const { data: driver, error: queryError } = await supabase
        .from('drivers')
        .select('id, name, email')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (queryError || !driver) {
        setError("No driver found with this email address")
        setIsLoading(false)
        return
      }

      // Store driver info in localStorage (will use proper auth later)
      localStorage.setItem('driver', JSON.stringify(driver))
      
      // Navigate to driver dashboard
      router.push('/driver/dashboard')
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Truck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold">Driver Login</CardTitle>
          <CardDescription className="text-sm">
            Enter your registered email to access your shipments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-12 text-base"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-base"
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground pt-2">
              OTP verification will be implemented later
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
