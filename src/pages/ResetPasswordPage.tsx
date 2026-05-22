import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import Layout from '@/components/landing/Layout'
import func2url from '../../backend/func2url.json'

const LOGIN_URL = (func2url as Record<string, string>)['auth-login']

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Минимум 6 символов'); return }
    if (password !== password2) { setError('Пароли не совпадают'); return }

    setLoading(true)
    try {
      const res = await fetch(LOGIN_URL + '/reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Ошибка')
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="h-full flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <Link to="/login" className="text-neutral-500 hover:text-neutral-300 text-sm flex items-center gap-1 mb-6">
              <Icon name="ArrowLeft" size={14} /> Ко входу
            </Link>
            <h1 className="text-3xl font-bold text-white">Новый пароль</h1>
            <p className="text-neutral-400 mt-2 text-sm">Придумайте надёжный пароль</p>
          </div>

          {done ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
              <Icon name="CheckCircle" size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-semibold">Пароль изменён!</p>
              <p className="text-neutral-400 text-sm mt-2">Перенаправляем на страницу входа...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div>
                <Label className="text-neutral-300 mb-1.5 block">Новый пароль</Label>
                <div className="relative">
                  <Input
                    type={show ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов" required
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] pr-10"
                  />
                  <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                    <Icon name={show ? 'EyeOff' : 'Eye'} size={16} />
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-neutral-300 mb-1.5 block">Повторите пароль</Label>
                <Input
                  type={show ? 'text' : 'password'}
                  value={password2} onChange={e => setPassword2(e.target.value)}
                  placeholder="Повторите пароль" required
                  className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00]"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <Icon name="AlertCircle" size={15} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} size="lg" className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0">
                {loading ? 'Сохраняем...' : 'Сохранить пароль'}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </Layout>
  )
}
