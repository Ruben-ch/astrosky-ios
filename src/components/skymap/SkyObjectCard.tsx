/**
 * Fiche de l'objet touché : type, magnitude, position actuelle, lever /
 * culmination / coucher, et actions (Guider, Centrer, ouvrir dans le Catalogue).
 */
import { Crosshair, Library, LocateFixed, Navigation, X } from 'lucide-react'
import { useMemo } from 'react'
import { DEEP_SKY_TYPE_LABEL_FR } from '../../data'
import { useSimTime } from '../../hooks/useSimTime'
import { azimuthToCardinal, getRiseTransitSet } from '../../services/astroEngine'
import { fixedRiseTransitSet } from '../../services/astro/fixedObject'
import { eqjToEnuMatrix } from '../../services/sky/skyFrame'
import { objectDirection } from '../../services/sky/skyObjects'
import { toHorizontal } from '../../services/sky/vector'
import { TLE_VALIDITY_MESSAGE, findTleRecord, isTleValidAt, predictPasses } from '../../services/satelliteTracker'
import type { ObserverLocation, RiseTransitSet } from '../../types/astro'
import type { SkyObjectRef } from '../../types/sky'
import { segmentForKey } from '../catalog/catalogItems'
import { Readout } from '../ui/Card'
import { fmtMag, fmtNumber, fmtTime } from '../ui/format'

const KIND_FR = { star: 'Étoile', planet: 'Planète', moon: 'Satellite naturel', sun: 'Étoile (Soleil)', 'deep-sky': 'Ciel profond', satellite: 'Satellite artificiel' } as const

interface Props {
  object: SkyObjectRef
  loc: ObserverLocation
  guiding: boolean
  showCenter: boolean
  onGuide(): void
  onCenter(): void
  onCatalog(): void
  onClose(): void
}

export function SkyObjectCard({ object: o, loc, guiding, showCenter, onGuide, onCenter, onCatalog, onClose }: Props) {
  const now = useSimTime(1000, 60_000)
  const nowMs = now.getTime()
  const info = useMemo(() => {
    const date = new Date(nowMs)
    const pos = toHorizontal(objectDirection(o, date, loc, eqjToEnuMatrix(date, loc)))
    if (o.noradId != null) {
      // Satellite : prochain passage au-dessus de l'horizon (SGP4) au lieu du lever / coucher diurne.
      const record = findTleRecord(o.noradId)
      if (record && !isTleValidAt(record, date)) {
        const none: RiseTransitSet = { rise: null, set: null, transit: null, transitAltitudeDeg: null, alwaysUp: false, alwaysDown: true }
        return { pos: null, rs: none }
      }
      const pass = record ? predictPasses(record, new Date(nowMs - 20 * 60_000), 26, loc, 0).find((p) => p.set.time.getTime() >= nowMs) : undefined
      const rs: RiseTransitSet = {
        rise: pass?.rise.time ?? null, set: pass?.set.time ?? null, transit: pass?.culmination.time ?? null,
        transitAltitudeDeg: pass?.culmination.elevationDeg ?? null, alwaysUp: false, alwaysDown: !pass,
      }
      return { pos, rs }
    }
    const rs = o.bodyId ? getRiseTransitSet(o.bodyId, date, loc) : fixedRiseTransitSet(o.raDeg, o.decDeg, date, loc)
    return { pos, rs }
  }, [o, loc, nowMs])
  const type = o.deepSkyType ? DEEP_SKY_TYPE_LABEL_FR[o.deepSkyType] : KIND_FR[o.kind]
  const inCatalog = segmentForKey(o.key) !== null
  const btn = 'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold active:scale-[0.98]'

  return (
    <section data-sky-hud className="pointer-events-auto rounded-3xl bg-elevated/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl" aria-label={`Objet sélectionné : ${o.label}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold">{o.label}</h2>
          <p className="truncate text-[12px] text-secondary tabular-nums">
            {o.noradId != null ? (
              `${type} · NORAD ${o.noradId} · position SGP4`
            ) : (
              <>
                {type} · mag {fmtMag(o.magnitude)} · AD {fmtNumber(o.raDeg / 15, 2)} h · Déc {o.decDeg >= 0 ? '+' : '−'}
                {fmtNumber(Math.abs(o.decDeg), 1)}°
              </>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer la fiche" className="touch-target -mt-1 -mr-2 flex items-center justify-center text-secondary">
          <X size={18} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Readout label="Hauteur" value={info.pos ? `${fmtNumber(info.pos.altitudeDeg, 1)}°` : '—'} tone={info.pos && info.pos.altitudeDeg > 0 ? 'text-accent' : 'text-secondary'} />
        <Readout label="Azimut" value={info.pos ? `${fmtNumber(info.pos.azimuthDeg, 0)}°` : '—'} unit={info.pos ? azimuthToCardinal(info.pos.azimuthDeg) : undefined} />
        <Readout label={info.rs.alwaysUp ? 'Circump.' : 'Lever'} value={info.rs.alwaysUp ? '∞' : fmtTime(info.rs.rise)} />
        <Readout label="Coucher" value={info.rs.alwaysUp ? '—' : fmtTime(info.rs.set)} />
      </div>
      <p className="mt-1 text-[11px] text-tertiary tabular-nums">
        {o.noradId != null
          ? !info.pos
            ? TLE_VALIDITY_MESSAGE
            : info.rs.rise
            ? `Passage : culmination à ${fmtTime(info.rs.transit)} (${fmtNumber(info.rs.transitAltitudeDeg ?? 0, 0)}°)`
            : 'Aucun passage dans les 24 h.'
          : info.rs.alwaysDown
          ? 'Ne se lève pas depuis ce site dans les 24 h.'
          : `Culmine à ${fmtTime(info.rs.transit)}${info.rs.transitAltitudeDeg !== null ? ` (${fmtNumber(info.rs.transitAltitudeDeg, 0)}°)` : ''}`}
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onGuide} aria-pressed={guiding} aria-label={guiding ? `Arrêter le guidage vers ${o.label}` : `Guider vers ${o.label}`} className={`${btn} ${guiding ? 'bg-accent-soft text-accent' : 'bg-softer text-primary'}`}>
          <Navigation size={15} aria-hidden /> {guiding ? 'Guidage' : 'Guider'}
        </button>
        {showCenter && (
          <button type="button" onClick={onCenter} className={`${btn} bg-softer text-primary`}>
            <LocateFixed size={15} aria-hidden /> Centrer
          </button>
        )}
        {inCatalog && (
          <button type="button" onClick={onCatalog} aria-label={`Ouvrir ${o.label} dans le catalogue`} className={`${btn} bg-softer text-primary`}>
            <Library size={15} aria-hidden /> Fiche
          </button>
        )}
      </div>
    </section>
  )
}

export function SkyGuidanceBar({ target, locked, hint, onStop }: { target: SkyObjectRef; locked: boolean; hint: string; onStop(): void }) {
  return (
    <div
      data-sky-hud
      className={`pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl px-3 shadow-lg shadow-black/50 backdrop-blur-xl ${locked ? 'bg-accent-soft' : 'bg-elevated/90'}`}
      role="status"
      aria-live="polite"
    >
      <Crosshair size={18} className={locked ? 'text-accent' : 'text-secondary'} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{locked ? `${target.label} pointé` : `Guidage · ${target.label}`}</div>
        <div className="truncate text-[11px] text-secondary tabular-nums">{hint}</div>
      </div>
      <button type="button" onClick={onStop} aria-label="Arrêter le guidage" className="touch-target -mr-2 flex items-center justify-center text-secondary">
        <X size={18} />
      </button>
    </div>
  )
}
