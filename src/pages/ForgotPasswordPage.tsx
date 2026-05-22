import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import Layout from '@/components/landing/Layout'
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
      await fetch(LOGIN_URL + '/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setDone(true)
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.')
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
              <Icon name="ArrowLeft" size={14} /> Назад ко входу
            </Link>
            <h1 className="text-3xl font-bold text-white">Забыли пароль?</h1>
            <p className="text-neutral-400 mt-2 text-sm">Введите email — пришлём ссылку для сброса</p>
          </div>

          {done ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
              <Icon name="Mail" size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-semibold">Письмо отправлено!</p>
              <p className="text-neutral-400 text-sm mt-2">Проверьте почту и перейдите по ссылке. Ссылка действует 1 час.</p>
              <Link to="/login">
                <Button className="mt-5 w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0">
                  Вернуться ко входу
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div>
                <Label className="text-neutral-300 mb-1.5 block">Email</Label>
                <Input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
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
                {loading ? 'Отправляем...' : 'Отправить ссылку'}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </Layout>
  )
}
