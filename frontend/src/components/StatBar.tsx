import { useEffect, useRef } from 'react'

interface StatBarProps {
  label: string
  value: number
  max?: number
  color: string
  delay?: number
}

export default function StatBar({ label, value, max = 10, color, delay = 0 }: StatBarProps) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    bar.style.width = '0%'
    const t = setTimeout(() => {
      bar.style.transition = 'width 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
      bar.style.width = `${(value / max) * 100}%`
    }, delay)
    return () => clearTimeout(t)
  }, [value, max, delay])

  const pct = (value / max) * 100

  return (
    <div className="flex items-center gap-3 group">
      <span
        className="text-[10px] font-bold w-10 text-right shrink-0 tracking-wider"
        style={{ fontFamily: 'Orbitron', color }}
      >
        {label}
      </span>

      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            boxShadow: `0 0 8px ${color}80`,
            width: '0%',
          }}
        />
      </div>

      <div className="flex items-center gap-1 shrink-0 w-12">
        <span className="text-xs font-bold tabular-nums" style={{ fontFamily: 'Orbitron', color }}>
          {value}
        </span>
        <div className="flex gap-0.5">
          {Array.from({ length: max }).map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                background: i < value ? color : 'rgba(255,255,255,0.1)',
                boxShadow: i < value ? `0 0 4px ${color}` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <span className="text-[10px] tabular-nums shrink-0" style={{ color: '#ffffff30' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}
