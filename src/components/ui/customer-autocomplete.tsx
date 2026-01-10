'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from './input'
import { User, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Customer } from '@/lib/types/database'
import { searchCustomers } from '@/lib/actions/customers'

interface CustomerAutocompleteProps {
  id: string
  name: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  onCustomerSelect?: (customer: Customer) => void
  onCreateNew?: () => void
  className?: string
}

export function CustomerAutocomplete({
  id,
  name,
  placeholder = 'Search by name or phone...',
  required = false,
  defaultValue = '',
  onCustomerSelect,
  onCreateNew,
  className,
}: CustomerAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue)
  const [results, setResults] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const searchCustomersList = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)

    try {
      const customers = await searchCustomers(searchQuery)
      setResults(customers)
      setIsOpen(true)
    } catch (error) {
      console.error('Error searching customers:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setSelectedCustomer(null)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchCustomersList(value)
    }, 300)
  }

  const handleSelectCustomer = (customer: Customer) => {
    setQuery(`${customer.name} (${customer.phone_number})`)
    setSelectedCustomer(customer)
    setIsOpen(false)
    setResults([])
    
    onCustomerSelect?.(customer)
  }

  const handleCreateNew = () => {
    setIsOpen(false)
    onCreateNew?.()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          type="text"
          placeholder={placeholder}
          required={required}
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Hidden input for form submission */}
      <input type="hidden" name={`${name}_id`} value={selectedCustomer?.id ?? ''} />

      {/* Dropdown results */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {results.length > 0 ? (
              results.map((customer) => (
                <li
                  key={customer.id}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="flex items-start gap-2">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">{customer.phone_number}</div>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No customers found
              </li>
            )}
            
            {/* Create new customer option */}
            {onCreateNew && (
              <>
                <li className="border-t">
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create new customer</span>
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
