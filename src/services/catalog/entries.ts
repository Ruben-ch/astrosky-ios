/**
 * Entrées de l'Encyclopédie du Ciel Profond : catalogue Messier + NGC/IC
 * enrichi des compléments OpenNGC (angle de position, brillance de surface
 * mesurée), des noms de constellations et d'un texte de recherche normalisé.
 */
import { CONSTELLATION_FIGURES, DEEP_SKY_CATALOG, DEEP_SKY_TYPE_LABEL_FR } from '../../data'
import { DEEP_SKY_EXTRAS } from '../../data/deepSkyExtras.generated'
import type { DeepSkyObject, DeepSkyType } from '../../types/catalog'
import type { CatalogSource, DeepSkyEntry, DsoTypeGroup } from '../../types/encyclopedia'
import { surfaceBrightness } from '../targets/instruments'
import { normalizeText } from './search'

/** Famille de filtrage de chaque type ; `null` = hors familles (astérisme, étoile double, nuage stellaire). */
export const TYPE_GROUP: Readonly<Record<DeepSkyType, DsoTypeGroup | null>> = {
  galaxy: 'galaxy',
  'emission-nebula': 'diffuse-nebula',
  'reflection-nebula': 'diffuse-nebula',
  'dark-nebula': 'diffuse-nebula',
  'cluster-nebula': 'diffuse-nebula',
  'planetary-nebula': 'planetary-nebula',
  'open-cluster': 'open-cluster',
  'globular-cluster': 'globular-cluster',
  'supernova-remnant': 'supernova-remnant',
  'star-cloud': null,
  'double-star': null,
  asterism: null,
}

export const GROUP_ORDER: readonly DsoTypeGroup[] = [
  'galaxy',
  'diffuse-nebula',
  'planetary-nebula',
  'open-cluster',
  'globular-cluster',
  'supernova-remnant',
]

export const GROUP_LABEL_FR: Readonly<Record<DsoTypeGroup, string>> = {
  galaxy: 'Galaxies',
  'diffuse-nebula': 'Nébuleuses diffuses',
  'planetary-nebula': 'Planétaires',
  'open-cluster': 'Amas ouverts',
  'globular-cluster': 'Amas globulaires',
  'supernova-remnant': 'Rémanents',
}

export const SOURCE_LABEL_FR: Readonly<Record<CatalogSource, string>> = { messier: 'Messier', ngc: 'NGC', ic: 'IC' }

const CONSTELLATIONS = new Map(CONSTELLATION_FIGURES.map((c) => [c.id, c]))

/** Catalogues d'appartenance d'un objet (Messier et/ou NGC / IC). */
export function catalogSources(o: DeepSkyObject): CatalogSource[] {
  const out: CatalogSource[] = []
  if (o.messier !== null) out.push('messier')
  if (o.ngc?.startsWith('NGC')) out.push('ngc')
  else if (o.ngc?.startsWith('IC')) out.push('ic')
  return out
}

/** Code d'affichage principal : `"M31"`, sinon la désignation NGC/IC. */
export function deepSkyCode(o: DeepSkyObject): string {
  return o.messier !== null ? `M${o.messier}` : (o.ngc ?? o.id)
}

export function buildEntry(o: DeepSkyObject): DeepSkyEntry {
  const extra = DEEP_SKY_EXTRAS[o.id]
  const con = CONSTELLATIONS.get(o.constellation)
  const computed = o.mag !== null ? surfaceBrightness(o.mag, o.sizeMajorArcmin, o.sizeMinorArcmin) : null
  const measured = extra?.surfaceBrightness ?? null
  const code = deepSkyCode(o)
  const aliases = o.messier !== null && o.ngc ? [o.ngc] : []
  const constellationFr = con?.nameFr ?? o.constellation
  const constellationLatin = con?.nameLatin ?? o.constellation
  const typeLabel = DEEP_SKY_TYPE_LABEL_FR[o.type]
  return {
    object: o,
    code,
    aliases,
    typeLabel,
    group: TYPE_GROUP[o.type],
    sources: catalogSources(o),
    constellationFr,
    constellationLatin,
    positionAngleDeg: extra?.positionAngleDeg ?? null,
    surfaceBrightness: measured ?? computed,
    surfaceBrightnessOrigin: measured !== null ? 'measured' : computed !== null ? 'computed' : null,
    searchText: normalizeText([code, ...aliases, o.name ?? '', typeLabel, o.constellation, constellationFr, constellationLatin].join(' ')),
  }
}

let cache: readonly DeepSkyEntry[] | null = null

/** Les 160 entrées enrichies (construites une seule fois). */
export function getDeepSkyEntries(): readonly DeepSkyEntry[] {
  cache ??= DEEP_SKY_CATALOG.map(buildEntry)
  return cache
}

export function findDeepSkyEntry(id: string): DeepSkyEntry | undefined {
  return getDeepSkyEntries().find((e) => e.object.id === id)
}

/** Nombre d'objets par famille. */
export function groupCounts(entries: readonly DeepSkyEntry[]): Record<DsoTypeGroup, number> {
  const counts = Object.fromEntries(GROUP_ORDER.map((g) => [g, 0])) as Record<DsoTypeGroup, number>
  for (const e of entries) if (e.group) counts[e.group]++
  return counts
}
