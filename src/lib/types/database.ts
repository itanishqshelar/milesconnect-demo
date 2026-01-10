export type DriverStatus = 'idle' | 'working'
export type VehicleStatus = 'idle' | 'in_use'
export type ShipmentStatus = 'pending' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled'
export type PaymentStatus = 'pending' | 'initiated' | 'completed' | 'failed'

export interface Customer {
  id: string
  name: string
  phone_number: string
  login_otp: string | null
  login_otp_expires_at: string | null
  created_at: string
}

export interface Driver {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: DriverStatus
  created_at: string
}

export type TrackingMode = 'simulated' | 'live'

export interface Vehicle {
  id: string
  type: string
  license_plate: string
  status: VehicleStatus
  latitude: number | null
  longitude: number | null
  last_location_update: string | null
  current_route: RouteGeometry | null
  route_index: number
  eta: string | null
  tracking_mode: TrackingMode
  created_at: string
}

// Route geometry from Mapbox Directions API
export interface RouteGeometry {
  coordinates: [number, number][] // [lng, lat] pairs
  duration: number // total duration in seconds
  distance: number // total distance in meters
}

export interface Shipment {
  id: string
  shipment_number: string
  start_location: string
  destination: string
  start_lat: number | null
  start_lng: number | null
  dest_lat: number | null
  dest_lng: number | null
  status: ShipmentStatus
  revenue: number | null
  driver_id: string | null
  vehicle_id: string | null
  customer_id: string | null
  created_at: string
  delivered_at: string | null
  // Secure Handshake fields
  delivery_otp: string | null
  otp_generated_at: string | null
  otp_verified_at: string | null
  payment_status: PaymentStatus | null
  payment_transaction_id: string | null
  payment_completed_at: string | null
  phonepe_order_id: string | null
}

export interface ShipmentWithRelations extends Shipment {
  drivers: Driver | null
  vehicles: Vehicle | null
  customers: Customer | null
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>
      }
      drivers: {
        Row: Driver
        Insert: Omit<Driver, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Driver, 'id' | 'created_at'>>
      }
      vehicles: {
        Row: Vehicle
        Insert: Omit<Vehicle, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Vehicle, 'id' | 'created_at'>>
      }
      shipments: {
        Row: Shipment
        Insert: Omit<Shipment, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Shipment, 'id' | 'created_at'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
