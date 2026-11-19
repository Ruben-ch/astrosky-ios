// Génère src/data/deepSkyExtras.generated.ts : angle de position et brillance de
// surface mesurée des objets du ciel profond, depuis la base OpenNGC (CC-BY-SA 4.0).
// Usage :
//   1. Télécharger dans <dlDir> depuis https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/ :
//      NGC.csv addendum.csv
//   2. node scripts/gen-dso-extras.mjs <dlDir> src/data
//   3. npx vitest run (deepSkyEntries.test.ts valide la couverture et les plages)
// Les catalogues Messier / NGC-IC existants (gen-catalogs.mjs) ne sont pas modifiés :
// la jointure se fait par désignation NGC/IC, puis par numéro Messier.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [dl, out] = process.argv.slice(2)
if (!dl || !out) throw new Error('usage : node scripts/gen-dso-extras.mjs <dlDir> <outDir>')

function parseCsv(file) {
  const [head, ...rows] = fs.readFileSync(path.join(dl, file), 'utf8').split(/\r?\n/).filter(Boolean)
  const cols = head.split(';')
  return rows.map((r) => Object.fromEntries(r.split(';').map((v, i) => [cols[i], v])))
}
const rows = [...parseCsv('NGC.csv'), ...parseCsv('addendum.csv')]
const byName = new Map(rows.map((r) => [r.Name, r]))
const byMessier = new Map(rows.filter((r) => r.M && r.Type !== 'Dup').map((r) => [Number(r.M), r]))

/** "NGC 224" → "NGC0224", "IC 434" → "IC0434". */
const openNgcName = (desig) => {
  const m = /^(NGC|IC)\s*(\d+)\s*([A-Z]?)$/i.exec(desig ?? '')
  return m ? `${m[1].toUpperCase()}${m[2].padStart(4, '0')}${m[3]}` : null
}
/** Suit les doublons OpenNGC (« Dup ») vers l'entrée principale. */
function resolve(row) {
  for (let i = 0; row && row.Type === 'Dup' && i < 3; i++) {
    const target = row.NGC ? `NGC${row.NGC.padStart(4, '0')}` : row.IC ? `IC${row.IC.padStart(4, '0')}` : null
    row = target ? byName.get(target) : row.M ? byMessier.get(Number(row.M)) : undefined
  }
  return row && row.Type !== 'Dup' ? row : undefined
}
const num = (s) => (s === undefined || s === '' ? null : Number.isFinite(Number(s)) ? Number(s) : null)

const { MESSIER_CATALOG } = await import(pathToFileURL(path.resolve(out, 'messier.generated.ts')).href).catch(() => ({}))
if (!MESSIER_CATALOG) throw new Error('Exécuter avec Node ≥ 22.18 (chargement natif des fichiers .ts)')
const { NGC_IC_CATALOG } = await import(pathToFileURL(path.resolve(out, 'ngcIc.generated.ts')).href)

const extras = []
const missing = []
for (const o of [...MESSIER_CATALOG, ...NGC_IC_CATALOG]) {
  const name = openNgcName(o.ngc)
  const row = resolve((name && byName.get(name)) || undefined) ?? (o.messier !== null ? resolve(byMessier.get(o.messier)) : undefined)
  if (!row) { missing.push(o.id); continue }
  const pa = num(row.PosAng)
  const sb = num(row.SurfBr)
  extras.push({ id: o.id, source: row.Name, positionAngleDeg: pa !== null && pa >= 0 && pa <= 180 ? pa : null, surfaceBrightness: sb !== null && sb > 5 && sb < 30 ? sb : null })
}

const line = (e) => `  ${JSON.stringify(e.id)}: { openNgc: ${JSON.stringify(e.source)}, positionAngleDeg: ${e.positionAngleDeg}, surfaceBrightness: ${e.surfaceBrightness} },`
fs.writeFileSync(path.join(out, 'deepSkyExtras.generated.ts'), `// ⚠️ Fichier généré automatiquement — ne pas éditer à la main.
// Source : OpenNGC (NGC.csv + addendum.csv, M. Verga, CC-BY-SA 4.0) — scripts/gen-dso-extras.mjs
import type { DeepSkyExtra } from '../types/encyclopedia'

/**
 * Compléments OpenNGC par identifiant de catalogue (\`"M31"\`, \`"NGC7000"\`) :
 * angle de position du grand axe (degrés, du nord vers l'est, \`null\` si non mesuré)
 * et brillance de surface moyenne mesurée (mag/arcsec², \`null\` si absente).
 */
export const DEEP_SKY_EXTRAS: Readonly<Record<string, DeepSkyExtra>> = {
${extras.map(line).join('\n')}
}
`)
console.log({ joined: extras.length, missing, withPa: extras.filter((e) => e.positionAngleDeg !== null).length, withSb: extras.filter((e) => e.surfaceBrightness !== null).length })
