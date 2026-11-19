/**
 * Conseils d'observation rédigés par type d'objet et par instrument
 * (pratique visuelle standard : grossissement, filtres, vision décalée).
 */
import type { DeepSkyType } from '../../types/catalog'
import type { InstrumentId } from '../../types/tonight'

export const TYPE_TIPS: Readonly<Record<DeepSkyType, Readonly<Record<InstrumentId, string>>>> = {
  galaxy: {
    'naked-eye': 'Cherchez une tache ovale très diffuse en vision décalée, loin de toute pollution lumineuse.',
    binoculars: 'Le noyau apparaît comme une lueur ovale ; calez les jumelles pour gagner en stabilité.',
    telescope: 'Grossissement modéré, ciel sans Lune : bandes de poussière et bras spiraux sur les plus brillantes.',
  },
  'emission-nebula': {
    'naked-eye': 'Visible seulement sous un ciel très noir, comme une brume parmi les étoiles.',
    binoculars: 'Un filtre UHC tenu devant un oculaire renforce nettement le contraste.',
    telescope: 'Faible grossissement et filtre UHC ou OIII : les volutes de gaz se détachent du fond.',
  },
  'reflection-nebula': {
    'naked-eye': 'Hors de portée de l’œil nu, hormis la lueur entourant les étoiles les plus vives.',
    binoculars: 'Halo bleuté autour des étoiles : nettoyez bien les optiques pour éviter les reflets.',
    telescope: 'Pas de filtre nébulaire (lumière stellaire réfléchie) : misez sur un ciel transparent.',
  },
  'dark-nebula': {
    'naked-eye': 'Repérable en creux, comme une absence d’étoiles sur un fond de Voie lactée.',
    binoculars: 'Balayez lentement : la nébuleuse se révèle par contraste avec le champ étoilé.',
    telescope: 'Champ large et filtre Hβ pour faire ressortir la nébulosité d’arrière-plan.',
  },
  'cluster-nebula': {
    'naked-eye': 'Une petite tache laiteuse ponctuée d’étoiles sous un ciel noir.',
    binoculars: 'Les étoiles de l’amas se détachent ; la nébulosité reste ténue.',
    telescope: 'Faible grossissement avec filtre UHC pour la nébuleuse, puis montez pour l’amas central.',
  },
  'planetary-nebula': {
    'naked-eye': 'Trop petite et trop faible pour l’œil nu.',
    binoculars: 'Apparaît stellaire : comparez avec les étoiles voisines pour l’identifier.',
    telescope: 'Fort grossissement et filtre OIII : disque, anneau et parfois étoile centrale.',
  },
  'open-cluster': {
    'naked-eye': 'Groupe d’étoiles ou tache granuleuse selon l’éclat et la distance.',
    binoculars: 'Instrument idéal : l’amas entier tient dans le champ, étoiles bien séparées.',
    telescope: 'Faible grossissement pour cadrer tout l’amas avec un fond de ciel autour.',
  },
  'globular-cluster': {
    'naked-eye': 'Ressemble à une étoile floue pour les plus brillants.',
    binoculars: 'Boule de lumière concentrée, non résolue en étoiles.',
    telescope: 'Grossissement élevé (150× et plus) pour résoudre la périphérie en étoiles.',
  },
  'supernova-remnant': {
    'naked-eye': 'Invisible à l’œil nu.',
    binoculars: 'Seuls les filaments les plus brillants, avec un filtre OIII devant l’oculaire.',
    telescope: 'Filtre OIII indispensable, faible grossissement : suivez les filaments un à un.',
  },
  'star-cloud': {
    'naked-eye': 'Une condensation brillante de la Voie lactée, spectaculaire par ciel noir.',
    binoculars: 'Des milliers d’étoiles dans le champ : balayez lentement.',
    telescope: 'Le plus faible grossissement possible ; l’objet dépasse largement le champ.',
  },
  'double-star': {
    'naked-eye': 'Une seule étoile à l’œil nu.',
    binoculars: 'Les composantes se séparent si l’écart dépasse une minute d’arc environ.',
    telescope: 'Grossissement élevé et bonne turbulence : contraste de couleurs entre composantes.',
  },
  asterism: {
    'naked-eye': 'Repérez la figure formée par les étoiles les plus brillantes.',
    binoculars: 'La figure apparaît en entier dans le champ.',
    telescope: 'Faible grossissement pour conserver la forme du groupement.',
  },
}

/** Grossissements conseillés au télescope par type (avant ajustement à la taille). */
export const TELESCOPE_MAGNIFICATION: Readonly<Record<DeepSkyType, readonly [number, number]>> = {
  galaxy: [60, 150],
  'emission-nebula': [30, 90],
  'reflection-nebula': [40, 100],
  'dark-nebula': [25, 60],
  'cluster-nebula': [30, 100],
  'planetary-nebula': [150, 300],
  'open-cluster': [30, 100],
  'globular-cluster': [120, 250],
  'supernova-remnant': [30, 80],
  'star-cloud': [20, 40],
  'double-star': [100, 250],
  asterism: [25, 60],
}
