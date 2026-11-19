// Génère src/data/cities.generated.ts à partir du jeu GeoNames (CC-BY 4.0).
// Usage :
//   1. Télécharger dans <dlDir> depuis https://download.geonames.org/export/dump/ :
//      cities15000.zip (décompressé en cities15000.txt) et admin1CodesASCII.txt
//   2. node scripts/gen-cities.mjs <dlDir> src/data
//   3. npx vitest run (citySearch.test.ts valide effectifs et coordonnées)
// Sélection : toutes les villes ≥ 150 000 hab. du monde, + France ≥ 10 000,
// + Belgique/Suisse/Luxembourg/Monaco ≥ 20 000, + Québec ≥ 20 000 ;
// sections de ville (code PPLX : arrondissements, quartiers) exclues.
import fs from 'node:fs'
import path from 'node:path'

const [dl, out] = process.argv.slice(2)
if (!dl || !out) throw new Error('usage: node scripts/gen-cities.mjs <dlDir> <outDir>')

const lines = (f) => fs.readFileSync(path.join(dl, f), 'utf8').split('\n').filter(Boolean)

const admin1 = new Map(lines('admin1CodesASCII.txt').map((l) => {
  const [code, name] = l.split('\t')
  return [code, name]
}))

const keep = (cc, a1, pop) =>
  pop >= 150_000 ||
  (cc === 'FR' && pop >= 10_000) ||
  (['BE', 'CH', 'LU', 'MC'].includes(cc) && pop >= 20_000) ||
  (cc === 'CA' && a1 === '10' && pop >= 20_000)

const regions = []
const regionIndex = new Map()
const regionOf = (name) => {
  if (!regionIndex.has(name)) {
    regionIndex.set(name, regions.length)
    regions.push(name)
  }
  return regionIndex.get(name)
}

const rows = []
for (const l of lines('cities15000.txt')) {
  const c = l.split('\t')
  const [id, name, , , lat, lon] = c
  const cc = c[8]
  const a1 = c[10]
  const pop = Number(c[14])
  // PPLX = section de ville (arrondissements « Lyon 03 », quartiers) : exclues.
  if (c[7] === 'PPLX' || !keep(cc, a1, pop)) continue
  const elevation = c[15] !== '' ? Number(c[15]) : Number(c[16])
  const elevationM = Number.isFinite(elevation) && elevation > -500 ? Math.round(elevation) : 0
  const region = admin1.get(`${cc}.${a1}`) ?? ''
  rows.push([Number(id), name, cc, regionOf(region), +(+lat).toFixed(3), +(+lon).toFixed(3), elevationM, pop])
}
rows.sort((a, b) => b[7] - a[7])
if (rows.length < 4000) throw new Error(`trop peu de villes : ${rows.length}`)

const q = (s) => JSON.stringify(s)
const body = `// ⚠️ Fichier généré automatiquement par scripts/gen-cities.mjs — ne pas éditer à la main.
// Source : GeoNames cities15000 + admin1CodesASCII (https://www.geonames.org, CC-BY 4.0).
// Coordonnées WGS84 en degrés décimaux (3 décimales ≈ 110 m), altitude en mètres (SRTM si absente).

/** Régions administratives (niveau 1) référencées par index. */
export const CITY_REGIONS: readonly string[] = [${regions.map(q).join(',')}]

/**
 * ${rows.length} villes triées par population décroissante.
 * Tuple : [geonameId, nom, pays ISO-3166, index région, latitudeDeg, longitudeDeg, altitudeM, population].
 */
export const CITY_ROWS: readonly (readonly [number, string, string, number, number, number, number, number])[] = [
${rows.map((r) => `[${r[0]},${q(r[1])},${q(r[2])},${r[3]},${r[4]},${r[5]},${r[6]},${r[7]}]`).join(',\n')},
]
`
fs.writeFileSync(path.join(out, 'cities.generated.ts'), body)
console.log(`cities.generated.ts : ${rows.length} villes, ${regions.length} régions, ${(body.length / 1024).toFixed(0)} Ko`)
