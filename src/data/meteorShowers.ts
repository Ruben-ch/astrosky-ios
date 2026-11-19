/**
 * Essaims météoritiques annuels — liste de travail de l'International Meteor
 * Organization (IMO Meteor Shower Calendar). Longitudes solaires du maximum
 * rapportées à l'équinoxe J2000, radiants J2000 au maximum.
 */
import type { MeteorShower } from '../types/catalog'

export const METEOR_SHOWERS: readonly MeteorShower[] = [
  { code: 'QUA', name: 'Quadrantides', activeFrom: [12, 28], activeTo: [1, 12], peakSolarLongitudeDeg: 283.15, radiantRaDeg: 230, radiantDecDeg: 49, zhr: 80, velocityKmS: 41, populationIndex: 2.1, parentBody: '2003 EH1', variable: false },
  { code: 'ACE', name: 'α-Centaurides', activeFrom: [1, 31], activeTo: [2, 20], peakSolarLongitudeDeg: 319.2, radiantRaDeg: 210, radiantDecDeg: -59, zhr: 6, velocityKmS: 58, populationIndex: 2.0, parentBody: 'Inconnu', variable: true },
  { code: 'GNO', name: 'γ-Normides', activeFrom: [2, 25], activeTo: [3, 28], peakSolarLongitudeDeg: 354, radiantRaDeg: 239, radiantDecDeg: -50, zhr: 6, velocityKmS: 56, populationIndex: 2.4, parentBody: 'Inconnu', variable: false },
  { code: 'LYR', name: 'Lyrides', activeFrom: [4, 14], activeTo: [4, 30], peakSolarLongitudeDeg: 32.32, radiantRaDeg: 271, radiantDecDeg: 34, zhr: 18, velocityKmS: 49, populationIndex: 2.1, parentBody: 'C/1861 G1 (Thatcher)', variable: true },
  { code: 'ETA', name: 'η-Aquarides', activeFrom: [4, 19], activeTo: [5, 28], peakSolarLongitudeDeg: 45.5, radiantRaDeg: 338, radiantDecDeg: -1, zhr: 50, velocityKmS: 66, populationIndex: 2.4, parentBody: '1P/Halley', variable: false },
  { code: 'ELY', name: 'η-Lyrides', activeFrom: [5, 3], activeTo: [5, 14], peakSolarLongitudeDeg: 50.0, radiantRaDeg: 287, radiantDecDeg: 44, zhr: 3, velocityKmS: 43, populationIndex: 3.0, parentBody: 'C/1983 H1 (IRAS-Araki-Alcock)', variable: false },
  { code: 'JBO', name: 'Bootides de juin', activeFrom: [6, 22], activeTo: [7, 2], peakSolarLongitudeDeg: 95.7, radiantRaDeg: 224, radiantDecDeg: 48, zhr: 1, velocityKmS: 18, populationIndex: 2.2, parentBody: '7P/Pons-Winnecke', variable: true },
  { code: 'PAU', name: 'Piscis Austrinides', activeFrom: [7, 15], activeTo: [8, 10], peakSolarLongitudeDeg: 125, radiantRaDeg: 341, radiantDecDeg: -30, zhr: 5, velocityKmS: 35, populationIndex: 3.2, parentBody: 'Inconnu', variable: false },
  { code: 'SDA', name: 'δ-Aquarides du Sud', activeFrom: [7, 12], activeTo: [8, 23], peakSolarLongitudeDeg: 127, radiantRaDeg: 340, radiantDecDeg: -16, zhr: 25, velocityKmS: 41, populationIndex: 2.5, parentBody: '96P/Machholz (probable)', variable: false },
  { code: 'CAP', name: 'α-Capricornides', activeFrom: [7, 3], activeTo: [8, 15], peakSolarLongitudeDeg: 127, radiantRaDeg: 307, radiantDecDeg: -10, zhr: 5, velocityKmS: 23, populationIndex: 2.5, parentBody: '169P/NEAT', variable: false },
  { code: 'PER', name: 'Perséides', activeFrom: [7, 17], activeTo: [8, 24], peakSolarLongitudeDeg: 140.0, radiantRaDeg: 48, radiantDecDeg: 58, zhr: 100, velocityKmS: 59, populationIndex: 2.2, parentBody: '109P/Swift-Tuttle', variable: false },
  { code: 'KCG', name: 'κ-Cygnides', activeFrom: [8, 3], activeTo: [8, 25], peakSolarLongitudeDeg: 145, radiantRaDeg: 286, radiantDecDeg: 59, zhr: 3, velocityKmS: 25, populationIndex: 3.0, parentBody: '2008 ED69 (probable)', variable: true },
  { code: 'AUR', name: 'Aurigides', activeFrom: [8, 28], activeTo: [9, 5], peakSolarLongitudeDeg: 158.6, radiantRaDeg: 91, radiantDecDeg: 39, zhr: 6, velocityKmS: 66, populationIndex: 2.5, parentBody: 'C/1911 N1 (Kiess)', variable: true },
  { code: 'SPE', name: 'ε-Perséides de septembre', activeFrom: [9, 5], activeTo: [9, 21], peakSolarLongitudeDeg: 166.7, radiantRaDeg: 48, radiantDecDeg: 40, zhr: 5, velocityKmS: 64, populationIndex: 3.0, parentBody: 'Inconnu', variable: true },
  { code: 'DRA', name: 'Draconides', activeFrom: [10, 6], activeTo: [10, 10], peakSolarLongitudeDeg: 195.4, radiantRaDeg: 262, radiantDecDeg: 54, zhr: 10, velocityKmS: 20, populationIndex: 2.6, parentBody: '21P/Giacobini-Zinner', variable: true },
  { code: 'STA', name: 'Taurides du Sud', activeFrom: [9, 10], activeTo: [11, 20], peakSolarLongitudeDeg: 197, radiantRaDeg: 32, radiantDecDeg: 9, zhr: 5, velocityKmS: 27, populationIndex: 2.3, parentBody: '2P/Encke', variable: false },
  { code: 'ORI', name: 'Orionides', activeFrom: [10, 2], activeTo: [11, 7], peakSolarLongitudeDeg: 208, radiantRaDeg: 95, radiantDecDeg: 16, zhr: 20, velocityKmS: 66, populationIndex: 2.5, parentBody: '1P/Halley', variable: false },
  { code: 'NTA', name: 'Taurides du Nord', activeFrom: [10, 20], activeTo: [12, 10], peakSolarLongitudeDeg: 230, radiantRaDeg: 58, radiantDecDeg: 22, zhr: 5, velocityKmS: 29, populationIndex: 2.3, parentBody: '2P/Encke', variable: false },
  { code: 'LEO', name: 'Léonides', activeFrom: [11, 6], activeTo: [11, 30], peakSolarLongitudeDeg: 235.27, radiantRaDeg: 152, radiantDecDeg: 22, zhr: 15, velocityKmS: 71, populationIndex: 2.5, parentBody: '55P/Tempel-Tuttle', variable: true },
  { code: 'AMO', name: 'α-Monocérotides', activeFrom: [11, 15], activeTo: [11, 25], peakSolarLongitudeDeg: 239.32, radiantRaDeg: 117, radiantDecDeg: 1, zhr: 5, velocityKmS: 65, populationIndex: 2.4, parentBody: 'Inconnu', variable: true },
  { code: 'PHO', name: 'Phœnicides', activeFrom: [11, 28], activeTo: [12, 9], peakSolarLongitudeDeg: 250.0, radiantRaDeg: 18, radiantDecDeg: -53, zhr: 3, velocityKmS: 18, populationIndex: 2.8, parentBody: '289P/Blanpain', variable: true },
  { code: 'PUP', name: 'Puppides-Vélides', activeFrom: [12, 1], activeTo: [12, 15], peakSolarLongitudeDeg: 255, radiantRaDeg: 123, radiantDecDeg: -45, zhr: 10, velocityKmS: 40, populationIndex: 2.9, parentBody: 'Inconnu', variable: false },
  { code: 'GEM', name: 'Géminides', activeFrom: [12, 4], activeTo: [12, 20], peakSolarLongitudeDeg: 262.2, radiantRaDeg: 112, radiantDecDeg: 33, zhr: 150, velocityKmS: 35, populationIndex: 2.6, parentBody: '(3200) Phaéton', variable: false },
  { code: 'HYD', name: 'σ-Hydrides', activeFrom: [12, 3], activeTo: [12, 20], peakSolarLongitudeDeg: 265.5, radiantRaDeg: 125, radiantDecDeg: 2, zhr: 7, velocityKmS: 58, populationIndex: 3.0, parentBody: 'Inconnu', variable: false },
  { code: 'DLM', name: 'Léo-Minorides de décembre', activeFrom: [12, 5], activeTo: [2, 4], peakSolarLongitudeDeg: 268, radiantRaDeg: 162, radiantDecDeg: 32, zhr: 5, velocityKmS: 64, populationIndex: 3.0, parentBody: 'Inconnu', variable: false },
  { code: 'URS', name: 'Ursides', activeFrom: [12, 17], activeTo: [12, 26], peakSolarLongitudeDeg: 270.7, radiantRaDeg: 217, radiantDecDeg: 76, zhr: 10, velocityKmS: 33, populationIndex: 3.0, parentBody: '8P/Tuttle', variable: true },
]
