/**
 * Rendu de la phase lunaire en Canvas : disque sombre, partie éclairée bornée
 * par le limbe et un terminateur elliptique dont le demi-axe vaut |cos(φ)|·R,
 * où φ est l'angle de phase géocentrique (Lune − Soleil) fourni par le moteur.
 * Côté éclairé à droite pour une Lune croissante (vue de l'hémisphère nord).
 */
import { useHiDpiCanvas } from '../../hooks/useHiDpiCanvas'
import { useTheme } from '../../hooks/useAppContext'

export function MoonPhaseCanvas({ phaseAngleDeg, size = 76, southern = false }: { phaseAngleDeg: number; size?: number; southern?: boolean }) {
  const { palette: p } = useTheme()
  const ref = useHiDpiCanvas(
    (ctx, { width, height }) => {
      const r = Math.min(width, height) / 2 - 2
      const cx = width / 2
      const cy = height / 2
      const phiRad = (phaseAngleDeg * Math.PI) / 180
      const waxing = phaseAngleDeg < 180
      const litRight = southern ? !waxing : waxing
      const k = Math.cos(phiRad) // 1 = nouvelle, −1 = pleine

      ctx.fillStyle = p.moonDark
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.translate(cx, cy)
      if (!litRight) ctx.scale(-1, 1)
      ctx.fillStyle = p.moonLit
      ctx.beginPath()
      // Demi-limbe éclairé (côté droit), puis retour par le terminateur.
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false)
      ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      ctx.strokeStyle = p.gridStrong
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    },
    [phaseAngleDeg, p, southern],
  )
  return <canvas ref={ref} role="img" aria-label="Phase de la Lune" style={{ width: size, height: size }} className="block shrink-0" />
}
