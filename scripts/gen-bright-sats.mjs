// Génère src/data/brightSatellites.generated.ts : magnitudes standard des satellites
// brillants et TLE de secours hors-ligne des satellites brillants en orbite basse.
// Sources :
//   - Magnitudes standard : fichier QuickSat de Mike McCants (quicksat.mag, dans
//     https://www.mmccants.org/programs/qsmag.zip) — magnitude à 1000 km de distance,
//     disque éclairé à 50 %. Objets retenus : non désintégrés, magnitude ≤ 2,0.
//   - Station chinoise (CSS, NORAD 48274), absente de QuickSat : magnitude intrinsèque
//     Heavens-Above (même définition : 1000 km, 50 % éclairé), relevée le 2026-11-18.
//   - TLE : API publique tle.ivanstanojevic.me (miroir des éléments CelesTrak), un fichier
//     JSON par satellite dans <dlDir>/tle/<norad>.json.
// Usage : node scripts/gen-bright-sats.mjs <dlDir> src/data  puis  npx vitest run
import fs from 'node:fs'
import path from 'node:path'

const [dl, out] = process.argv.slice(2)
if (!dl || !out) throw new Error('usage : node scripts/gen-bright-sats.mjs <dlDir> <outDir>')

const STD_MAG_MAX = 2.0
/** Magnitudes Heavens-Above pour les objets absents de QuickSat. */
const HEAVENS_ABOVE = { 48274: { name: 'CSS (Tianhe)', stdMag: 0.0 } }
/** Orbite basse : plus de 11 révolutions par jour (passages rapides et brillants). */
const LEO_MIN_REV_PER_DAY = 11

const mags = new Map()
for (const line of fs.readFileSync(path.join(dl, 'qs/quicksat.mag'), 'latin1').split(/\r?\n/)) {
  if (!/^\d{5}/.test(line) || line.startsWith('00001')) continue
  if (line[6] === 'd') continue // désintégré
  const mag = Number.parseFloat(line.slice(33, 38))
  if (!Number.isFinite(mag) || mag > STD_MAG_MAX) continue
  mags.set(Number(line.slice(0, 5)), { name: line.slice(18, 33).trim(), stdMag: mag, source: 'quicksat' })
}
for (const [id, v] of Object.entries(HEAVENS_ABOVE)) mags.set(Number(id), { ...v, source: 'heavens-above' })

const tles = []
for (const file of fs.readdirSync(path.join(dl, 'tle'))) {
  const d = JSON.parse(fs.readFileSync(path.join(dl, 'tle', file), 'utf8'))
  const revPerDay = Number(d.line2.slice(52, 63))
  if (!mags.has(d.satelliteId) || revPerDay < LEO_MIN_REV_PER_DAY) continue
  tles.push({ name: d.name, noradId: d.satelliteId, line1: d.line1, line2: d.line2, date: d.date })
}
tles.sort((a, b) => mags.get(a.noradId).stdMag - mags.get(b.noradId).stdMag || a.noradId - b.noradId)
const fetchedAt = tles.map((t) => t.date).sort()[0]

const q = JSON.stringify
fs.writeFileSync(path.join(out, 'brightSatellites.generated.ts'), `// ⚠️ Fichier généré automatiquement — ne pas éditer à la main (scripts/gen-bright-sats.mjs).
// Magnitudes : QuickSat (M. McCants) et Heavens-Above pour la station chinoise.
// TLE : miroir public des éléments CelesTrak (tle.ivanstanojevic.me).
import type { BrightSatelliteMagnitude } from '../types/orbital'
import type { TleRecord } from '../types/services'

/**
 * Magnitude standard (1000 km, disque éclairé à 50 %) des satellites brillants
 * (magnitude standard ≤ ${STD_MAG_MAX}), par numéro NORAD.
 */
export const BRIGHT_SATELLITE_MAGNITUDES: Readonly<Record<number, BrightSatelliteMagnitude>> = {
${[...mags.entries()].sort((a, b) => a[0] - b[0]).map(([id, m]) => `  ${id}: { name: ${q(m.name)}, stdMag: ${m.stdMag}, source: ${q(m.source)} },`).join('\n')}
}

/** Plus ancienne date d'éléments du jeu de secours. */
export const BRIGHT_TLE_FETCHED_AT = Date.parse(${q(fetchedAt)})

/** TLE de secours des ${tles.length} satellites brillants en orbite basse, du plus brillant au plus faible. */
export const BRIGHT_SATELLITE_TLES: readonly TleRecord[] = [
${tles.map((t) => `  { name: ${q(t.name)}, noradId: ${t.noradId}, line1: ${q(t.line1)}, line2: ${q(t.line2)} },`).join('\n')}
]
`)
console.log({ magnitudes: mags.size, leoTles: tles.length, fetchedAt })
