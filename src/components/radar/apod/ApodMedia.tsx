/**
 * Média de l'APOD : image (visionneuse plein écran en haute définition),
 * vidéo YouTube (miniature haute résolution + badge de lecture ouvrant la vidéo),
 * vidéo native ou autre intégration, ou bandeau compact si aucun média n'existe.
 * En red-night, le filtre SVG global réduit chaque pixel au seul canal rouge.
 */
import { ExternalLink, ImageOff, Maximize2, Play, X } from 'lucide-react'
import { useState } from 'react'
import { isEmbeddedVideo } from '../../../services/space/apod'
import { APOD_SITE_URL, youtubeId } from '../../../services/space/apodSources'
import type { ApodEntry } from '../../../types/space'

function MissingMedia({ placeholder }: { placeholder: boolean }) {
  return (
    <div className="flex h-24 items-center gap-3 rounded-[22px] bg-soft px-4" role="note">
      <ImageOff size={22} className="shrink-0 text-tertiary" aria-hidden />
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-secondary">
        {placeholder ? 'Média du jour non publié par la NASA pour cette date.' : 'Média indisponible (hors-ligne ou source inaccessible).'}
      </p>
      <a href={APOD_SITE_URL} target="_blank" rel="noreferrer" aria-label="Ouvrir le site officiel APOD" className="flex size-11 shrink-0 items-center justify-center text-accent">
        <ExternalLink size={18} aria-hidden />
      </a>
    </div>
  )
}

export function ApodMedia({ entry }: { entry: ApodEntry }) {
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const [viewer, setViewer] = useState(false)
  const src = entry.url

  if (entry.placeholderMedia || !src || failed === src) return <MissingMedia placeholder={entry.placeholderMedia || !src} />

  if (entry.mediaType === 'video') {
    const yt = youtubeId(src)
    if (yt && entry.thumbnailUrl && failed !== entry.thumbnailUrl) {
      return (
        <figure className="relative overflow-hidden rounded-[22px] bg-soft">
          <img src={entry.thumbnailUrl} alt={entry.title} decoding="async" onError={() => setFailed(entry.thumbnailUrl)} className="block aspect-video w-full object-cover" />
          <a
            href={`https://www.youtube.com/watch?v=${yt}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Lire la vidéo : ${entry.title}`}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-bg-primary/70 text-primary backdrop-blur-md">
              <Play size={28} className="translate-x-0.5" fill="currentColor" aria-hidden />
            </span>
          </a>
        </figure>
      )
    }
    return isEmbeddedVideo(src) ? (
      <iframe
        src={src}
        title={`Vidéo : ${entry.title}`}
        className="aspect-video w-full rounded-[22px] bg-soft"
        allow="encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    ) : (
      <video src={src} poster={entry.thumbnailUrl ?? undefined} controls playsInline className="aspect-video w-full rounded-[22px] bg-soft" onError={() => setFailed(src)} />
    )
  }

  return (
    <>
      <figure className="relative overflow-hidden rounded-[22px] bg-soft">
        {loaded !== src && <div className="absolute inset-0 animate-pulse bg-softer" aria-hidden />}
        <img
          src={src}
          alt={entry.title}
          decoding="async"
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          className="block max-h-[60vh] min-h-48 w-full object-contain"
        />
        <button
          type="button"
          onClick={() => setViewer(true)}
          aria-label="Afficher en haute définition"
          className="absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full bg-bg-primary/70 text-primary backdrop-blur"
        >
          <Maximize2 size={16} />
        </button>
      </figure>
      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary" role="dialog" aria-modal="true" aria-label={`${entry.title} en haute définition`}>
          <img src={entry.hdUrl ?? src} alt={entry.title} className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={() => setViewer(false)}
            aria-label="Fermer la haute définition"
            className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full bg-bg-primary/70 text-primary"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
