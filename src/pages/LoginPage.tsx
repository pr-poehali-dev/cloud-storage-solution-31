import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import { apiLogin } from '@/lib/api'
import PageLayout from '@/components/landing/PageLayout'

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
    <PageLayout imgIndex={0}>
      <div className="min-h-screen flex">
        {/* Левая колонка — декоративная */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF4D00] flex items-center justify-center">
              <Icon name="TrendingUp" size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">AdDividends</span>
          </Link>
          <div>
            <div className="space-y-6 mb-12">
              {[
                { icon: 'TrendingUp', title: '10% дивидендов в неделю', desc: 'Начисляется каждую секунду автоматически' },
                { icon: 'Zap', title: 'Мгновенное пополнение', desc: 'Карта, СБП или криптовалюта' },
                { icon: 'Shield', title: 'Надёжно и прозрачно', desc: 'Все начисления видны в личном кабинете' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FF4D00]/20 border border-[#FF4D00]/30 flex items-center justify-center shrink-0">
                    <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={18} className="text-[#FF4D00]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{item.title}</p>
                    <p className="text-neutral-500 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-neutral-600 text-xs">© 2025 ИП Терешев Ислам Мухамедович</p>
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
            {/* Мобильный логотип */}
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-[#FF4D00] flex items-center justify-center">
                <Icon name="TrendingUp" size={16} className="text-white" />
              </div>
              <span className="text-white font-bold text-lg">AdDividends</span>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Вход в кабинет</h1>
              <p className="text-neutral-400 text-sm mb-7">
                Нет аккаунта?{' '}
                <Link to="/register" className="text-[#FF4D00] hover:underline">Зарегистрироваться</Link>
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="••••••••" required
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11"
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
                      Входим...
                    </span>
                  ) : 'Войти'}
                </Button>

                <p className="text-center">
                  <Link to="/forgot-password" className="text-neutral-500 hover:text-[#FF4D00] text-sm transition-colors">
                    Забыли пароль?
                  </Link>
                </p>
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
