/**
 * Carte « Caractéristiques » : photométrie et dimensions angulaires réelles,
 * avec comparaison d'échelle face au disque de la Pleine Lune (0,5°) en Canvas 2D.
 */
import { Ruler } from 'lucide-react'
import { useTheme } from '../../../hooks/useAppContext'
import { useHiDpiCanvas } from '../../../hooks/useHiDpiCanvas'
import { Card, Readout } from '../../ui/Card'
import { fmtNumber } from '../../ui/format'
import { drawSilhouette } from '../fov/silhouetteDraw'
import { fmtArcmin, screenAngle, type FovMain } from '../fov/fovDraw'

/** Diamètre de référence de la Pleine Lune, en minutes d'arc (0,5°). */
export const MOON_DIAMETER_ARCMIN = 30

export interface PhysicalFact {
  readonly label: string
  readonly value: string
  readonly unit?: string
}

interface Props {
  code: string
  facts: readonly PhysicalFact[]
  main: FovMain
  majorArcmin: number | null
  note?: string
}

function moonComparison(code: string, major: number | null): string {
  if (major === null || major <= 0) return `${code} est ponctuel : aucune étendue mesurable face à la Lune.`
  const r = major / MOON_DIAMETER_ARCMIN
  if (r >= 1.05) return `${code} s’étend sur ${fmtNumber(r, 1)} fois le diamètre de la Pleine Lune.`
  if (r >= 0.95) return `${code} a sensiblement la taille de la Pleine Lune.`
  return `${code} couvre ${r >= 0.1 ? `${fmtNumber(r * 100, 0)} %` : `1/${fmtNumber(1 / r, 0)}`} du diamètre de la Pleine Lune.`
}

export function PhysicalCard({ code, facts, main, majorArcmin, note }: Props) {
  const { palette: p } = useTheme()
  const ref = useHiDpiCanvas(
    (ctx, { width, height }) => {
      const span = Math.max(MOON_DIAMETER_ARCMIN, majorArcmin ?? 0) * 1.3
      const k = Math.min(width, height) / span
      const cx = width / 2
      const cy = height / 2
      ctx.fillStyle = p.fov.field
      ctx.fillRect(0, 0, width, height)
      const rMoon = (MOON_DIAMETER_ARCMIN / 2) * k
      ctx.fillStyle = p.fov.moon
      ctx.strokeStyle = p.fov.moonEdge
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.arc(cx, cy, rMoon, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.setLineDash([])
      if (main.kind === 'dso') {
        drawSilhouette(ctx, cx, cy, { ...main.spec, rxPx: (main.majorArcmin / 2) * k, ryPx: (main.minorArcmin / 2) * k, rotationRad: screenAngle(main.paDeg, 'sky'), outline: true }, p.fov)
      } else if (main.kind === 'disk') {
        ctx.fillStyle = p.fov.objectCore
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(1.5, (main.diameterArcmin / 2) * k), 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = p.fov.star
        ctx.beginPath()
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.font = '600 10px -apple-system, system-ui, sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillStyle = p.fov.moonEdge
      ctx.textAlign = 'right'
      ctx.fillText(`◌ Pleine Lune · ${fmtArcmin(MOON_DIAMETER_ARCMIN)}`, width - 10, height - 16)
      ctx.fillStyle = p.fov.label
      ctx.textAlign = 'left'
      ctx.fillText(majorArcmin ? `${code} · ${fmtArcmin(majorArcmin)}` : code, 10, 8)
    },
    [main, majorArcmin, code, p],
  )

  return (
    <Card title="Caractéristiques" icon={<Ruler size={14} />}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {facts.map((f) => (
          <Readout key={f.label} label={f.label} value={f.value} unit={f.unit} />
        ))}
      </div>
      {note && <p className="mt-2 text-[11px] text-tertiary">{note}</p>}
      <canvas ref={ref} role="img" aria-label={`Comparaison d’échelle : ${moonComparison(code, majorArcmin)}`} className="mt-3 block h-[150px] w-full rounded-xl border border-subtle" />
      <p className="mt-2 text-[12px] text-secondary tabular-nums">{moonComparison(code, majorArcmin)}</p>
    </Card>
  )
}
