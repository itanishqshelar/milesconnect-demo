'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Customer } from '@/lib/types/database'

// Phone number validation - Indian format (10 digits)
function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^[0-9]{10}$/
  return phoneRegex.test(phone)
}

// Search customers by name or phone number
export async function searchCustomers(query: string): Promise<Customer[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error searching customers:', error)
    return []
  }

  return data || []
}

// Create a new customer
export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const phoneNumber = formData.get('phone_number') as string

  // Validation
  if (!name || !name.trim()) {
    return { error: 'Customer name is required' }
  }

  if (!phoneNumber || !phoneNumber.trim()) {
    return { error: 'Phone number is required' }
  }

  // Validate phone number format
  if (!validatePhoneNumber(phoneNumber)) {
    return { error: 'Invalid phone number. Please enter a 10-digit mobile number' }
  }

  // Check if phone number already exists
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (existingCustomer) {
    return { 
      error: 'A customer with this phone number already exists',
      existingCustomer 
    }
  }

  // Insert new customer
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: name.trim(),
      phone_number: phoneNumber,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating customer:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/shipments')
  return { success: true, customer: data }
}

// Get customer by ID
export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching customer:', error)
    return null
  }

  return data
}

// Get or create customer - useful for shipment creation
export async function getOrCreateCustomer(name: string, phoneNumber: string) {
  const supabase = await createClient()

  // Validation
  if (!name || !name.trim()) {
    return { error: 'Customer name is required' }
  }

  if (!phoneNumber || !phoneNumber.trim()) {
    return { error: 'Phone number is required' }
  }

  // Validate phone number format
  if (!validatePhoneNumber(phoneNumber)) {
    return { error: 'Invalid phone number. Please enter a 10-digit mobile number' }
  }

  // Check if customer exists
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (existingCustomer) {
    // Update name if different
    if (existingCustomer.name !== name.trim()) {
      await supabase
        .from('customers')
        .update({ name: name.trim() })
        .eq('id', existingCustomer.id)
    }
    return { success: true, customer: existingCustomer }
  }

  // Create new customer
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      name: name.trim(),
      phone_number: phoneNumber,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating customer:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/shipments')
  return { success: true, customer: newCustomer }
}
