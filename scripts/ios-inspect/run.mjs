/**
 * Inspection iOS automatisée d'AstroSky (Playwright + Chromium embarqué).
 * Lance son propre serveur Vite, puis pour chaque onglet × thème :
 *   - viewport iPhone 393×852, deviceScaleFactor 3, tactile, fr-FR / Europe/Paris ;
 *   - absence de scroll horizontal, cibles tactiles ≥ 44×44 px, zéro erreur console ;
 *   - audit pixel red-night : G ≤ 42, B ≤ 42 et G = B sur chaque pixel
 *     (seul #FF2A2A et ses dégradés vers le noir sont tolérés hors rouge pur).
 * Captures dans .playwright/shots/. Code de sortie ≠ 0 au moindre défaut.
 *
 * Usage : npm run inspect:ios  (après une fois : bash scripts/ios-inspect/setup.sh)
 * Paramètres d'URL de l'app : ?tab=tonight|sky|system|catalog|satellites&theme=dark|red-night&t=<ISO>
 *   onglet Espace : &space=radar|launches|apod (sous-écran initial)
 *   système solaire : &body=<Id> (astre sélectionné et centré, ex. Jupiter)
 *   planétarium : &sky=<az>,<alt>,<champ> (vue) &guide=<clé> (guidage, ex. M31)
 * Interactions parcourues : frise des crépuscules (glisser), graphique météo,
 * filtre d'instrument + verrouillage d'une cible vers le Catalogue, machine
 * temporelle (molette, saut d'évènement, pas mensuel), feuille de lieu
 * (recherche de ville, favori), planétarium (pan, zoom, couches, projection,
 * guidage → pointé, capteurs inactifs → repli tactile, plein écran, envoi
 * depuis le Catalogue), encyclopédie du Catalogue (recherche M42 / nom sans accents,
 * puces rapides, feuille de filtres : familles, magnitude limite, tri ; fiche
 * détaillée de M31 défilée ; simulateur visuel C8 + Barlow + orientation puis
 * photo plein format avec rotation ; retour liste ; fiche de Jupiter), onglet Espace (radar et passages,
 * guidage vers l'ISS, lancements dépliés et filtrés, Image du jour + archive + HD), Système solaire 3D (orbite, zoom, vue polaire, sélection
 * + télémétrie, centrage, double-tap, lunes galiléennes, voyage dans le temps,
 * démontage WebGL). Le stockage est vidé à chaque navigation.
 * Parcours appareil (deviceFlow.mjs / offlineFlow.mjs) : safe-areas iPhone émulées,
 * capteurs iOS (permission accordée / refusée, cap + inclinaison, lissage) et
 * hors-ligne sur le build de production (premier lancement, setOffline, relance).
 * Caméra AR (arFlow.mjs) : getUserMedia simulé par un flux synthétique coloré,
 * filtre rouge de la vidéo vérifié par l'audit pixel, extinction des pistes.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AR_CAMERA_MOCK, inspectAr } from './arFlow.mjs'
import { inspectCatalog } from './catalogFlow.mjs'
import { inspectOffline, inspectSafeAreas, inspectSensors, startPreview } from './deviceFlow.mjs'
import { inspectSpace, routeSpaceApis } from './spaceFlow.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const libDir = path.join(root, '.playwright/libs/usr/lib/x86_64-linux-gnu')
const shotsDir = path.join(root, '.playwright/shots')
fs.mkdirSync(shotsDir, { recursive: true })

// LD_LIBRARY_PATH doit être positionné avant le lancement de Chromium.
if (fs.existsSync(libDir)) process.env.LD_LIBRARY_PATH = [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const { chromium } = await import('playwright')

const PORT = Number(process.env.INSPECT_PORT ?? 5199)
const BASE = `http://127.0.0.1:${PORT}`
const SIM_TIME = process.env.INSPECT_TIME ?? '2026-11-18T21:00:00Z'
const TABS = ['tonight', 'sky', 'system', 'catalog', 'satellites']
const THEMES = ['dark', 'red-night']

// Vite lancé directement (pas via npx) pour que server.kill() atteigne bien le processus.
const viteBin = path.join(root, 'node_modules/vite/bin/vite.js')
const server = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'pipe' })
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Vite ne démarre pas')), 30_000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(timer); resolve() } })
  server.on('exit', (code) => reject(new Error(`Vite s'est arrêté (${code})`)))
})

const failures = []
const warnings = []
const preview = await startPreview(root)
// iOS lisse le texte en niveaux de gris : on désactive l'anticrénelage sous-pixel
// (LCD) de Chromium, qui crée des franges vertes/bleues en bord de glyphe.
const browser = await chromium.launch({ args: ['--disable-lcd-text'] })
try {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'fr-FR', timezoneId: 'Europe/Paris',
  })
  // Déterminisme : préférences utilisateur effacées à chaque navigation, mais caches
  // réseau (TLE, météo, géocodage) conservés pour ne pas solliciter les API à chaque page
  // (CelesTrak bloque les téléchargements répétés).
  await ctx.addInitScript(() => {
    try {
      const keep = /^astrosky:(tle|weather|geocode|launches|apod):/
      for (const k of Object.keys(localStorage)) if (!keep.test(k)) localStorage.removeItem(k)
    } catch { /* stockage bloqué */ }
  })
  await ctx.addInitScript(AR_CAMERA_MOCK)
  await routeSpaceApis(ctx, root)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`))
  // Les refus HTTP des fournisseurs de données externes (quota CelesTrak, Open-Meteo…)
  // sont des conditions hors-ligne gérées par l'app (cache / données embarquées) :
  // signalés en avertissement. Toute autre erreur console reste bloquante.
  const EXTERNAL_DATA = /^https:\/\/(celestrak\.org|api\.open-meteo\.com|geocoding-api\.open-meteo\.com|api\.nasa\.gov|science\.nasa\.gov|ll\.thespacedevs\.com|assets\.science\.nasa\.gov|img\.youtube\.com|thespacedevs-prod\.nyc3\.digitaloceanspaces\.com)\//
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const url = m.location()?.url ?? ''
    const msg = `console: ${m.text()}${url ? ` (${url})` : ''}`
    if (EXTERNAL_DATA.test(url) && /Failed to load resource/.test(m.text())) warnings.push(msg)
    else failures.push(msg)
  })

  const capture = async (name) => {
    const file = path.join(shotsDir, `${name}.png`)
    await page.screenshot({ path: file })
    return file
  }
  const layoutAudit = (label) => page.evaluate((label) => {
    const issues = []
    if (document.documentElement.scrollWidth > window.innerWidth) issues.push(`${label}: scroll horizontal (${document.documentElement.scrollWidth}px)`)
    for (const el of document.querySelectorAll('button, a, [role=tab], [role=radio], [role=slider], input')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // Seuls les défileurs horizontaux explicitement voulus (data-h-scroll) sont exemptés.
      const inScroller = el.closest('[data-h-scroll]') !== null
      if (r.right > window.innerWidth + 0.5 && !inScroller) issues.push(`${label}: déborde → ${(el.textContent || el.tagName).trim().slice(0, 30)}`)
      if (r.width < 44 || r.height < 44) issues.push(`${label}: cible ${Math.round(r.width)}×${Math.round(r.height)} → ${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)}`)
    }
    return issues
  }, label)
  const pixelAudit = (file) => page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let bad = 0; let first = null
    for (let i = 0; i < d.length; i += 4) {
      const [r, gr, b] = [d[i], d[i + 1], d[i + 2]]
      if (gr > 42 || b > 42 || Math.abs(gr - b) > 1) { bad++; first ??= `(${(i / 4) % c.width},${Math.floor(i / 4 / c.width)}) rgb(${r},${gr},${b})` }
    }
    return { bad, first }
  }, `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`)

  for (const theme of THEMES) {
    const shots = []
    for (const tab of TABS) {
      await page.goto(`${BASE}/?tab=${tab}&theme=${theme}&t=${SIM_TIME}`)
      await page.waitForTimeout(3500)
      // Espace : capturer le résultat de la prédiction, pas l'état de calcul.
      if (tab === 'satellites') await page.getByRole('status').filter({ hasText: /satellites suivis/ }).waitFor({ timeout: 20_000 }).catch(() => failures.push(`satellites/${theme}: prédiction non terminée en 20 s`))
      failures.push(...(await layoutAudit(`${tab}/${theme}`)))
      shots.push(await capture(`${tab}-${theme}`))
      const height = await page.evaluate(() => document.querySelector('main').scrollHeight)
      for (let y = 800, i = 1; y < height; y += 800, i++) {
        await page.evaluate((y) => document.querySelector('main').scrollTo(0, y), y)
        await page.waitForTimeout(250)
        shots.push(await capture(`${tab}-${theme}-s${i}`))
      }
    }
    const expect = async (cond, message) => { if (!(await cond)) failures.push(message) }
    const drag = async (locator, fromRatio, toRatio) => {
      const box = await locator.boundingBox()
      const y = box.y + box.height / 2
      await page.mouse.move(box.x + box.width * fromRatio, y)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * toRatio, y, { steps: 8 })
      await page.mouse.up()
    }

    // Ce soir : frise des crépuscules glissée vers l'aube, graphique météo touché.
    await page.goto(`${BASE}/?tab=tonight&theme=${theme}&t=${SIM_TIME}`)
    await page.waitForTimeout(3000)
    const frise = page.getByRole('slider', { name: /Frise de la nuit/ })
    await drag(frise, 0.5, 0.8)
    await page.waitForTimeout(400)
    failures.push(...(await layoutAudit(`twilight/${theme}`)))
    shots.push(await capture(`twilight-${theme}-scrub`))
    const weather = page.getByRole('slider', { name: /Conditions heure par heure/ })
    if (await weather.count()) {
      await weather.scrollIntoViewIfNeeded()
      const box = await weather.boundingBox()
      await page.mouse.click(box.x + box.width * 0.7, box.y + 30)
      await page.waitForTimeout(300)
      shots.push(await capture(`weather-${theme}-hour`))
    } else failures.push(`weather/${theme}: graphique horaire absent (réseau Open-Meteo ?)`)

    // Meilleures cibles : filtre Télescope puis verrouillage vers le Catalogue.
    const scope = page.getByRole('radio', { name: /Télescope/ })
    await scope.scrollIntoViewIfNeeded()
    await scope.click()
    await page.waitForTimeout(500)
    failures.push(...(await layoutAudit(`targets/${theme}`)))
    shots.push(await capture(`targets-${theme}-telescope`))
    await page.getByRole('radio', { name: /Œil nu/ }).click()
    await page.waitForTimeout(400)
    shots.push(await capture(`targets-${theme}-naked-eye`))
    await page.getByRole('button', { name: /^Verrouiller .* dans le catalogue$/ }).first().click()
    await page.waitForTimeout(800)
    await expect(page.getByRole('tab', { name: 'Catalogue', selected: true }).isVisible(), `lock/${theme}: l'onglet Catalogue n'est pas actif`)
    await expect(page.getByText('Cible verrouillée').isVisible(), `lock/${theme}: aucune cible verrouillée visible`)
    failures.push(...(await layoutAudit(`lock/${theme}`)))
    shots.push(await capture(`catalog-${theme}-from-tonight`))

    // Machine temporelle : molette, saut « Nuit noire », pas d'un mois.
    await page.goto(`${BASE}/?tab=catalog&theme=${theme}&t=${SIM_TIME}`)
    await page.waitForTimeout(2500)
    await page.getByRole('button', { name: /Déplier la machine/ }).click()
    await drag(page.getByRole('slider', { name: /Molette temporelle/ }), 0.5, 0.35)
    await page.waitForTimeout(300)
    failures.push(...(await layoutAudit(`timemachine/${theme}`)))
    shots.push(await capture(`timemachine-${theme}`))
    await page.getByRole('button', { name: /^Aller à : Nuit noire/ }).click()
    await page.getByRole('radio', { name: 'Mois' }).click()
    await page.getByRole('button', { name: 'Avancer de 1 mois' }).click()
    await page.waitForTimeout(400)
    shots.push(await capture(`timemachine-${theme}-jumps`))
    await page.getByRole('button', { name: /Replier la machine/ }).click()
    await page.getByRole('button', { name: /Galaxie d'Andromède/ }).click()
    await page.waitForTimeout(400)
    shots.push(await capture(`catalog-${theme}-locked`))

    // Feuille de lieu : recherche de ville, favori, liste des favoris.
    await page.getByRole('button', { name: /Site d'observation/ }).click()
    await page.waitForTimeout(300)
    failures.push(...(await layoutAudit(`location/${theme}`)))
    shots.push(await capture(`location-${theme}`))
    await page.getByRole('searchbox', { name: 'Rechercher une ville' }).fill('Lyon')
    await page.getByRole('button', { name: /^Choisir Lyon/ }).first().waitFor({ timeout: 8000 })
    failures.push(...(await layoutAudit(`location-search/${theme}`)))
    shots.push(await capture(`location-${theme}-search`))
    await page.getByRole('button', { name: /^Ajouter Lyon aux favoris/ }).first().click()
    await page.getByRole('button', { name: 'Effacer la recherche' }).click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: /^Retirer Lyon des favoris/ }).first().isVisible(), `location/${theme}: favori Lyon absent`)
    shots.push(await capture(`location-${theme}-favorites`))
    await page.getByRole('button', { name: /^Choisir Lyon/ }).first().click()
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: /Site d'observation : Lyon/ }).isVisible(), `location/${theme}: le site Lyon n'est pas appliqué`)

    await inspectCatalog({ page, base: BASE, simTime: SIM_TIME, theme, expect, layoutAudit, capture, shots, failures })
    await inspectSpace({ page, base: BASE, simTime: SIM_TIME, theme, expect, layoutAudit, capture, shots, failures })

    // Planétarium : pan + zoom, couches, projection équidistante.
    await page.goto(`${BASE}/?tab=sky&theme=${theme}&t=${SIM_TIME}&sky=200,40,100`)
    await page.waitForTimeout(2500)
    const canvas = page.getByRole('img', { name: /Carte du ciel interactive/ })
    await drag(canvas, 0.3, 0.6)
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click()
    await page.waitForTimeout(500)
    failures.push(...(await layoutAudit(`sky/${theme}`)))
    shots.push(await capture(`sky-${theme}-pan-zoom`))
    await page.getByRole('button', { name: 'Couches affichées' }).click()
    await page.getByRole('switch', { name: /Grille altazimutale/ }).click()
    await page.getByRole('switch', { name: /Grille équatoriale/ }).click()
    failures.push(...(await layoutAudit(`sky-layers/${theme}`)))
    shots.push(await capture(`sky-${theme}-layers`))
    await page.getByRole('button', { name: 'Fermer les couches' }).click()
    await page.getByRole('button', { name: /^Projection stéréographique/ }).click()
    await page.waitForTimeout(500)
    shots.push(await capture(`sky-${theme}-grids-equidistant`))

    // Guidage : flèche vers M31 hors champ, puis centrage → cible pointée.
    await page.goto(`${BASE}/?tab=sky&theme=${theme}&t=${SIM_TIME}&sky=200,20,60&guide=M31`)
    await page.waitForTimeout(2500)
    await expect(page.getByRole('status').filter({ hasText: /Guidage · M31/ }).isVisible(), `guide/${theme}: barre de guidage absente`)
    failures.push(...(await layoutAudit(`sky-guide/${theme}`)))
    shots.push(await capture(`sky-${theme}-guide-arrow`))
    await page.getByRole('button', { name: 'Centrer', exact: true }).click()
    await page.waitForTimeout(1200)
    await expect(page.getByRole('status').filter({ hasText: /pointé/ }).isVisible(), `guide/${theme}: la cible centrée n'est pas « pointée »`)
    shots.push(await capture(`sky-${theme}-guide-locked`))

    // Capteurs : aucun évènement d'orientation en Chromium de bureau → repli tactile.
    await page.getByRole('radio', { name: /Capteurs/ }).click()
    await page.waitForTimeout(2000)
    await expect(page.getByRole('alert').filter({ hasText: /contrôle tactile/ }).isVisible(), `sensors/${theme}: pas de repli tactile signalé`)
    await expect(page.getByRole('radio', { name: /Tactile/, checked: true }).isVisible(), `sensors/${theme}: mode tactile non rétabli`)
    shots.push(await capture(`sky-${theme}-sensors-fallback`))

    // Plein écran puis retour.
    await page.getByRole('button', { name: 'Plein écran' }).click()
    await page.waitForTimeout(400)
    await expect(page.getByRole('tablist').count().then((n) => n === 0), `immersive/${theme}: la barre d'onglets reste visible`)
    failures.push(...(await layoutAudit(`sky-immersive/${theme}`)))
    shots.push(await capture(`sky-${theme}-immersive`))
    await page.getByRole('button', { name: 'Quitter le plein écran' }).click()

    await inspectAr({ page, base: BASE, simTime: SIM_TIME, theme, expect, layoutAudit, capture, shots, failures })

    // Catalogue → « Pointer dans le ciel ».
    await page.goto(`${BASE}/?tab=catalog&theme=${theme}&t=${SIM_TIME}`)
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: /Galaxie d'Andromède/ }).click()
    await page.getByRole('button', { name: 'Pointer dans le ciel' }).click()
    await page.waitForTimeout(1500)
    await expect(page.getByRole('tab', { name: 'Ciel', selected: true }).isVisible(), `catalog→sky/${theme}: onglet Ciel inactif`)
    await expect(page.getByRole('status').filter({ hasText: /M31/ }).isVisible(), `catalog→sky/${theme}: guidage M31 absent`)
    shots.push(await capture(`sky-${theme}-from-catalog`))

    // Système solaire 3D : orbite + zoom, vue polaire, sélection → télémétrie, centrage, double-tap.
    await page.goto(`${BASE}/?tab=system&theme=${theme}&t=${SIM_TIME}`)
    await page.waitForTimeout(2500)
    const orrery = page.getByRole('img', { name: /Système solaire en 3D/ })
    await expect(orrery.locator('canvas').count().then((n) => n === 1), `system/${theme}: canevas WebGL absent`)
    await drag(orrery, 0.35, 0.6)
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click()
    await page.waitForTimeout(900)
    failures.push(...(await layoutAudit(`system-orbit/${theme}`)))
    shots.push(await capture(`system-${theme}-orbit-zoom`))
    await page.getByRole('radio', { name: 'Polaire' }).click()
    await page.waitForTimeout(1000)
    await expect(page.getByRole('radio', { name: 'Polaire', checked: true }).isVisible(), `system/${theme}: vue polaire non active`)
    shots.push(await capture(`system-${theme}-polar`))
    await page.getByRole('option', { name: 'Sélectionner Saturne' }).click()
    await page.waitForTimeout(500)
    await expect(page.getByRole('region', { name: 'Télémétrie : Saturne' }).isVisible(), `system/${theme}: télémétrie de Saturne absente`)
    await expect(page.getByText('Anneaux', { exact: true }).isVisible(), `system/${theme}: inclinaison des anneaux absente`)
    failures.push(...(await layoutAudit(`system-telemetry/${theme}`)))
    shots.push(await capture(`system-${theme}-saturn-telemetry`))
    await page.getByRole('option', { name: 'Centrer Saturne' }).click()
    await page.waitForTimeout(1200)
    await expect(page.getByRole('button', { name: 'Centrer Saturne dans la vue', pressed: true }).isVisible(), `system/${theme}: Saturne non centrée`)
    shots.push(await capture(`system-${theme}-saturn-focus`))
    await page.getByRole('radio', { name: 'Écliptique' }).click()
    await page.waitForTimeout(1000)
    shots.push(await capture(`system-${theme}-saturn-ecliptic`))
    // Double-tap au centre de la vue (Saturne centrée) : l'astre reste sélectionné et centré.
    const box = await orrery.boundingBox()
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(120)
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(1000)
    await expect(page.getByRole('region', { name: 'Télémétrie : Saturne' }).isVisible(), `system/${theme}: double-tap sur Saturne sans effet`)
    await page.getByRole('button', { name: 'Fermer la télémétrie' }).click()
    await page.getByRole('button', { name: 'Orbites et grille de l’écliptique' }).click()
    await page.getByRole('button', { name: 'Vue d’ensemble centrée sur le Soleil' }).click()
    await page.waitForTimeout(1000)
    shots.push(await capture(`system-${theme}-no-orbits`))

    // Jupiter et ses lunes galiléennes, puis voyage dans le temps (+1 mois) : positions resynchronisées.
    await page.goto(`${BASE}/?tab=system&theme=${theme}&t=${SIM_TIME}&body=Jupiter`)
    await page.waitForTimeout(2500)
    shots.push(await capture(`system-${theme}-jupiter-moons`))
    await page.getByRole('option', { name: 'Sélectionner Io' }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText('Écart à Jupiter').isVisible(), `system/${theme}: télémétrie d'Io incomplète`)
    shots.push(await capture(`system-${theme}-io-telemetry`))
    const before = await page.getByRole('region', { name: 'Télémétrie : Io' }).innerText()
    await page.getByRole('button', { name: /Déplier la machine/ }).click()
    await page.getByRole('radio', { name: 'Mois' }).click()
    await page.getByRole('button', { name: 'Avancer de 1 mois' }).click()
    await page.waitForTimeout(800)
    failures.push(...(await layoutAudit(`system-timemachine/${theme}`)))
    shots.push(await capture(`system-${theme}-timemachine`))
    await page.getByRole('button', { name: /Replier la machine/ }).click()
    await page.waitForTimeout(500)
    const after = await page.getByRole('region', { name: 'Télémétrie : Io' }).innerText()
    await expect(Promise.resolve(before !== after), `system/${theme}: la télémétrie ne suit pas le voyage dans le temps`)
    // Démontage : quitter l'onglet libère le canevas WebGL.
    await page.getByRole('tab', { name: 'Catalogue' }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('[data-orrery-root] canvas').count().then((n) => n === 0), `system/${theme}: canevas WebGL non libéré`)

    // Appareil : safe-areas, capteurs iOS, hors-ligne (contextes dédiés).
    const captureOn = async (p, name) => { const file = path.join(shotsDir, `${name}.png`); await p.screenshot({ path: file }); shots.push(file) }
    const device = { browser, root, simTime: SIM_TIME, theme, failures, warnings, capture: captureOn }
    await inspectSafeAreas({ ...device, base: BASE })
    await inspectSensors({ ...device, base: BASE })
    await inspectOffline({ ...device, base: preview.base })

    if (theme === 'red-night') {
      for (const file of shots) {
        const { bad, first } = await pixelAudit(file)
        if (bad > 0) failures.push(`red-night: ${bad} pixels non rouges dans ${path.basename(file)}, ex. ${first}`)
      }
    }
    console.log(`✓ ${theme} : ${shots.length} captures`)
  }
} finally {
  await browser.close()
  server.kill()
  preview.stop()
}

const unique = [...new Set(failures)]
for (const w of new Set(warnings)) console.warn(`⚠ ${w} — repli hors-ligne de l'app`)
if (unique.length > 0) {
  console.error(`✗ ${unique.length} défaut(s) :\n  ${unique.join('\n  ')}`)
  process.exit(1)
}
console.log(`✓ Inspection iOS réussie — captures dans ${path.relative(root, shotsDir)}/`)
