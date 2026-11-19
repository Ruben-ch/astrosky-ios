/**
 * Parcours iOS du mode Caméra AR (appelé par run.mjs pour chaque thème).
 * `navigator.mediaDevices.getUserMedia` est remplacé par un flux synthétique
 * (canvas.captureStream) volontairement très coloré — ciel bleu, arbres verts,
 * lune blanche — pour que l'audit pixel red-night prouve que le filtre SVG de la
 * vidéo ne laisse passer aucun vert, bleu ni blanc.
 * Vérifie : vidéo active, champ 65°, barre d'outils AR, renfort de visibilité,
 * photo annotée, refus d'autorisation → retour au mode Capteurs, et extinction
 * de toutes les pistes en quittant le mode AR puis en changeant d'onglet.
 */

/** Script d'initialisation de page : faux getUserMedia (window.__arDeny force un refus). */
export const AR_CAMERA_MOCK = () => {
  const tracks = []
  window.__arTracks = tracks
  const md = navigator.mediaDevices ?? {}
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: md, configurable: true })
  md.getUserMedia = async (constraints) => {
    window.__arConstraints = constraints
    if (window.__arDeny) throw new DOMException('Permission refusée', 'NotAllowedError')
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 360
    const g = c.getContext('2d')
    let frame = 0
    const draw = () => {
      const sky = g.createLinearGradient(0, 0, 0, c.height)
      sky.addColorStop(0, '#0b1d5c')
      sky.addColorStop(1, '#3d7bd9')
      g.fillStyle = sky
      g.fillRect(0, 0, c.width, c.height)
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(480 + Math.sin(frame / 20) * 4, 90, 26, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#1fbf3a'
      for (let x = 0; x < c.width; x += 40) {
        g.beginPath()
        g.moveTo(x, c.height)
        g.lineTo(x + 20, c.height - 90 - ((x * 7) % 50))
        g.lineTo(x + 40, c.height)
        g.fill()
      }
      frame++
    }
    draw()
    setInterval(draw, 100)
    const stream = c.captureStream(15)
    tracks.push(...stream.getTracks())
    return stream
  }
}

export async function inspectAr({ page, base, simTime, theme, expect, layoutAudit, capture, shots, failures }) {
  const allEnded = () => page.evaluate(() => (window.__arTracks ?? []).length > 0 && window.__arTracks.every((t) => t.readyState === 'ended'))
  const videoPlaying = () => page.waitForFunction(() => {
    const v = document.querySelector('[data-ar-video]')
    return v && v.readyState >= 2 && v.srcObject
  }, null, { timeout: 8000 }).then(() => true, () => false)

  await page.goto(`${base}/?tab=sky&theme=${theme}&t=${simTime}&sky=110,25,90`)
  await page.waitForTimeout(2000)
  await page.getByRole('radio', { name: /^AR/ }).click()
  await expect(videoPlaying(), `ar/${theme}: flux vidéo de la caméra non affiché`)
  await expect(page.evaluate(() => JSON.stringify(window.__arConstraints)).then((s) => /"environment"/.test(s) && /"audio":false/.test(s)), `ar/${theme}: contraintes getUserMedia incorrectes`)
  // Sans capteurs (Chromium de bureau), la vue AR reste active et s'oriente au doigt.
  await page.waitForTimeout(2200)
  await expect(page.getByRole('radio', { name: /^AR/, checked: true }).isVisible(), `ar/${theme}: le mode AR n'est pas resté actif`)
  await expect(page.getByText(/Champ\s*65°/).isVisible(), `ar/${theme}: champ par défaut ≠ 65°`)
  await expect(page.getByRole('toolbar', { name: 'Outils de la caméra AR' }).isVisible(), `ar/${theme}: barre d'outils AR absente`)
  await expect(page.locator('[data-ar-video]').evaluate((v) => getComputedStyle(v).filter).then((f) => (theme === 'red-night') === /astrosky-red-night-video/.test(f)), `ar/${theme}: filtre vidéo de vision nocturne incorrect`)
  failures.push(...(await layoutAudit(`ar/${theme}`)))
  shots.push(await capture(`sky-${theme}-ar`))

  await page.getByRole('button', { name: /^Visibilité/ }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('[data-ar-video]').evaluate((v) => getComputedStyle(v).filter).then((f) => /brightness\(1\.45\)/.test(f)), `ar/${theme}: renfort de visibilité inactif`)
  shots.push(await capture(`sky-${theme}-ar-boost`))

  await page.getByRole('button', { name: 'Photo AR annotée' }).click()
  const preview = page.getByRole('dialog', { name: 'Photo AR annotée' })
  await preview.waitFor({ timeout: 8000 }).catch(() => failures.push(`ar/${theme}: aperçu de la photo AR absent`))
  await page.waitForTimeout(500)
  failures.push(...(await layoutAudit(`ar-photo/${theme}`)))
  shots.push(await capture(`sky-${theme}-ar-photo`))
  await page.getByRole('button', { name: 'Fermer la photo' }).click().catch(() => undefined)

  // Quitter le mode AR : voyant caméra éteint.
  await page.getByRole('radio', { name: 'Tactile' }).click()
  await page.waitForTimeout(300)
  await expect(allEnded(), `ar/${theme}: pistes vidéo encore actives après sortie du mode AR`)
  await expect(page.locator('[data-ar-video]').count().then((n) => n === 0), `ar/${theme}: élément vidéo resté affiché`)

  // Changement d'onglet en plein AR : pistes arrêtées.
  await page.getByRole('radio', { name: /^AR/ }).click()
  await videoPlaying()
  await page.getByRole('tab', { name: 'Ce soir' }).click()
  await page.waitForTimeout(400)
  await expect(allEnded(), `ar/${theme}: pistes vidéo encore actives après changement d'onglet`)

  // Autorisation refusée : message clair et retour au mode Capteurs.
  await page.goto(`${base}/?tab=sky&theme=${theme}&t=${simTime}&sky=110,25,90`)
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__arDeny = true })
  await page.getByRole('radio', { name: /^AR/ }).click()
  const alert = page.getByRole('alert').filter({ hasText: /caméra refusé/ })
  await alert.waitFor({ timeout: 5000 }).catch(() => failures.push(`ar/${theme}: message de refus caméra absent`))
  failures.push(...(await layoutAudit(`ar-denied/${theme}`)))
  shots.push(await capture(`sky-${theme}-ar-denied`))
  await page.getByRole('button', { name: 'Passer en mode Capteurs' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByRole('radio', { name: /^AR/, checked: false }).isVisible(), `ar/${theme}: toujours en mode AR après « Passer en mode Capteurs »`)
}
