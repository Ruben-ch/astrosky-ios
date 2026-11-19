// ⚠️ Fichier généré automatiquement — ne pas éditer à la main.
// Source : CelesTrak GP (groupe « visual »), téléchargé le 2026-11-18.
// Éléments de secours hors-ligne : la précision SGP4 se dégrade de quelques km/jour,
// l'interface signale leur âge et les remplace dès qu'une connexion est disponible.
import type { TleRecord } from '../types/services'

export const BUNDLED_TLE_FETCHED_AT = Date.parse('2026-11-18T00:00:00Z')

export const BUNDLED_TLES: readonly TleRecord[] = [
  { name: "ISS (ZARYA)", noradId: 25544, line1: "1 25544U 98067A   26321.85053418  .00010861  00000+0  20179-3 0  9995", line2: "2 25544  51.6318 259.6690 0007363  37.3950 322.7550 15.49442652595576" },
  { name: "CSS (TIANHE)", noradId: 48274, line1: "1 48274U 21035A   26321.57295439  .00017960  00000+0  21376-3 0  9998", line2: "2 48274  41.4687 109.8550 0004864 252.9645 107.0661 15.60681825317127" },
  { name: "HST", noradId: 20580, line1: "1 20580U 90037B   26321.79626699  .00006787  00000+0  20370-3 0  9994", line2: "2 20580  28.4712 109.4661 0002493  63.7301 296.3552 15.32338566812146" },
]
