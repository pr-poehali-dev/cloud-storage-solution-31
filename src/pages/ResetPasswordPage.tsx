import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import PageLayout from '@/components/landing/PageLayout'
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
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-confirm', token, password }),
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
    <PageLayout imgIndex={1}>
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <Link to="/login" className="text-neutral-500 hover:text-neutral-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
              <Icon name="ArrowLeft" size={14} /> Ко входу
            </Link>
            <div className="w-14 h-14 rounded-2xl bg-[#FF4D00]/20 border border-[#FF4D00]/30 flex items-center justify-center mb-5">
              <Icon name="LockKeyhole" size={26} className="text-[#FF4D00]" />
            </div>
            <h1 className="text-3xl font-bold text-white">Новый пароль</h1>
            <p className="text-neutral-400 mt-2 text-sm">Придумайте надёжный пароль</p>
          </div>

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/10 border border-green-500/20 rounded-2xl p-7 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Icon name="CheckCircle" size={28} className="text-green-400" />
              </div>
              <p className="text-green-400 font-semibold text-lg">Пароль изменён!</p>
              <p className="text-neutral-400 text-sm mt-2">Перенаправляем на страницу входа...</p>
              <div className="mt-4 flex gap-1 justify-center">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 bg-green-400/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-neutral-300 mb-1.5 block text-sm">Новый пароль</Label>
                  <div className="relative">
                    <Input
                      type={show ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Минимум 6 символов" required
                      className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] pr-10 h-11"
                    />
                    <button type="button" onClick={() => setShow(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                      <Icon name={show ? 'EyeOff' : 'Eye'} size={16} />
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                          password.length >= i * 3
                            ? i <= 1 ? 'bg-red-500' : i <= 2 ? 'bg-yellow-500' : i <= 3 ? 'bg-blue-500' : 'bg-green-500'
                            : 'bg-white/10'
                        }`} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-neutral-300 mb-1.5 block text-sm">Повторите пароль</Label>
                  <Input
                    type={show ? 'text' : 'password'}
                    value={password2} onChange={e => setPassword2(e.target.value)}
                    placeholder="Повторите пароль" required
                    className={`bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11 ${
                      password2 && password !== password2 ? 'border-red-500/50' : ''
                    }`}
                  />
                  {password2 && password === password2 && (
                    <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                      <Icon name="Check" size={12} /> Пароли совпадают
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <Icon name="AlertCircle" size={15} className="text-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <Button type="submit" disabled={loading} size="lg"
                  className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0 h-11">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Сохраняем...
                    </span>
                  ) : 'Сохранить пароль'}
                </Button>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </PageLayout>
  )
}
