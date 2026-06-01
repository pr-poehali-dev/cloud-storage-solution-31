import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { apiSpinWheel, apiGetWheelSpins, type WheelSpin } from '@/lib/api'

// 16 секций в том же порядке что и на бэкенде
const SEGMENTS = [
  { label: 'x2',  mult: 2,  color: '#16a34a', glow: '#22c55e' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: 'x5',  mult: 5,  color: '#d97706', glow: '#f59e0b' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: 'x2',  mult: 2,  color: '#16a34a', glow: '#22c55e' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: 'x10', mult: 10, color: '#b91c1c', glow: '#ef4444' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: 'x2',  mult: 2,  color: '#16a34a', glow: '#22c55e' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: 'x5',  mult: 5,  color: '#d97706', glow: '#f59e0b' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: 'x2',  mult: 2,  color: '#16a34a', glow: '#22c55e' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
  { label: '☠️', mult: 0,  color: '#1f2937', glow: '#374151' },
]

const N = SEGMENTS.length
const SLICE = (2 * Math.PI) / N
const R = 140          // радиус колеса
const CX = 160         // центр svg
const CY = 160

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

function segmentPath(i: number, r: number, cx: number, cy: number) {
  const start = i * SLICE - Math.PI / 2
  const end   = start + SLICE
  const p1 = polarToCartesian(cx, cy, r, start)
  const p2 = polarToCartesian(cx, cy, r, end)
  const large = SLICE > Math.PI ? 1 : 0
  return `M${cx},${cy} L${p1.x},${p1.y} A${r},${r} 0 ${large},1 ${p2.x},${p2.y} Z`
}

function labelPos(i: number, r: number, cx: number, cy: number) {
  const mid = i * SLICE - Math.PI / 2 + SLICE / 2
  return { x: cx + r * Math.cos(mid), y: cy + r * Math.sin(mid), angle: (mid * 180 / Math.PI) + 90 }
}

interface FortuneWheelProps {
  balance: number
  onClose: () => void
  onResult: () => void
}

export default function FortuneWheel({ balance, onClose, onResult }: FortuneWheelProps) {
  const [bet, setBet] = useState('500')
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<{ win: boolean; multiplier: number; win_amount: number; bet: number; seg_idx: number } | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<WheelSpin[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const rotRef = useRef(0)

  const loadHistory = useCallback(async () => {
    try {
      const r = await apiGetWheelSpins()
      setHistory(r.spins)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleSpin = async () => {
    const betNum = parseFloat(bet)
    if (isNaN(betNum) || betNum < 100) { setError('Минимальная ставка — 100 ₽'); return }
    if (betNum > balance) { setError('Недостаточно средств на балансе'); return }

    setError('')
    setResult(null)
    setSpinning(true)

    try {
      const res = await apiSpinWheel(betNum)

      // Вычисляем угол остановки на нужном сегменте
      const targetAngle = -(res.seg_idx * (360 / N) + (360 / N) / 2)
      const fullSpins = 5 * 360
      const finalAngle = rotRef.current - (rotRef.current % 360) + fullSpins + targetAngle

      rotRef.current = finalAngle
      setRotation(finalAngle)

      // Показываем результат после анимации (4.5 сек)
      setTimeout(() => {
        setSpinning(false)
        setResult({ win: res.win, multiplier: res.multiplier, win_amount: res.win_amount, bet: res.bet, seg_idx: res.seg_idx })
        loadHistory()
        onResult()
      }, 4600)
    } catch (e: unknown) {
      setSpinning(false)
      setError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const betNum = parseFloat(bet) || 0
  const quickBets = [100, 500, 1000, 5000].filter(v => v <= balance)

  return (
    <div className="flex flex-col h-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Icon name="Dices" size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Колесо Фортуны</h2>
            <p className="text-neutral-500 text-xs">Баланс: {balance.toFixed(2)} ₽</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(v => !v)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
            <Icon name="History" size={15} />
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
            <Icon name="X" size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-0 flex-1 min-h-0">
        {/* Wheel */}
        <div className="flex flex-col items-center justify-center p-5 md:p-6 flex-1">
          <div className="relative select-none">
            {/* Glow */}
            <div className="absolute inset-0 rounded-full blur-2xl opacity-30"
              style={{ background: 'radial-gradient(circle, #a855f7 0%, #ec4899 50%, transparent 70%)' }} />

            {/* Pointer */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
              <div className="w-5 h-8 bg-gradient-to-b from-yellow-300 to-yellow-500 rounded-sm shadow-lg shadow-yellow-500/50"
                style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
            </div>

            {/* SVG Wheel */}
            <div className="relative" style={{ width: 320, height: 320 }}>
              <svg
                width="320" height="320" viewBox="0 0 320 320"
                className="drop-shadow-2xl"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  willChange: 'transform',
                }}
              >
                {/* Outer ring */}
                <circle cx={CX} cy={CY} r={R + 12} fill="#1a1a2e" stroke="#7c3aed" strokeWidth={3} />

                {/* Segments */}
                {SEGMENTS.map((seg, i) => {
                  const lp = labelPos(i, R * 0.68, CX, CY)
                  return (
                    <g key={i}>
                      <path d={segmentPath(i, R, CX, CY)}
                        fill={seg.color}
                        stroke="#0f0f0f"
                        strokeWidth={1.5}
                      />
                      <text
                        x={lp.x} y={lp.y}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={seg.mult >= 10 ? 13 : seg.mult > 0 ? 14 : 13}
                        fontWeight="900"
                        fill={seg.mult > 0 ? '#ffffff' : '#6b7280'}
                        transform={`rotate(${lp.angle}, ${lp.x}, ${lp.y})`}
                        style={{ userSelect: 'none' }}
                      >
                        {seg.label}
                      </text>
                    </g>
                  )
                })}

                {/* Center circle */}
                <circle cx={CX} cy={CY} r={22} fill="#0f0f0f" stroke="#7c3aed" strokeWidth={3} />
                <circle cx={CX} cy={CY} r={10} fill="#7c3aed" />

                {/* Tick marks on ring */}
                {SEGMENTS.map((_, i) => {
                  const angle = i * SLICE - Math.PI / 2
                  const p1 = polarToCartesian(CX, CY, R + 2, angle)
                  const p2 = polarToCartesian(CX, CY, R + 12, angle)
                  return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#7c3aed" strokeWidth={1} />
                })}
              </svg>
            </div>
          </div>

          {/* Result popup */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`mt-4 w-full max-w-xs rounded-2xl border p-4 text-center ${
                  result.win
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                {result.win ? (
                  <>
                    <p className="text-3xl mb-1">🎉</p>
                    <p className="text-green-400 font-black text-xl">+{(result.bet * result.multiplier).toFixed(2)} ₽</p>
                    <p className="text-neutral-400 text-xs mt-1">
                      Ставка {result.bet} ₽ × {result.multiplier} = выигрыш!
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl mb-1">💀</p>
                    <p className="text-red-400 font-black text-xl">−{result.bet.toFixed(2)} ₽</p>
                    <p className="text-neutral-400 text-xs mt-1">Не повезло. Попробуй ещё раз!</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel */}
        <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-white/8 flex flex-col">
          {showHistory ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-white font-semibold text-sm mb-3">История спинов</p>
              {history.length === 0 && (
                <p className="text-neutral-600 text-xs text-center py-6">Ещё нет спинов</p>
              )}
              {history.map(s => (
                <div key={s.id} className={`flex items-center justify-between py-2.5 border-b border-white/5 last:border-0`}>
                  <div>
                    <p className={`text-sm font-bold ${s.multiplier > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                      {s.segment}
                    </p>
                    <p className="text-neutral-600 text-xs">{s.bet.toLocaleString('ru-RU')} ₽</p>
                  </div>
                  <p className={`text-sm font-semibold ${s.multiplier > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {s.multiplier > 0 ? `+${(s.bet * s.multiplier).toFixed(0)}` : `−${s.bet.toFixed(0)}`} ₽
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-4 flex-1">
              {/* Легенда */}
              <div>
                <p className="text-neutral-500 text-xs mb-2 uppercase tracking-wide">Призовые секции</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'x2', count: 4, color: 'text-green-400', bg: 'bg-green-500/10' },
                    { label: 'x5', count: 2, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                    { label: 'x10', count: 1, color: 'text-red-400', bg: 'bg-red-500/10', badge: 'Редкий' },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center justify-between rounded-xl px-3 py-2 ${item.bg}`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-base ${item.color}`}>{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>
                        )}
                      </div>
                      <span className="text-neutral-500 text-xs">{item.count} сект.</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/3">
                    <span className="text-neutral-600 text-sm">☠️ Проигрыш</span>
                    <span className="text-neutral-600 text-xs">9 сект.</span>
                  </div>
                </div>
                <p className="text-neutral-600 text-xs mt-2 text-center">Вероятность выигрыша ~20%</p>
              </div>

              {/* Ставка */}
              <div>
                <p className="text-neutral-500 text-xs mb-2 uppercase tracking-wide">Ставка</p>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {quickBets.map(v => (
                    <button key={v} onClick={() => setBet(String(v))}
                      className={`rounded-lg py-1.5 text-xs font-semibold transition-all border ${
                        bet === String(v)
                          ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                          : 'bg-white/3 border-white/10 text-neutral-400 hover:bg-white/8'
                      }`}>
                      {v.toLocaleString('ru-RU')} ₽
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input type="number" value={bet} onChange={e => { setBet(e.target.value); setError('') }}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder:text-neutral-600 focus:outline-none focus:border-purple-500/50 text-sm pr-8"
                    placeholder="Своя сумма" min={100} max={balance} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">₽</span>
                </div>
                {betNum >= 100 && (
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                    {[2, 5, 10].map(m => (
                      <div key={m} className="bg-white/3 rounded-lg py-1.5">
                        <p className="text-white text-xs font-bold">×{m}</p>
                        <p className="text-neutral-600 text-[10px]">{(betNum * m).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-xs">
                  <Icon name="AlertCircle" size={13} />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Spin button */}
          <div className="p-4 border-t border-white/8 shrink-0">
            <Button
              onClick={handleSpin}
              disabled={spinning || betNum < 100 || betNum > balance}
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold border-0 rounded-xl shadow-lg shadow-purple-500/20 disabled:opacity-40">
              {spinning ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Крутится...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Icon name="Dices" size={16} />
                  Крутить за {betNum > 0 ? `${betNum.toLocaleString('ru-RU')} ₽` : '...'}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
