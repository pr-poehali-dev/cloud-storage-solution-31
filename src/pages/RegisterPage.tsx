import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import { apiRegister } from '@/lib/api'
import PageLayout from '@/components/landing/PageLayout'

export default function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [refCode, setRefCode] = useState(searchParams.get('ref') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiRegister({ name, email, password, referral_code: refCode || undefined })
      await login(res.session_id)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageLayout imgIndex={1}>
      <div className="min-h-screen flex">
        {/* Левая колонка */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF4D00] flex items-center justify-center">
              <Icon name="TrendingUp" size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">AdDividends</span>
          </Link>
          <div>
            <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
              Начните получать<br />
              <span className="text-[#FF4D00]">дивиденды</span><br />
              уже сегодня
            </h2>
            <p className="text-neutral-400 text-sm mb-8 max-w-sm">
              Регистрация занимает меньше минуты. Минимальный вход — от 100 ₽.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '10%', label: 'в неделю' },
                { value: '100 ₽', label: 'минимум' },
                { value: '24/7', label: 'начисления' },
                { value: '5%', label: 'реф. бонус' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-[#FF4D00] text-2xl font-bold">{s.value}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-neutral-600 text-xs mt-8">© 2025 ИП Терешев Ислам Мухамедович</p>
          </div>
        </div>

        {/* Правая колонка — форма */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-[#FF4D00] flex items-center justify-center">
                <Icon name="TrendingUp" size={16} className="text-white" />
              </div>
              <span className="text-white font-bold text-lg">AdDividends</span>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Создать аккаунт</h1>
              <p className="text-neutral-400 text-sm mb-7">
                Уже есть аккаунт?{' '}
                <Link to="/login" className="text-[#FF4D00] hover:underline">Войти</Link>
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-neutral-300 mb-1.5 block text-sm">Имя</Label>
                  <Input
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="Иван Иванов" required
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11"
                  />
                </div>
                <div>
                  <Label className="text-neutral-300 mb-1.5 block text-sm">Email</Label>
                  <Input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11"
                  />
                </div>
                <div>
                  <Label className="text-neutral-300 mb-1.5 block text-sm">Пароль</Label>
                  <Input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов" required minLength={6}
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11"
                  />
                </div>
                <div>
                  <Label className="text-neutral-300 mb-1.5 block text-sm">
                    Реферальный код <span className="text-neutral-600">(необязательно)</span>
                  </Label>
                  <Input
                    value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXXXX" maxLength={8}
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] font-mono h-11"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <Icon name="AlertCircle" size={14} className="text-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  type="submit" disabled={loading} size="lg"
                  className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0 h-11 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Создаём аккаунт...
                    </span>
                  ) : 'Зарегистрироваться'}
                </Button>
              </form>
            </div>

            <p className="text-center mt-5">
              <Link to="/" className="text-neutral-600 hover:text-neutral-400 text-sm flex items-center justify-center gap-1 transition-colors">
                <Icon name="ArrowLeft" size={13} /> На главную
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  )
}
