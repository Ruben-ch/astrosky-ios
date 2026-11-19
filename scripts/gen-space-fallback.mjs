// Génère les données de secours hors-ligne de l'onglet Espace :
//   - src/data/launchesFallback.generated.ts : prochains lancements (Launch Library 2,
//     The Space Devs), réduits aux champs lus par src/services/space/launchLibrary.ts ;
//   - src/data/apodFallback.generated.ts : une Image Astronomique du Jour au format de
//     l'API NASA, extraite de la page officielle https://science.nasa.gov/apod/
//     (l'API api.nasa.gov renvoie actuellement des entrées génériques).
// Usage :
//   1. curl -o <dl>/ll2_upcoming.json "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30&mode=normal&hide_recent_previous=true"
//      curl -L -o <dl>/astropix.html "https://apod.nasa.gov/apod/astropix.html"
//   2. node scripts/gen-space-fallback.mjs <dl> src/data
//   3. npx vitest run (spaceServices.test.ts analyse les deux jeux embarqués)
import fs from 'node:fs'
import path from 'node:path'

const [dl, out] = process.argv.slice(2)
if (!dl || !out) throw new Error('usage : node scripts/gen-space-fallback.mjs <dlDir> <outDir>')

// ─── Launch Library 2 ────────────────────────────────────────────────────
const ll2 = JSON.parse(fs.readFileSync(path.join(dl, 'll2_upcoming.json'), 'utf8'))
const pick = (o, keys) => (o ? Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])) : null)
const launches = ll2.results.map((r) => ({
  id: r.id,
  name: r.name,
  net: r.net,
  window_start: r.window_start,
  window_end: r.window_end,
  net_precision: pick(r.net_precision, ['name', 'abbrev']),
  probability: r.probability,
  holdreason: r.holdreason,
  failreason: r.failreason,
  webcast_live: r.webcast_live,
  image: r.image,
  status: pick(r.status, ['abbrev', 'name', 'description']),
  launch_service_provider: pick(r.launch_service_provider, ['name', 'type']),
  rocket: { configuration: pick(r.rocket?.configuration, ['name', 'family', 'full_name', 'variant']) },
  mission: r.mission ? { ...pick(r.mission, ['name', 'description', 'type']), orbit: pick(r.mission.orbit, ['name', 'abbrev']) } : null,
  pad: r.pad ? { ...pick(r.pad, ['name', 'latitude', 'longitude']), location: pick(r.pad.location, ['name', 'country_code']) } : null,
}))
const fetchedAt = launches.length ? new Date(fs.statSync(path.join(dl, 'll2_upcoming.json')).mtimeMs).toISOString() : null
fs.writeFileSync(path.join(out, 'launchesFallback.generated.ts'), `// ⚠️ Fichier généré automatiquement — ne pas éditer à la main (scripts/gen-space-fallback.mjs).
// Source : The Space Devs — Launch Library 2 (/2.2.0/launch/upcoming/), ${launches.length} lancements.
import type { Ll2LaunchRaw } from '../types/space'

/** Date du relevé des lancements embarqués. */
export const BUNDLED_LAUNCHES_FETCHED_AT = Date.parse(${JSON.stringify(fetchedAt)})

/** Réponse Launch Library 2 réduite, analysée à l'exécution comme une réponse réseau. */
export const BUNDLED_LAUNCHES_RAW: readonly Ll2LaunchRaw[] = ${JSON.stringify(launches, null, 2)}
`)

// ─── APOD (page officielle science.nasa.gov) ─────────────────────────────
const html = fs.readFileSync(path.join(dl, 'astropix.html'), 'utf8')
// Les liens internes laissent des espaces parasites avant la ponctuation (« Sun ’s », « chromatic ! »).
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/\s+/g, ' ')
  .replace(/\s+([,.!?;:’)])/g, '$1').replace(/\(\s+/g, '(').trim()
const title = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1])).find((t) => t && !/Suggested|Astronomy Picture/.test(t))
const expStart = html.indexOf('Explanation:')
const expEnd = html.indexOf("Tomorrow's picture", expStart)
const explanation = text(html.slice(expStart + 'Explanation:'.length, expEnd))
// Image du jour : dernière image APOD de la page avant l'explication (l'image Open Graph peut être ancienne).
const image = [...html.slice(0, expStart).matchAll(/https:\/\/assets\.science\.nasa\.gov\/dynamicimage\/assets\/science\/cds\/apod\/[^"?]+\.(?:jpg|jpeg|png)/gi)].at(-1)?.[0]
const dateCode = /discuss_apod\.php\?date=(\d{2})(\d{2})(\d{2})/.exec(html)
const creditCell = /Credit &amp; Copyright:<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/.exec(html)?.[1]
const credit = creditCell ? text(creditCell) || null : null
if (!title || !explanation || !image || !dateCode) throw new Error('page APOD : structure inattendue')
const apod = {
  date: `20${dateCode[1]}-${dateCode[2]}-${dateCode[3]}`,
  title,
  explanation,
  media_type: 'image',
  url: `${image}?w=1024&h=1024&fit=clip`,
  hdurl: `${image}?w=2048&h=2048&fit=clip`,
  copyright: credit,
}
fs.writeFileSync(path.join(out, 'apodFallback.generated.ts'), `// ⚠️ Fichier généré automatiquement — ne pas éditer à la main (scripts/gen-space-fallback.mjs).
// Source : page officielle de l'Image Astronomique du Jour, https://science.nasa.gov/apod/
import type { ApodApiRaw } from '../types/space'

/** Image Astronomique du Jour embarquée (format de l'API NASA), affichée hors-ligne sans cache. */
export const BUNDLED_APOD_RAW: ApodApiRaw = ${JSON.stringify(apod, null, 2)}
`)
console.log({ launches: launches.length, apod: { date: apod.date, title: apod.title, explanationChars: explanation.length, credit } })
