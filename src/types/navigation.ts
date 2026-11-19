/** Onglets de l'application et demandes de navigation inter-onglets. */

export type TabId = 'tonight' | 'sky' | 'system' | 'catalog' | 'satellites'

export const TAB_IDS: readonly TabId[] = ['tonight', 'sky', 'system', 'catalog', 'satellites']

/** Demande de verrouillage d'une cible (Catalogue) ou de guidage (Ciel). */
export interface CatalogFocus {
  /** Clé de l'objet (`"M31"`, `"NGC869"`, `"HIP32349"`, `"Jupiter"`, `"Moon"`). */
  readonly key: string
  /** Jeton unique : deux demandes successives sur la même cible restent distinctes. */
  readonly nonce: number
}
