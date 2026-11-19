/**
 * Simulateur interactif d'oculaire et de cadrage astrophotographique :
 * vue Canvas 2D à l'échelle exacte (champ réel ou champ capteur), objet
 * sélectionné et voisins réels, grandeurs optiques calculées en direct.
 */
import { AlertTriangle, Camera, Eye } from 'lucide-react'
import { useMemo } from 'react'
import { useTheme } from '../../../hooks/useAppContext'
import { useHiDpiCanvas } from '../../../hooks/useHiDpiCanvas'
import { usePersistedState } from '../../../hooks/usePersistedState'
import { getDeepSkyEntries } from '../../../services/catalog/entries'
import { fieldNeighbors } from '../../../services/optics/fieldProjection'
import { FOV_WARNING_FR, FRAMING_LABEL_FR, computePhotoFov, computeVisualFov, framingFit, viewSpanArcmin } from '../../../services/optics/fov'
import { DEFAULT_FOV_SETTINGS, loadFovSettings, saveFovSettings } from '../../../services/optics/fovSettings'
import { Card, Readout } from '../../ui/Card'
import { Segmented } from '../../ui/Controls'
import { fmtNumber } from '../../ui/format'
import { FovControls } from './FovControls'
import { drawFovScene, fmtArcmin, type FovMain, type FovScene } from './fovDraw'

export interface FovTarget {
  readonly code: string
  readonly raDeg: number
  readonly decDeg: number
  readonly main: FovMain
  /** Plus grande dimension apparente, en minutes d'arc (`null` : ponctuel). */
  readonly majorArcmin: number | null
  /** Identifiant catalogue à exclure des voisins (l'objet lui-même). */
  readonly excludeId: string | null
}

/** « 4,30 × 2,87° » ou « 41,2 × 27,5′ » (unité unique, compact). */
const fmtFrame = (wDeg: number, hDeg: number) =>
  wDeg >= 1 ? `${fmtNumber(wDeg, 2)} × ${fmtNumber(hDeg, 2)}°` : `${fmtNumber(wDeg * 60, 1)} × ${fmtNumber(hDeg * 60, 1)}′`
const fmtDegField = (deg: number) => (deg >= 1 ? `${fmtNumber(deg, 2)}°` : `${fmtNumber(deg * 60, 1)}′`)

export function FovSimulator({ target }: { target: FovTarget }) {
  const { palette: p } = useTheme()
  const [settings, setSettings] = usePersistedState(DEFAULT_FOV_SETTINGS, loadFovSettings, saveFovSettings)
  const visual = computeVisualFov(settings.telescope, settings.eyepiece, settings.barlow)
  const photo = computePhotoFov(settings.telescope, settings.sensor)
  const isVisual = settings.mode === 'visual'

  const field: FovScene['field'] = isVisual
    ? { kind: 'circle', diameterArcmin: visual.trueFieldDeg * 60 }
    : { kind: 'rect', widthArcmin: photo.widthDeg * 60, heightArcmin: photo.heightDeg * 60, rotationDeg: settings.sensorRotationDeg }
  const fieldMax = field.kind === 'circle' ? field.diameterArcmin : Math.hypot(field.widthArcmin, field.heightArcmin)
  const fieldMin = field.kind === 'circle' ? field.diameterArcmin : Math.min(field.widthArcmin, field.heightArcmin)
  const span = viewSpanArcmin(fieldMax, target.majorArcmin)
  const fit = framingFit(target.majorArcmin, fieldMin)

  const { raDeg, decDeg, excludeId } = target
  const spanKey = Math.round(span * 10)
  const neighbors = useMemo(
    () => fieldNeighbors(raDeg, decDeg, (spanKey / 10) * 0.75, getDeepSkyEntries(), excludeId),
    [raDeg, decDeg, excludeId, spanKey],
  )
  const scene: FovScene = { spanArcmin: span, field, orientation: isVisual ? settings.orientation : 'sky', main: target.main, neighbors }

  const ref = useHiDpiCanvas((ctx, { width, height }) => drawFovScene(ctx, width, height, scene, p.fov, p.background), [
    JSON.stringify(field), span, scene.orientation, target, neighbors, p,
  ])

  const fieldText = isVisual ? fmtDegField(visual.trueFieldDeg) : `${fmtDegField(photo.widthDeg)} × ${fmtDegField(photo.heightDeg)}`

  return (
    <Card title="Simulateur de champ" icon={isVisual ? <Eye size={14} /> : <Camera size={14} />}>
      <Segmented
        label="Mode du simulateur"
        value={settings.mode}
        onChange={(mode) => setSettings({ ...settings, mode })}
        options={[{ id: 'visual', label: 'Visuel · oculaire' }, { id: 'photo', label: 'Photo · capteur' }]}
        className="mb-3"
      />
      <div className="relative -mx-4 border-y border-hairline">
        <canvas
          ref={ref}
          role="img"
          aria-label={`Simulation du champ : ${target.code} dans un champ de ${fieldText}`}
          className="block aspect-square w-full"
        />
        <div className="pointer-events-none absolute top-2 left-3 text-[11px] font-semibold text-secondary tabular-nums">
          {target.code} · champ {fieldText}
        </div>
      </div>

      {isVisual ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Readout label="Gross." value={`${fmtNumber(visual.magnification, 0)}×`} />
          <Readout label="Pupille" value={fmtNumber(visual.exitPupilMm, 1)} unit="mm" />
          <Readout label="Champ réel" value={fmtDegField(visual.trueFieldDeg)} />
          <Readout label="F/D" value={fmtNumber(visual.focalRatio, 1)} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1.7fr_1fr_0.7fr] gap-2">
          <Readout label="Champ" value={fmtFrame(photo.widthDeg, photo.heightDeg)} />
          <Readout label="Diagonale" value={fmtDegField(photo.diagonalDeg)} />
          <Readout label="F/D" value={fmtNumber(photo.focalRatio, 1)} />
        </div>
      )}
      <p className="mt-2 text-[12px] text-secondary tabular-nums">
        {fit ? `${FRAMING_LABEL_FR[fit.verdict]} — ${target.code} (${fmtArcmin(target.majorArcmin!)}) occupe ${fit.ratio < 0.01 ? 'moins de 1' : fmtNumber(fit.ratio * 100, 0)} % du ${isVisual ? 'champ' : 'petit côté'}.` : `${target.code} est ponctuel à cette échelle.`}
        {isVisual && ` Plage utile : ${fmtNumber(visual.minUsefulMagnification, 0)}× à ${fmtNumber(visual.maxUsefulMagnification, 0)}×.`}
      </p>
      {isVisual && visual.warnings.map((w) => (
        <p key={w} className="mt-1 flex items-start gap-1.5 text-[12px] text-fair" role="note">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> {FOV_WARNING_FR[w]}
        </p>
      ))}
      <div className="mt-4">
        <FovControls settings={settings} onChange={setSettings} />
      </div>
    </Card>
  )
}
