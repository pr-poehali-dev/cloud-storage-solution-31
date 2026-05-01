import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiProfile, apiLogout } from '@/lib/api'

interface User {
  id: number; name: string; email: string; referral_code: string
  is_admin: boolean; deposit: number; dividends_total: number
  referral_total: number; referral_count: number; balance: number; rate: number
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (session_id: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async () => {
    const sid = localStorage.getItem('session_id')
    if (!sid) { setLoading(false); return }
    try {
      const profile = await apiProfile()
      setUser(profile)
    } catch {
      localStorage.removeItem('session_id')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfile() }, [])

  const login = async (session_id: string) => {
    localStorage.setItem('session_id', session_id)
    await fetchProfile()
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  const refresh = fetchProfile

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
