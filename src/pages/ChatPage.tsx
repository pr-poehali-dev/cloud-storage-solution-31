import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import {
  apiChatList, apiChatSend, apiSupportHistory, apiSupportSend,
  type ChatMessage, type SupportMessage,
} from '@/lib/api'

// ── Онлайн-счётчик ─────────────────────────────────────────────
function useOnline() {
  const [n, setN] = useState(() => Math.floor(Math.random() * 341) + 250)
  useEffect(() => {
    const iv = setInterval(() => setN(p => Math.max(250, Math.min(590, p + Math.floor(Math.random() * 7) - 3))), 4000)
    return () => clearInterval(iv)
  }, [])
  return n
}

// ── Аватар-пузырь ──────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-purple-600','bg-blue-600','bg-emerald-600','bg-orange-500',
  'bg-pink-600','bg-indigo-600','bg-teal-600','bg-rose-600',
]
function Avatar({ seed, name, size = 8 }: { seed: string; name: string; size?: number }) {
  const idx = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return (
    <div className={`w-${size} h-${size} rounded-full ${AVATAR_COLORS[idx]} flex items-center justify-center shrink-0 text-white font-bold text-xs`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

// ── Время ──────────────────────────────────────────────────────
function timeStr(d: string) {
  const dt = new Date(d)
  return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'только что'
  if (s < 3600) return Math.floor(s / 60) + ' мин'
  return Math.floor(s / 3600) + ' ч назад'
}

// ── Иконка типа сообщения ──────────────────────────────────────
function MsgTypeBadge({ type }: { type: string }) {
  if (type === 'complaint') return (
    <span className="text-[10px] bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-semibold">пожелание</span>
  )
  if (type === 'user') return (
    <span className="text-[10px] bg-purple-500/15 border border-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-semibold">участник</span>
  )
  return null
}

type Tab = 'live' | 'support'

export default function ChatPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const onlineCount = useOnline()

  const [tab, setTab] = useState<Tab>('live')

  // Live chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsgIds, setNewMsgIds] = useState<Set<number>>(new Set())
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const lastChatId = useRef(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Support
  const [supportMsgs, setSupportMsgs] = useState<SupportMessage[]>([])
  const [supportInput, setSupportInput] = useState('')
  const [supportSending, setSupportSending] = useState(false)
  const [supportTyping, setSupportTyping] = useState(false)
  const supportEndRef = useRef<HTMLDivElement>(null)

  // Редирект если не авторизован
  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  // Загрузка чата
  const loadChat = useCallback(async () => {
    try {
      const res = await apiChatList()
      const sorted = [...res.messages].sort((a, b) => a.id - b.id)
      setMessages(sorted)
      if (sorted.length) lastChatId.current = sorted[sorted.length - 1].id
    } catch { /* ignore */ }
  }, [])

  // Загрузка поддержки
  const loadSupport = useCallback(async () => {
    try {
      const res = await apiSupportHistory()
      setSupportMsgs(res.messages)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (user) { loadChat(); loadSupport() }
  }, [user, loadChat, loadSupport])

  // Polling чата каждые 4с
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiChatList(lastChatId.current || undefined)
        if (res.messages.length) {
          const sorted = [...res.messages].sort((a, b) => a.id - b.id)
          setNewMsgIds(new Set(sorted.map(m => m.id)))
          setMessages(prev => [...prev, ...sorted].slice(-80))
          lastChatId.current = sorted[sorted.length - 1].id
          setTimeout(() => setNewMsgIds(new Set()), 2500)
        }
      } catch { /* ignore */ }
    }, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  useEffect(() => {
    supportEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [supportMsgs])

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatSending) return
    const text = chatInput.trim()
    setChatInput('')
    setChatSending(true)
    try {
      await apiChatSend(text)
      await loadChat()
    } catch { /* ignore */ }
    finally { setChatSending(false) }
  }

  const handleSupportSend = async () => {
    if (!supportInput.trim() || supportSending) return
    const text = supportInput.trim()
    setSupportInput('')
    setSupportSending(true)
    setSupportTyping(false)
    try {
      const res = await apiSupportSend(text)
      setSupportMsgs(prev => [...prev, res.user_msg])
      setSupportTyping(true)
      setTimeout(() => {
        setSupportTyping(false)
        setSupportMsgs(prev => [...prev, res.bot_msg])
      }, 1200)
    } catch { /* ignore */ }
    finally { setSupportSending(false) }
  }

  const userName = user?.name || user?.email?.split('@')[0] || 'Гость'

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">

      {/* Header */}
      <div className="border-b border-white/8 bg-[#0a0a0a] px-4 md:px-6 py-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Icon name="ArrowLeft" size={15} className="text-neutral-400" />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Icon name="MessageSquare" size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base">ADFUND Community</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs font-medium tabular-nums">{onlineCount.toLocaleString('ru-RU')}</span>
                <span className="text-neutral-600 text-xs">человек онлайн</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/5 border border-white/8 rounded-xl p-1 gap-1">
            {([
              { key: 'live',    label: 'Live Чат',   icon: 'MessageCircle' },
              { key: 'support', label: 'Поддержка',  icon: 'Headphones'    },
            ] as { key: Tab; label: string; icon: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.key ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}>
                <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 md:px-6 py-4 min-h-0">
        <AnimatePresence mode="wait">

          {/* ── LIVE CHAT ───────────────────────────────────── */}
          {tab === 'live' && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col flex-1 min-h-0 gap-4">

              {/* Баннер */}
              <div className="bg-gradient-to-r from-purple-500/8 via-pink-500/5 to-transparent border border-purple-500/15 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Icon name="Flame" size={15} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Общий чат платформы</p>
                  <p className="text-neutral-500 text-xs">Делитесь опытом, задавайте вопросы и общайтесь с другими инвесторами</p>
                </div>
              </div>

              {/* Сообщения */}
              <div className="flex-1 bg-white/2 border border-white/8 rounded-2xl overflow-y-auto p-4 space-y-3"
                style={{ minHeight: 0, maxHeight: 'calc(100vh - 320px)' }}>
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-700 gap-2 py-12">
                    <Icon name="MessageCircle" size={32} className="opacity-30" />
                    <p className="text-sm">Загрузка сообщений...</p>
                  </div>
                )}
                {messages.map(msg => (
                  <motion.div key={msg.id}
                    initial={newMsgIds.has(msg.id) ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2.5 ${msg.msg_type === 'user' && !msg.is_bot ? 'flex-row-reverse' : ''}`}>
                    <Avatar seed={msg.avatar_seed} name={msg.username} size={8} />
                    <div className={`flex-1 max-w-[75%] ${msg.msg_type === 'user' && !msg.is_bot ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-neutral-400">{msg.username}</span>
                        <MsgTypeBadge type={msg.is_bot ? msg.msg_type : 'user'} />
                        <span className="text-[10px] text-neutral-700">{timeAgo(msg.created_at)}</span>
                      </div>
                      <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        !msg.is_bot
                          ? 'bg-gradient-to-br from-purple-600/30 to-purple-800/20 border border-purple-500/20 text-white'
                          : msg.msg_type === 'complaint'
                            ? 'bg-yellow-500/8 border border-yellow-500/15 text-neutral-200'
                            : 'bg-white/5 border border-white/8 text-neutral-200'
                      }`}>
                        {msg.message}
                        {msg.msg_type === 'review' && msg.is_bot && (
                          <span className="ml-1 text-green-400 text-xs">✓</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Ввод */}
              <div className="flex gap-2 shrink-0">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-purple-500/40 transition-colors">
                  <Avatar seed={String(user?.id ?? '0')} name={userName} size={7} />
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                    placeholder="Написать в чат..."
                    maxLength={500}
                    className="flex-1 bg-transparent text-white placeholder:text-neutral-600 text-sm focus:outline-none"
                  />
                  <span className="text-neutral-700 text-xs">{chatInput.length}/500</span>
                </div>
                <button onClick={handleChatSend} disabled={chatSending || !chatInput.trim()}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center justify-center shrink-0 disabled:opacity-40 transition-all shadow-lg shadow-purple-500/20">
                  {chatSending
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Icon name="Send" size={16} className="text-white" />
                  }
                </button>
              </div>

              <p className="text-neutral-700 text-xs text-center shrink-0">
                Обновляется в реальном времени · Соблюдайте правила общения
              </p>
            </motion.div>
          )}

          {/* ── SUPPORT ─────────────────────────────────────── */}
          {tab === 'support' && (
            <motion.div key="support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col flex-1 min-h-0 gap-4">

              {/* Баннер */}
              <div className="bg-gradient-to-r from-blue-500/8 via-cyan-500/5 to-transparent border border-blue-500/15 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <Icon name="Bot" size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Бот-помощник ADFUND</p>
                    <p className="text-neutral-500 text-xs">Отвечает мгновенно · Работает 24/7</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">онлайн</span>
                </div>
              </div>

              {/* Подсказки тем */}
              <div className="flex flex-wrap gap-2 shrink-0">
                {['Вывод средств','Депозит','Дивиденды','Буст','Реферал','Обменник','Колесо'].map(topic => (
                  <button key={topic} onClick={() => setSupportInput(topic)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all">
                    {topic}
                  </button>
                ))}
              </div>

              {/* Диалог */}
              <div className="flex-1 bg-white/2 border border-white/8 rounded-2xl overflow-y-auto p-4 space-y-4"
                style={{ minHeight: 0, maxHeight: 'calc(100vh - 380px)' }}>
                {supportMsgs.map((msg, i) => (
                  <motion.div key={msg.id ?? i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'bot' ? (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                        <Icon name="Bot" size={14} className="text-white" />
                      </div>
                    ) : (
                      <Avatar seed={String(user?.id ?? '0')} name={userName} size={8} />
                    )}
                    <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-neutral-700">
                        {msg.role === 'bot' ? 'Поддержка' : userName} · {timeStr(msg.created_at)}
                      </span>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-purple-600/30 to-purple-800/20 border border-purple-500/20 text-white'
                          : 'bg-blue-500/8 border border-blue-500/15 text-neutral-200'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Анимация печатания */}
                <AnimatePresence>
                  {supportTyping && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex gap-2.5 items-end">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                        <Icon name="Bot" size={14} className="text-white" />
                      </div>
                      <div className="bg-blue-500/8 border border-blue-500/15 rounded-2xl px-4 py-3 flex gap-1 items-center">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={supportEndRef} />
              </div>

              {/* Ввод */}
              <div className="flex gap-2 shrink-0">
                <input
                  value={supportInput}
                  onChange={e => setSupportInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSupportSend()}
                  placeholder="Ваш вопрос..."
                  maxLength={500}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white placeholder:text-neutral-600 text-sm focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <button onClick={handleSupportSend} disabled={supportSending || !supportInput.trim()}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 flex items-center justify-center shrink-0 disabled:opacity-40 transition-all shadow-lg shadow-blue-500/15">
                  {supportSending
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Icon name="Send" size={16} className="text-white" />
                  }
                </button>
              </div>

              <p className="text-neutral-700 text-xs text-center shrink-0">
                Для сложных вопросов — <a href="https://poehali.dev/help" target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400 transition-colors">тикет-система поддержки</a>
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
