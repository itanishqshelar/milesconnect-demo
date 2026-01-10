"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Truck, User, Users, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()

  const handleAdminLogin = () => {
    router.push("/dashboard")
  }

  const handleDriverLogin = () => {
    router.push("/driver/login")
  }

  const handleCustomerLogin = () => {
    router.push("/track")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Truck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">MilesConnect</CardTitle>
          <CardDescription>
            Fleet Management System - Select your role to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleAdminLogin} 
            className="w-full h-12 text-base"
            size="lg"
          >
            <ShieldCheck className="mr-2 h-5 w-5" />
            Admin Login
          </Button>
          
          <Button 
            onClick={handleDriverLogin} 
            variant="secondary"
            className="w-full h-12 text-base"
            size="lg"
          >
            <User className="mr-2 h-5 w-5" />
            Driver Login
          </Button>
          
          <Button 
            onClick={handleCustomerLogin} 
            variant="outline"
            className="w-full h-12 text-base"
            size="lg"
          >
            <Users className="mr-2 h-5 w-5" />
            Customer Login
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-4">
            This is a test login page. Authentication will be implemented later.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
