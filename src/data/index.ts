/** Point d'entrée unique des catalogues statiques. */
import type { DeepSkyObject, DeepSkyType } from '../types/catalog'
import { MESSIER_CATALOG } from './messier.generated'
import { NGC_IC_CATALOG } from './ngcIc.generated'

export { BRIGHT_STARS } from './brightStars.generated'
export { CONSTELLATION_FIGURES } from './constellationLines.generated'
export { METEOR_SHOWERS } from './meteorShowers'
export { MESSIER_CATALOG, NGC_IC_CATALOG }

/** Catalogue ciel profond complet : Messier puis NGC/IC majeurs. */
export const DEEP_SKY_CATALOG: readonly DeepSkyObject[] = [...MESSIER_CATALOG, ...NGC_IC_CATALOG]

export const DEEP_SKY_TYPE_LABEL_FR: Readonly<Record<DeepSkyType, string>> = {
  galaxy: 'Galaxie',
  'globular-cluster': 'Amas globulaire',
  'open-cluster': 'Amas ouvert',
  'planetary-nebula': 'Nébuleuse planétaire',
  'emission-nebula': "Nébuleuse en émission",
  'reflection-nebula': 'Nébuleuse par réflexion',
  'dark-nebula': 'Nébuleuse obscure',
  'supernova-remnant': 'Rémanent de supernova',
  'cluster-nebula': 'Amas + nébuleuse',
  'star-cloud': 'Nuage stellaire',
  'double-star': 'Étoile double',
  asterism: 'Astérisme',
}

/** Libellé d'affichage : « M31 · Galaxie d'Andromède » ou « NGC 891 ». */
export function deepSkyLabel(o: DeepSkyObject): string {
  const code = o.messier !== null ? `M${o.messier}` : (o.ngc ?? o.id)
  return o.name ? `${code} · ${o.name}` : code
}
