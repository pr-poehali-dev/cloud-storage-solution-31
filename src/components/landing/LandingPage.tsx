import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import CryptoSection from './CryptoSection'
import ProfileSection from './ProfileSection'

const NAV_ITEMS = [
  { id: 'hero', label: 'Главная' },
  { id: 'how', label: 'Как работает' },
  { id: 'about', label: 'О нас' },
  { id: 'earn', label: 'Доходность' },
  { id: 'crypto', label: 'Рынок' },
  { id: 'docs', label: 'Документы' },
]

const HERO_BG = 'https://cdn.poehali.dev/projects/2b5d3111-5d96-4cb5-b82b-dd13610cf019/files/1d55520e-fe17-4ce5-9335-53ddb268fe9d.jpg'

const STEPS = [
  { icon: 'UserPlus', title: 'Регистрация', desc: 'Создайте аккаунт за 2 минуты — только имя и email. Никаких сложных форм.' },
  { icon: 'Wallet', title: 'Пополните баланс', desc: 'Карта, СБП или крипта — любым удобным способом от 100 ₽.' },
  { icon: 'TrendingUp', title: 'Получайте дивиденды', desc: '10% в неделю начисляются каждую секунду прямо на ваш счёт.' },
  { icon: 'ArrowDownToLine', title: 'Выводите средства', desc: 'Запросите вывод в любой момент на карту, СБП или криптокошелёк.' },
]

const ABOUT_CARDS = [
  { icon: 'Shield', title: 'Надёжность', desc: 'Работаем с 2022 года. Все выплаты автоматизированы и прозрачны. Каждый рубль отражается в вашем личном кабинете.' },
  { icon: 'Zap', title: 'Мгновенные начисления', desc: 'Дивиденды рассчитываются посекундно — 24/7 без выходных и праздников. Деньги работают пока вы спите.' },
  { icon: 'Users', title: 'Реферальная программа', desc: 'Приглашайте друзей и получайте 5% от их депозита каждую неделю. Без ограничений на количество рефералов.' },
  { icon: 'Globe', title: 'Работаем по всей России', desc: 'Поддерживаем все популярные способы оплаты: Сбербанк, Тинькофф, ВТБ, Альфа-Банк, СБП и крипту.' },
]

const RATES = [
  { range: 'от 100 ₽', rate: '10%', period: 'в неделю', color: 'from-orange-500/20 to-orange-900/5', border: 'border-orange-500/30', textColor: 'text-orange-400' },
  { range: 'от 100 000 ₽', rate: '15%', period: 'в неделю', color: 'from-purple-500/20 to-purple-900/5', border: 'border-purple-500/30', textColor: 'text-purple-400', badge: 'Топ' },
]

const DOCS = [
  {
    icon: 'FileText', title: 'Пользовательское соглашение',
    desc: 'Регулирует отношения между платформой и пользователями. Включает правила использования сервиса, ответственность сторон и порядок разрешения споров.',
    href: '/terms'
  },
  {
    icon: 'Lock', title: 'Политика конфиденциальности',
    desc: 'Описывает, какие данные мы собираем, как они хранятся и используются. Ваши персональные данные надёжно защищены и не передаются третьим лицам.',
    href: '/privacy'
  },
  {
    icon: 'Handshake', title: 'Публичная оферта',
    desc: 'Договор на оказание рекламных услуг. Документ содержит условия участия, размер вознаграждения, порядок выплат и права инвесторов.',
    href: '/offer'
  },
]

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const observers = ids.map(id => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id) },
        { threshold: 0.4 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach(o => o?.disconnect())
  }, [ids])
  return active
}

export default function LandingPage() {
  const active = useActiveSection(NAV_ITEMS.map(n => n.id))
  const [menuOpen, setMenuOpen] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroY = useTransform(scrollY, [0, 400], [0, 80])

  const scrollTo = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="bg-[#080808] text-white min-h-screen font-sans">

      {/* ── STICKY NAV ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex items-center justify-between h-16 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl mt-3 px-5">
            <span className="text-white font-bold text-lg tracking-tight">
              AD<span className="text-[#FF4D00]">FUND</span>
            </span>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => scrollTo(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    active === item.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}>
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm" className="hidden md:flex text-neutral-300 hover:text-white">
                <Link to="/login">Войти</Link>
              </Button>
              <Button asChild size="sm" className="bg-[#FF4D00] hover:bg-[#e64400] text-white border-0">
                <Link to="/register">Начать</Link>
              </Button>
              <button className="md:hidden text-neutral-400" onClick={() => setMenuOpen(v => !v)}>
                <Icon name={menuOpen ? 'X' : 'Menu'} size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="md:hidden mx-4 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-1">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => scrollTo(item.id)}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-neutral-300 hover:bg-white/5 hover:text-white transition-colors">
                  {item.label}
                </button>
              ))}
              <div className="border-t border-white/10 pt-2 mt-2">
                <Button asChild variant="ghost" size="sm" className="w-full justify-start text-neutral-400">
                  <Link to="/login">Войти</Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />
        </div>

        {/* Декоративная сетка */}
        <div className="absolute inset-0 z-1 opacity-10"
          style={{ backgroundImage: 'linear-gradient(#FF4D00 1px,transparent 1px),linear-gradient(90deg,#FF4D00 1px,transparent 1px)', backgroundSize: '80px 80px' }} />

        <motion.div ref={heroRef} style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pt-24 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[#FF4D00]/15 border border-[#FF4D00]/30 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse" />
            <span className="text-[#FF4D00] text-sm font-medium">Регистрация открыта</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-[6rem] font-black leading-[1.0] tracking-tight text-white max-w-4xl">
            Реклама,<br />
            <span className="text-[#FF4D00]">которая</span><br />
            приносит доход.
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 text-lg md:text-xl text-neutral-300 max-w-xl leading-relaxed">
            Вкладывайте в рекламу — получайте до <strong className="text-white">15% в неделю</strong>. Начисления идут каждую секунду, вывод в любое время.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg" className="bg-[#FF4D00] hover:bg-[#e64400] text-white border-0 text-base px-8 h-12">
              <Link to="/register">Начать зарабатывать</Link>
            </Button>
            <Button onClick={() => scrollTo('how')} variant="ghost" size="lg"
              className="text-neutral-300 hover:text-white text-base h-12 border border-white/15 hover:border-white/30">
              Узнать больше
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-16 flex flex-wrap gap-8">
            {[
              { label: 'Доходность', value: 'до 15% / нед' },
              { label: 'Минимальный вход', value: 'от 100 ₽' },
              { label: 'Начисление', value: 'каждую секунду' },
              { label: 'Способы вывода', value: 'карта, СБП, крипто' },
            ].map(s => (
              <div key={s.label} className="border-l-2 border-[#FF4D00] pl-4">
                <p className="text-white font-bold text-lg">{s.value}</p>
                <p className="text-neutral-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <button onClick={() => scrollTo('how')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-colors">
          <span className="text-xs tracking-widest uppercase">Прокрутите</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <Icon name="ChevronDown" size={20} />
          </motion.div>
        </button>
      </section>

      {/* ── КАК РАБОТАЕТ ───────────────────────────────────────── */}
      <section id="how" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6 }} className="mb-16">
          <p className="text-[#FF4D00] text-sm font-semibold uppercase tracking-widest mb-3">Просто и понятно</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">Как это работает?</h2>
          <p className="text-neutral-400 mt-4 text-lg max-w-2xl">Четыре шага до первых дивидендов. Никакого опыта не требуется.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative bg-white/3 border border-white/8 rounded-2xl p-6 hover:bg-white/5 hover:border-white/15 transition-all group">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#FF4D00] flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-orange-500/30">
                {i + 1}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#FF4D00]/10 border border-[#FF4D00]/20 flex items-center justify-center mb-5 group-hover:bg-[#FF4D00]/20 transition-colors">
                <Icon name={step.icon as Parameters<typeof Icon>[0]['name']} size={22} className="text-[#FF4D00]" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Демо дивидендов */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#FF4D00]/10 via-black to-black">
          <div className="p-8 md:p-12">
            <ProfileSection isActive={true} />
          </div>
        </motion.div>
      </section>

      {/* ── О НАС ──────────────────────────────────────────────── */}
      <section id="about" className="py-24 md:py-32 bg-gradient-to-b from-transparent via-white/2 to-transparent">
        <div className="px-6 md:px-12 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.6 }} className="mb-16">
            <p className="text-[#FF4D00] text-sm font-semibold uppercase tracking-widest mb-3">Кто мы</p>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">О компании</h2>
            <p className="text-neutral-400 mt-4 text-lg max-w-2xl">Мы — рекламная платформа, которая позволяет частным инвесторам участвовать в прибыли от размещения рекламы.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {ABOUT_CARDS.map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-5 bg-white/3 border border-white/8 rounded-2xl p-6 hover:bg-white/5 hover:border-white/15 transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#FF4D00]/10 border border-[#FF4D00]/20 flex items-center justify-center shrink-0">
                  <Icon name={card.icon as Parameters<typeof Icon>[0]['name']} size={20} className="text-[#FF4D00]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1.5">{card.title}</h3>
                  <p className="text-neutral-400 text-sm leading-relaxed">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Миссия */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-[#FF4D00]/10 via-[#FF4D00]/5 to-transparent border border-[#FF4D00]/20 rounded-3xl p-8 md:p-12">
            <Icon name="Quote" size={32} className="text-[#FF4D00]/40 mb-4" />
            <p className="text-white text-xl md:text-2xl font-medium leading-relaxed max-w-3xl">
              Наша миссия — сделать инвестиции доступными для каждого. Минимальный порог в 100 ₽ позволяет начать зарабатывать без значительных вложений.
            </p>
            <p className="text-neutral-500 mt-4 text-sm">— Команда ADFUND</p>
          </motion.div>
        </div>
      </section>

      {/* ── ДОХОДНОСТЬ ─────────────────────────────────────────── */}
      <section id="earn" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6 }} className="mb-16">
          <p className="text-[#FF4D00] text-sm font-semibold uppercase tracking-widest mb-3">Тарифы</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">Сколько можно заработать?</h2>
          <p className="text-neutral-400 mt-4 text-lg max-w-2xl">Чем больше депозит — тем выше ставка. Всё прозрачно и фиксировано.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {RATES.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }}
              className={`relative bg-gradient-to-br ${r.color} border ${r.border} rounded-3xl p-8 md:p-10`}>
              {r.badge && (
                <span className="absolute top-5 right-5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold px-3 py-1 rounded-full">
                  {r.badge}
                </span>
              )}
              <p className="text-neutral-400 text-sm mb-2">Депозит</p>
              <p className="text-white text-2xl font-bold mb-6">{r.range}</p>
              <div className={`text-7xl font-black ${r.textColor} leading-none mb-2`}>{r.rate}</div>
              <p className="text-neutral-400">{r.period}</p>
            </motion.div>
          ))}
        </div>

        {/* Калькулятор */}
        <IncomeCalculator />
      </section>

      {/* ── КРИПТО РЫНОК ───────────────────────────────────────── */}
      <section id="crypto" className="py-24 md:py-32 bg-gradient-to-b from-transparent via-white/2 to-transparent">
        <div className="px-6 md:px-12 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.6 }} className="mb-12">
            <p className="text-[#FF4D00] text-sm font-semibold uppercase tracking-widest mb-3">Рынок</p>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">Крипто-рынок</h2>
            <p className="text-neutral-400 mt-4 text-lg max-w-2xl">Актуальные котировки ведущих криптовалют в реальном времени.</p>
          </motion.div>
          <CryptoSection isActive={true} />
        </div>
      </section>

      {/* ── ДОКУМЕНТЫ ──────────────────────────────────────────── */}
      <section id="docs" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6 }} className="mb-16">
          <p className="text-[#FF4D00] text-sm font-semibold uppercase tracking-widest mb-3">Юридическая база</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">Документы</h2>
          <p className="text-neutral-400 mt-4 text-lg max-w-2xl">Вся деятельность платформы регулируется публичными документами. Мы открыты и прозрачны.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {DOCS.map((doc, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}>
              <Link to={doc.href}
                className="block bg-white/3 border border-white/8 rounded-2xl p-6 hover:bg-white/6 hover:border-[#FF4D00]/30 transition-all group h-full">
                <div className="w-12 h-12 rounded-xl bg-[#FF4D00]/10 border border-[#FF4D00]/20 flex items-center justify-center mb-5 group-hover:bg-[#FF4D00]/20 transition-colors">
                  <Icon name={doc.icon as Parameters<typeof Icon>[0]['name']} size={22} className="text-[#FF4D00]" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-3">{doc.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed mb-5">{doc.desc}</p>
                <span className="text-[#FF4D00] text-sm flex items-center gap-1.5 group-hover:gap-3 transition-all">
                  Читать документ <Icon name="ArrowRight" size={14} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* CTA + Footer */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-[#FF4D00]/15 via-[#FF4D00]/5 to-transparent border border-[#FF4D00]/20 rounded-3xl p-10 md:p-16 text-center mb-16">
          <h3 className="text-3xl md:text-5xl font-black text-white mb-4">Готовы начать?</h3>
          <p className="text-neutral-400 text-lg mb-8 max-w-xl mx-auto">Регистрация займёт 2 минуты. Первые дивиденды придут сразу после пополнения.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="bg-[#FF4D00] hover:bg-[#e64400] text-white border-0 text-base px-10 h-12">
              <Link to="/register">Зарегистрироваться бесплатно</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="text-neutral-300 hover:text-white border border-white/15 hover:border-white/30 h-12">
              <Link to="/login">Войти в кабинет</Link>
            </Button>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-neutral-600 text-sm">
          <span className="font-bold text-base text-white/30">AD<span className="text-[#FF4D00]/50">FUND</span></span>
          <span>© 2022–2026. Все права защищены.</span>
          <div className="flex gap-5">
            <Link to="/terms" className="hover:text-neutral-400 transition-colors">Соглашение</Link>
            <Link to="/privacy" className="hover:text-neutral-400 transition-colors">Конфиденциальность</Link>
            <Link to="/offer" className="hover:text-neutral-400 transition-colors">Оферта</Link>
          </div>
        </div>
      </section>

    </div>
  )
}

// ── Калькулятор доходности ──────────────────────────────────────
function IncomeCalculator() {
  const [deposit, setDeposit] = useState(10000)

  const weekly = deposit * (deposit >= 100000 ? 0.15 : 0.10)
  const monthly = weekly * 4.33
  const yearly = weekly * 52

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.6 }}
      className="bg-white/3 border border-white/10 rounded-3xl p-8 md:p-10">
      <h3 className="text-white font-bold text-xl mb-6 flex items-center gap-2">
        <Icon name="Calculator" size={20} className="text-[#FF4D00]" />
        Калькулятор доходности
      </h3>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="text-neutral-400 text-sm">Сумма депозита</label>
          <span className="text-white font-bold text-lg">{deposit.toLocaleString('ru-RU')} ₽</span>
        </div>
        <input type="range" min={100} max={500000} step={100} value={deposit}
          onChange={e => setDeposit(Number(e.target.value))}
          className="w-full accent-[#FF4D00] cursor-pointer" />
        <div className="flex justify-between text-neutral-600 text-xs mt-1">
          <span>100 ₽</span><span>500 000 ₽</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'в неделю', value: weekly, color: 'text-[#FF4D00]' },
          { label: 'в месяц', value: monthly, color: 'text-green-400' },
          { label: 'в год', value: yearly, color: 'text-purple-400' },
        ].map(item => (
          <div key={item.label} className="bg-black/30 rounded-2xl p-4 text-center border border-white/5">
            <p className={`text-xl md:text-2xl font-black ${item.color}`}>
              +{item.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
            </p>
            <p className="text-neutral-500 text-xs mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      <p className="text-neutral-600 text-xs mt-4 text-center">
        {deposit >= 100000 ? 'Ставка 15% в неделю (депозит от 100 000 ₽)' : 'Ставка 10% в неделю • Повышается до 15% при депозите от 100 000 ₽'}
      </p>
    </motion.div>
  )
}
