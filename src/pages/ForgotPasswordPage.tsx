import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import PageLayout from '@/components/landing/PageLayout'
import func2url from '../../backend/func2url.json'

const LOGIN_URL = (func2url as Record<string, string>)['auth-login']

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-request', email: email.trim().toLowerCase() }),
      })
      setDone(true)
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageLayout imgIndex={0}>
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <Link to="/login" className="text-neutral-500 hover:text-neutral-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
              <Icon name="ArrowLeft" size={14} /> Назад ко входу
            </Link>
            <div className="w-14 h-14 rounded-2xl bg-[#FF4D00]/20 border border-[#FF4D00]/30 flex items-center justify-center mb-5">
              <Icon name="KeyRound" size={26} className="text-[#FF4D00]" />
            </div>
            <h1 className="text-3xl font-bold text-white">Забыли пароль?</h1>
            <p className="text-neutral-400 mt-2 text-sm">Введите email — пришлём ссылку для сброса</p>
          </div>

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/10 border border-green-500/20 rounded-2xl p-7 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Icon name="Mail" size={28} className="text-green-400" />
              </div>
              <p className="text-green-400 font-semibold text-lg">Письмо отправлено!</p>
              <p className="text-neutral-400 text-sm mt-2 mb-6">Проверьте почту и перейдите по ссылке. Ссылка действует 1 час.</p>
              <Link to="/login">
                <Button className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0 h-11">
                  Вернуться ко входу
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-neutral-300 mb-1.5 block text-sm">Email</Label>
                  <Input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com" required
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11"
                  />
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
                      Отправляем...
                    </span>
                  ) : 'Отправить ссылку'}
                </Button>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </PageLayout>
  )
}
