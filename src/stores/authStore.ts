import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (phone: string, role: UserRole, name?: string) => void
  logout: () => void
  setUser: (user: User) => void
}

// Temporary mock users for development (will be replaced by Supabase Auth)
const MOCK_USERS: Record<string, User> = {
  '01700000000': {
    id: 'owner-1',
    name: 'মালিক সাহেব',
    phone: '01700000000',
    role: 'owner',
    created_at: new Date().toISOString(),
  },
  '01800000000': {
    id: 'staff-1',
    name: 'কর্মচারী রহিম',
    phone: '01800000000',
    role: 'staff',
    branch_id: 'branch-1',
    created_at: new Date().toISOString(),
  },
  '01900000000': {
    id: 'customer-1',
    name: 'ক্রেতা করিম',
    phone: '01900000000',
    role: 'customer',
    branch_id: 'branch-1',
    created_at: new Date().toISOString(),
  },
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (phone: string, role: UserRole, name?: string) => {
        // Check mock users first
        const existing = MOCK_USERS[phone]
        if (existing) {
          set({ user: existing, isAuthenticated: true })
          return
        }

        // Create temporary user
        const newUser: User = {
          id: `temp-${Date.now()}`,
          name: name || (role === 'owner' ? 'মালিক' : role === 'staff' ? 'কর্মচারী' : 'ক্রেতা'),
          phone,
          role,
          created_at: new Date().toISOString(),
        }
        set({ user: newUser, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true })
      },
    }),
    {
      name: 'shopledger-auth',
    }
  )
)
