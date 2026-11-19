/**
 * Génère les visuels natifs source pour @capacitor/assets :
 *   assets/icon-only.png  1024×1024, fond #000000 opaque (sans canal alpha) ;
 *   assets/splash.png     2732×2732, fond #000000, emblème centré.
 * Motif : astrolabe — disque bleu nuit, couronne dorée graduée (esthétique
 * d'instrument de l'app), réticule fin, croissant de lune, constellation et
 * étoile polaire dorées. Rendu SVG → PNG par sharp (dépendance de @capacitor/assets).
 *
 * Usage : node scripts/gen-app-assets.mjs && npx capacitor-assets generate --ios
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'assets')
const GOLD = '#E8B84A'
const GOLD_LIGHT = '#FFE3A1'
const GOLD_DEEP = '#A8781F'
const NIGHT = '#0E2350'
const NIGHT_DEEP = '#050B1F'

/** Emblème centré en (0, 0), rayon extérieur 400 unités. */
function emblem() {
  const ticks = []
  for (let i = 0; i < 72; i++) {
    const major = i % 6 === 0
    const aRad = (i * 5 * Math.PI) / 180
    const r0 = major ? 352 : 366
    const r1 = 384
    const [s, c] = [Math.sin(aRad), Math.cos(aRad)]
    ticks.push(`<line x1="${(r0 * s).toFixed(1)}" y1="${(-r0 * c).toFixed(1)}" x2="${(r1 * s).toFixed(1)}" y2="${(-r1 * c).toFixed(1)}" stroke="${GOLD}" stroke-width="${major ? 7 : 3.5}" stroke-linecap="round"/>`)
  }
  // Constellation stylisée (sept étoiles reliées), dans le quart inférieur gauche.
  const pts = [[-215, 70], [-150, 112], [-88, 98], [-30, 150], [10, 228], [-74, 246], [-118, 182]]
  const path = `M${pts.slice(0, 5).map((p) => p.join(' ')).join(' L')} L${pts[5].join(' ')} L${pts[6].join(' ')} L${pts[3].join(' ')}`
  const stars = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 0 ? 11 : 8}" fill="${GOLD_LIGHT}"/>`).join('')
  // Poussière d'étoiles déterministe (pas d'aléa : rendu reproductible).
  const dust = []
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996323
    const r = 60 + ((i * 97) % 270)
    const x = r * Math.cos(a)
    const y = r * Math.sin(a)
    if (Math.hypot(x - 158, y + 150) < 140) continue // dégage le croissant
    dust.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.6 + (i % 4) * 0.9).toFixed(1)}" fill="#F4E7C3" opacity="${(0.35 + (i % 5) * 0.12).toFixed(2)}"/>`)
  }
  const sparkle = (x, y, r) =>
    `<path d="M${x} ${y - r} Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y} Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r} Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y} Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r} Z" fill="url(#gold)"/>`
  return `
    <defs>
      <radialGradient id="sky" cx="0" cy="0" r="400" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${NIGHT}"/>
        <stop offset="0.72" stop-color="#0A1A3E"/>
        <stop offset="1" stop-color="${NIGHT_DEEP}"/>
      </radialGradient>
      <linearGradient id="gold" x1="-400" y1="-400" x2="400" y2="400" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${GOLD_LIGHT}"/>
        <stop offset="0.5" stop-color="${GOLD}"/>
        <stop offset="1" stop-color="${GOLD_DEEP}"/>
      </linearGradient>
      <mask id="crescent">
        <circle cx="158" cy="-150" r="104" fill="#fff"/>
        <circle cx="203" cy="-184" r="93" fill="#000"/>
      </mask>
    </defs>
    <circle r="400" fill="url(#sky)"/>
    <circle r="398" fill="none" stroke="url(#gold)" stroke-width="12"/>
    <circle r="340" fill="none" stroke="${GOLD}" stroke-width="3" opacity="0.85"/>
    ${ticks.join('')}
    <g stroke="${GOLD}" stroke-width="2" opacity="0.45">
      <line x1="-340" y1="0" x2="340" y2="0"/><line x1="0" y1="-340" x2="0" y2="340"/>
      <circle r="190" fill="none" stroke-dasharray="6 10"/>
    </g>
    ${dust.join('')}
    <path d="${path}" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linejoin="round" opacity="0.9"/>
    ${stars}
    <circle cx="158" cy="-150" r="104" fill="url(#gold)" mask="url(#crescent)"/>
    ${sparkle(0, 0, 62)}
    <circle r="9" fill="#FFF6DC"/>`
}

function svg(size, emblemScale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <g transform="translate(${size / 2} ${size / 2}) scale(${emblemScale})">${emblem()}</g>
</svg>`
}

async function render(file, size, emblemScale) {
  const out = path.join(outDir, file)
  await sharp(Buffer.from(svg(size, emblemScale)))
    .flatten({ background: '#000000' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out)
  const meta = await sharp(out).metadata()
  if (meta.width !== size || meta.height !== size || meta.hasAlpha) throw new Error(`${file} : ${meta.width}×${meta.height}, alpha=${meta.hasAlpha}`)
  console.log(`✓ ${path.relative(root, out)} ${size}×${size}, ${meta.channels} canaux, sans transparence`)
}

fs.mkdirSync(outDir, { recursive: true })
// Icône : emblème de rayon 400 × 1,1 = 440 px (diamètre 880 / 1024) — couronne hors des coins arrondis iOS.
await render('icon-only.png', 1024, 1.1)
// Écran de démarrage : emblème discret de 640 px au centre (zone visible sur tous les formats).
await render('splash.png', 2732, 0.8)
