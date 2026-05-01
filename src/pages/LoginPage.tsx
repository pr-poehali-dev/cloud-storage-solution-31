import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { apiLogin } from '@/lib/api'
import Layout from '@/components/landing/Layout'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiLogin({ email, password })
      await login(res.session_id)
      navigate(res.is_admin ? '/admin' : '/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="h-full flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Вход в кабинет</h1>
          <p className="text-neutral-400 mb-8">Ещё нет аккаунта? <Link to="/register" className="text-[#FF4D00] hover:underline">Зарегистрироваться</Link></p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-neutral-300 mb-1.5 block">Email</Label>
              <Input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00]"
              />
            </div>
            <div>
              <Label className="text-neutral-300 mb-1.5 block">Пароль</Label>
              <Input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00]"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button
              type="submit" disabled={loading} size="lg"
              className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0"
            >
              {loading ? 'Входим...' : 'Войти'}
            </Button>
          </form>

          <p className="text-center mt-6">
            <Link to="/" className="text-neutral-500 hover:text-neutral-300 text-sm">← На главную</Link>
          </p>
        </motion.div>
      </div>
    </Layout>
  )
}
