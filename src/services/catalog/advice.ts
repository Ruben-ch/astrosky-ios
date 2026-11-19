/**
 * Conseils d'observation par instrument (œil nu, jumelles 10×50, télescope
 * 200 mm) : détectabilité (magnitude intégrée et brillance de surface face aux
 * limites de l'instrument), adéquation au champ et grossissements conseillés.
 */
import type { DeepSkyEntry, InstrumentAdvice, ObservationVerdict } from '../../types/encyclopedia'
import type { DeepSkyType } from '../../types/catalog'
import type { InstrumentId } from '../../types/tonight'
import { EXTENDED_OFFSET, INSTRUMENTS, INSTRUMENT_ORDER, stellarLimitingMagnitude } from '../targets/instruments'
import { TELESCOPE_MAGNIFICATION, TYPE_TIPS } from './adviceTips'

/** Limite à l'œil nu (NELM) d'un ciel de campagne sans Lune. */
export const DARK_SKY_NELM = 6.5

/** Types résolus en étoiles : la brillance de surface moyenne n'est pas le critère limitant. */
const STELLAR_TYPES: ReadonlySet<DeepSkyType> = new Set(['open-cluster', 'globular-cluster', 'star-cloud', 'double-star', 'asterism'])

export const VERDICT_LABEL_FR: Readonly<Record<ObservationVerdict, string>> = {
  invisible: 'Hors de portée',
  difficult: 'Difficile',
  accessible: 'Accessible',
  easy: 'Facile',
  showpiece: 'Spectaculaire',
}

const fmt = (x: number, d = 1) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * Pénalité (en magnitudes) d'une brillance de surface proche ou au-delà de la
 * limite : la moyenne sur toute l'étendue sous-estime les noyaux brillants,
 * elle dégrade donc le verdict sans l'annuler à elle seule.
 */
export function surfacePenalty(sbMargin: number): number {
  if (!Number.isFinite(sbMargin) || sbMargin >= 1) return 0
  return 0.5 + Math.max(0, -sbMargin) * 0.5
}

function verdictFor(margin: number, fill: number | null, id: InstrumentId): ObservationVerdict {
  if (margin < 0) return 'invisible'
  if (margin < 1) return 'difficult'
  if (margin < 2.5) return 'accessible'
  const framed = fill === null || (fill >= (id === 'naked-eye' ? 0.005 : 0.05) && fill <= 0.9)
  return margin >= 4 && framed ? 'showpiece' : 'easy'
}

/** Grossissements conseillés au télescope, ajustés à la taille apparente de l'objet. */
export function telescopeMagnification(type: DeepSkyType, sizeArcmin: number | null, apertureMm: number, apparentFieldDeg = 52): [number, number] {
  let [lo, hi] = TELESCOPE_MAGNIFICATION[type]
  if (sizeArcmin !== null && sizeArcmin > 0) {
    // Grossissement qui cadre l'objet dans ~70 % du champ apparent.
    const fit = apparentFieldDeg / ((sizeArcmin / 60) / 0.7)
    if (fit < hi) hi = Math.max(lo * 0.5, fit)
    if (hi < lo) lo = hi * 0.6
    if (type === 'planetary-nebula' && sizeArcmin > 5) [lo, hi] = [40, Math.max(60, fit)]
  }
  const cap = 2 * apertureMm
  const r = (x: number) => Math.max(10, Math.round(x / 5) * 5)
  return [r(Math.min(lo, cap)), r(Math.min(hi, cap))]
}

/** Conseils pour chaque instrument, du plus simple au plus puissant. */
export function getInstrumentAdvice(entry: DeepSkyEntry, nakedEyeLimit = DARK_SKY_NELM): InstrumentAdvice[] {
  const o = entry.object
  const sb = STELLAR_TYPES.has(o.type) ? null : entry.surfaceBrightness
  return INSTRUMENT_ORDER.map((id) => {
    const profile = INSTRUMENTS[id]
    const limit = stellarLimitingMagnitude(profile, nakedEyeLimit) - EXTENDED_OFFSET[id]
    const fieldArcmin = profile.fieldDeg * 60
    const fill = o.sizeMajorArcmin !== null ? o.sizeMajorArcmin / fieldArcmin : null
    const tips: string[] = []
    let margin: number | null = null
    let verdict: ObservationVerdict

    if (o.mag === null || o.type === 'dark-nebula') {
      // Nébuleuse obscure : détectée par contraste, jamais par son éclat propre.
      const large = (o.sizeMajorArcmin ?? 0) >= 30
      verdict = id === 'telescope' ? 'difficult' : id === 'binoculars' && large ? 'difficult' : 'invisible'
    } else {
      const magMargin = limit - o.mag
      const sbMargin = sb !== null ? profile.surfaceBrightnessLimit - sb : Infinity
      margin = magMargin - surfacePenalty(sbMargin)
      verdict = verdictFor(margin, fill, id)
      if (magMargin < 0) tips.push(`Magnitude ${fmt(o.mag)} au-delà de la limite de l’instrument (≈ ${fmt(limit)}).`)
      else if (sbMargin < 1) tips.push(`Brillance de surface faible (${fmt(sb!)} mag/arcsec²) : ciel sans Lune et vision décalée indispensables.`)
    }

    if (verdict !== 'invisible' || o.mag === null) tips.unshift(TYPE_TIPS[o.type][id])
    if (fill !== null && fill > 1 && verdict !== 'invisible') {
      tips.push(`Plus grand que le champ typique (${fmt(profile.fieldDeg)}°) : balayez l’objet ou choisissez un champ plus large.`)
    }
    if (id === 'naked-eye' && fill !== null && fill < 0.005 && verdict !== 'invisible') tips.push('Apparaît ponctuel, comme une étoile.')

    const magnificationRange: readonly [number, number] | null =
      id === 'naked-eye' ? null
      : id === 'binoculars' ? [7, 15]
      : telescopeMagnification(o.type, o.sizeMajorArcmin, profile.apertureMm)

    return { instrument: id, verdict, magnitudeMargin: margin, fieldFillRatio: fill, magnificationRange, tips }
  })
}
