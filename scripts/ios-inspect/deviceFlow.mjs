/**
 * Parcours « appareil » de l'inspection iOS (appelé par run.mjs pour chaque thème) :
 *   - safe-areas : encoches iPhone 15 Pro émulées (CDP Emulation.setSafeAreaInsetsOverride,
 *     59 px en haut, 34 px en bas) ; aucun contrôle ni texte atteignable dans ces bandes,
 *     sur chaque onglet, feuille, plein écran et visionneuse ;
 *   - capteurs iOS : DeviceOrientationEvent.requestPermission simulé (accordé / refusé),
 *     évènements `deviceorientation` avec webkitCompassHeading (pas d'évènement absolu,
 *     comme Safari) ; vérifie le geste requis, la fusion cap + inclinaison, le lissage
 *     (bruit, passage 359° → 0°) et le repli tactile ;
 *   - hors-ligne : build de production servi en local (comme les assets Capacitor),
 *     (a) premier lancement sans aucun accès externe → données embarquées,
 *     (b) session chaude puis context.setOffline(true) → navigation complète sur caches.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { openPage } from './devicePage.mjs'
import { routeSpaceApis } from './spaceFlow.mjs'

export const SAFE_INSETS = { top: 59, bottom: 34, left: 0, right: 0 }
const PREVIEW_PORT = Number(process.env.INSPECT_PREVIEW_PORT ?? 5299)

/** Build de production dans .playwright/dist puis `vite preview` (bundle local, sans HMR). */
export async function startPreview(root) {
  const vite = path.join(root, 'node_modules/vite/bin/vite.js')
  const outDir = path.join(root, '.playwright/dist')
  await new Promise((resolve, reject) => {
    const b = spawn(process.execPath, [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' })
    b.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build : code ${code}`))))
  })
  const server = spawn(process.execPath, [vite, 'preview', '--outDir', outDir, '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'pipe' })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview ne démarre pas')), 30_000)
    server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(timer); resolve() } })
    server.on('exit', (code) => reject(new Error(`vite preview arrêté (${code})`)))
  })
  return { base: `http://127.0.0.1:${PREVIEW_PORT}`, stop: () => server.kill() }
}

/** Contrôles et textes atteignables (elementFromPoint) dans les bandes d'encoche. */
const safeAreaAudit = (page, label) => page.evaluate(({ label, insets }) => {
  const issues = []
  const H = window.innerHeight
  const W = window.innerWidth
  const inBand = (y) => y < insets.top || y > H - insets.bottom
  const interactive = 'button, a, input, select, textarea, [role=tab], [role=radio], [role=slider], [role=switch], [role=option], [role=checkbox]'
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)
  for (const el of document.querySelectorAll(interactive)) {
    // Fond assombri d'une feuille (toucher pour fermer) : couvre volontairement tout l'écran.
    if (el.hasAttribute('data-sheet-backdrop')) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    for (const y of [r.top + 2, (r.top + r.bottom) / 2, r.bottom - 2]) {
      if (!inBand(y) || y < 0 || y > H) continue
      const hit = document.elementFromPoint(Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y)
      if (hit && (hit === el || el.contains(hit))) { issues.push(`${label}: contrôle sous l'encoche (y=${Math.round(y)}) → ${name(el)}`); break }
    }
  }
  // Texte rendu dans les bandes (titre collé sous la barre d'état, libellé sous l'indicateur d'accueil).
  for (let y = 1; y < H; y += 4) {
    if (!inBand(y)) { y = H - insets.bottom; continue }
    for (let x = 4; x < W; x += 12) {
      const hit = document.elementFromPoint(x, y)
      const own = hit && [...hit.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '')
      if (own) { issues.push(`${label}: texte sous l'encoche (${x},${y}) → « ${hit.textContent.trim().slice(0, 30)} »`); return issues }
    }
  }
  return issues
}, { label, insets: SAFE_INSETS })

export async function inspectSafeAreas({ browser, root, base, simTime, theme, failures, warnings = [], capture }) {
  const { ctx, page } = await openPage(browser, { failures, warnings }, `safe-area/${theme}`)
  await routeSpaceApis(ctx, root)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: SAFE_INSETS })
  const url = (q) => `${base}/?theme=${theme}&t=${simTime}&${q}`
  const click = (role, name) => () => page.getByRole(role, { name }).first().click()
  const states = [
    ['tonight', 'tab=tonight'],
    ['tonight-end', 'tab=tonight', () => page.evaluate(() => document.querySelector('main').scrollTo(0, 1e6))],
    ['location', 'tab=tonight', click('button', /Site d'observation/)],
    ['sky', 'tab=sky&sky=200,40,100'],
    ['sky-immersive', 'tab=sky&sky=200,40,100', click('button', 'Plein écran')],
    ['sky-layers', 'tab=sky&sky=200,40,100', click('button', 'Couches affichées')],
    ['sky-guide', 'tab=sky&sky=200,20,60&guide=M31'],
    ['system', 'tab=system'],
    ['catalog', 'tab=catalog'],
    ['catalog-filters', 'tab=catalog', click('button', /^Filtres/)],
    ['catalog-detail', 'tab=catalog', click('button', /Galaxie d'Andromède/)],
    ['timemachine', 'tab=catalog', click('button', /Déplier la machine/)],
    ['satellites', 'tab=satellites&space=radar'],
    ['launches', 'tab=satellites&space=launches'],
    ['apod-hd', 'tab=satellites&space=apod', click('button', 'Afficher en haute définition')],
  ]
  for (const [name, q, action] of states) {
    await page.goto(url(q))
    await page.waitForTimeout(2200)
    if (action) {
      await action().catch(() => failures.push(`safe-area/${theme}: état « ${name} » inaccessible`))
      await page.waitForTimeout(700)
    }
    failures.push(...(await safeAreaAudit(page, `safe-area/${theme}/${name}`)))
    await capture(page, `safearea-${theme}-${name}`)
  }
  await ctx.close()
}

/** Simulation iOS : permission explicite, pas d'évènement absolu, pompe d'évènements `deviceorientation`. */
const IOS_SENSORS = () => {
  // Safari n'expose pas `deviceorientationabsolute` : on retire l'attribut où qu'il soit défini.
  for (let o = window; o; o = Object.getPrototypeOf(o)) {
    if (Object.getOwnPropertyDescriptor(o, 'ondeviceorientationabsolute')) delete o.ondeviceorientationabsolute
  }
  window.__perm = 'granted'
  window.__permCalls = 0
  window.__orient = null
  DeviceOrientationEvent.requestPermission = async () => { window.__permCalls++; return window.__perm }
  let flip = false
  window.__pumpTimes = []
  setInterval(() => {
    const o = window.__orient
    if (!o) return
    window.__pumpTimes.push(performance.now())
    if (window.__pumpTimes.length > 40) window.__pumpTimes.shift()
    flip = !flip
    const heading = Array.isArray(o.heading) ? o.heading[flip ? 0 : 1] : o.heading
    const e = new Event('deviceorientation')
    // alpha iOS non référencé au nord (décalage arbitraire) : seul webkitCompassHeading doit compter.
    const props = { alpha: (360 - heading + 137) % 360, beta: o.beta, gamma: o.gamma ?? 0, absolute: false, webkitCompassHeading: heading }
    for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v })
    window.dispatchEvent(e)
  }, 30)
}

export async function inspectSensors({ browser, base, simTime, theme, failures, warnings = [], capture }) {
  const label = `sensors-ios/${theme}`
  const { ctx, page } = await openPage(browser, { failures, warnings }, label)
  await ctx.addInitScript(IOS_SENSORS)
  const fail = (m) => failures.push(`${label}: ${m}`)
  const readout = async () => {
    const t = await page.evaluate(() => document.body.innerText)
    const az = /Az\s*(\d+)°/.exec(t)
    const alt = /Haut\s*([−-]?\d+)°/.exec(t)
    return { az: az ? Number(az[1]) : NaN, alt: alt ? Number(alt[1].replace('−', '-')) : NaN }
  }
  const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
  const orient = (o) => page.evaluate((o) => { window.__orient = o }, o)

  await page.goto(`${base}/?tab=sky&theme=${theme}&t=${simTime}&sky=0,30,90`)
  await page.waitForTimeout(2000)
  if (await page.evaluate(() => 'ondeviceorientationabsolute' in window)) fail('simulation iOS invalide (évènement absolu présent)')
  if ((await page.evaluate(() => window.__permCalls)) !== 0) fail('permission demandée sans geste utilisateur')

  // Autorisation accordée : cap 120°, appareil vertical (β = 90°) → horizon est-sud-est.
  await orient({ heading: 120, beta: 90 })
  await page.getByRole('radio', { name: /Capteurs/ }).click()
  await page.waitForTimeout(1800)
  if ((await page.evaluate(() => window.__permCalls)) !== 1) fail('requestPermission non appelée exactement une fois au toucher')
  if (!(await page.getByRole('radio', { name: /Capteurs/, checked: true }).isVisible())) fail('mode Capteurs non actif après autorisation')
  if (await page.getByRole('alert').filter({ hasText: /contrôle tactile/ }).isVisible()) fail('repli tactile alors que les mesures arrivent')
  let r = await readout()
  if (!(angle(r.az, 120) <= 2 && Math.abs(r.alt) <= 2)) fail(`cap 120° / β 90° → lu Az ${r.az}° Haut ${r.alt}° (attendu 120° / 0°)`)
  await capture(page, `sensors-${theme}-ios-granted`)

  // Inclinaison vers le haut (β = 135° → hauteur 45°), cap 200°.
  await orient({ heading: 200, beta: 135 })
  await page.waitForTimeout(1500)
  r = await readout()
  if (!(angle(r.az, 200) <= 2 && Math.abs(r.alt - 45) <= 2)) fail(`cap 200° / β 135° → lu Az ${r.az}° Haut ${r.alt}° (attendu 200° / 45°)`)

  // Lissage anti-tremblement : bruit ±4° autour de 90°. Le filtre de l'app est temporel
  // (constante 120 ms) : il n'est jugé que si la simulation tient une cadence de capteur
  // réelle (≤ 60 ms entre mesures) ; une machine saturée espace les mesures et le filtre
  // suit alors légitimement la valeur brute.
  await orient({ heading: [86, 94], beta: 90 })
  await page.waitForTimeout(1500)
  const reads = []
  for (let i = 0; i < 6; i++) { reads.push((await readout()).az); await page.waitForTimeout(150) }
  const cadenceMs = await page.evaluate(() => {
    const t = window.__pumpTimes
    const d = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b)
    return d.length ? d[Math.floor(d.length / 2)] : Infinity
  })
  if (cadenceMs > 60) warnings.push(`${label}: cadence simulée ${Math.round(cadenceMs)} ms (machine saturée), lissage du bruit non évalué`)
  else if (reads.some((a) => angle(a, 90) > 2)) fail(`bruit ±4° mal lissé (cadence ${Math.round(cadenceMs)} ms) : ${reads.join(', ')}°`)

  // Passage par le nord : 358° / 2° alternés → vue au nord, jamais au sud.
  await orient({ heading: [358, 2], beta: 90 })
  await page.waitForTimeout(1500)
  r = await readout()
  if (angle(r.az, 0) > 3) fail(`moyenne 358°/2° → Az ${r.az}° (attendu ≈ 0°, lissage non circulaire)`)
  await capture(page, `sensors-${theme}-ios-north`)

  // Retour manuel au tactile : le glisser déplace à nouveau la vue.
  await page.getByRole('radio', { name: /Tactile/ }).click()
  await orient(null)
  const before = (await readout()).az
  const box = await page.getByRole('img', { name: /Carte du ciel interactive/ }).boundingBox()
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  if ((await readout()).az === before) fail('le glisser tactile ne déplace plus la vue après les capteurs')

  // Autorisation refusée → avis explicite et repli tactile.
  await page.evaluate(() => { window.__perm = 'denied' })
  await page.getByRole('radio', { name: /Capteurs/ }).click()
  await page.waitForTimeout(800)
  if (!(await page.getByRole('alert').filter({ hasText: /refusé.*contrôle tactile/ }).isVisible())) fail('refus sans avis « Accès aux capteurs refusé »')
  if (!(await page.getByRole('radio', { name: /Tactile/, checked: true }).isVisible())) fail('mode tactile non rétabli après refus')
  await capture(page, `sensors-${theme}-ios-denied`)
  await ctx.close()
}

export { inspectOffline } from './offlineFlow.mjs'
