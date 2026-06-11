import type { CSSProperties } from 'react'

export type PieDatum = {
  label: string
  value: number
}

type Props = {
  data: PieDatum[]
  size?: number
  strokeWidth?: number
  style?: CSSProperties
}

function clamp01(x: number) {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  const largeArc = end - start > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} Z`
}

const DEFAULT_COLORS = ['#d4af37', '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#94a3b8']

export function PieChart({ data, size = 140, strokeWidth = 2, style }: Props) {
  const total = data.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0)
  const r = size / 2 - strokeWidth
  const cx = size / 2
  const cy = size / 2

  if (!data.length || total <= 0) {
    return (
      <svg width={size} height={size} style={style}>
        <circle cx={cx} cy={cy} r={r} fill="#f5f5f5" stroke="#e5e5e5" strokeWidth={strokeWidth} />
      </svg>
    )
  }

  let a0 = -Math.PI / 2
  return (
    <svg width={size} height={size} style={style}>
      {data.map((d, idx) => {
        const frac = clamp01(d.value / total)
        const a1 = a0 + frac * Math.PI * 2
        const path = arcPath(cx, cy, r, a0, a1)
        a0 = a1
        const fill = DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
        return <path key={d.label} d={path} fill={fill} stroke="#ffffff" strokeWidth={strokeWidth} />
      })}
    </svg>
  )
}

