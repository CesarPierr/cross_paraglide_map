/** French labels of the domain vocabulary, shared by map modules and UI. */
export const CATEGORY_LABELS: Record<string, string> = {
  breezes: 'Brise',
  convergences: 'Convergence',
  hazards: 'Piège / danger',
  thermals: 'Thermique connu',
  soaring: 'Soaring',
  takeoffs: 'Décollage',
  landings: 'Atterrissage',
  routes: 'Itinéraire cross',
};

export const KIND_LABELS: Record<string, string> = {
  valley: 'Brise de vallée',
  downvalley: 'Brise descendante',
  slope: 'Brise de pente',
  'plain-to-mountain': 'Aspiration plaine → montagne',
  lake: 'Brise de lac',
  'pass-transfer': 'Transfert par un col',
  regional: 'Flux régional',
  katabatic: 'Vent catabatique',
  venturi: 'Venturi',
  'lee-rotor': 'Sous le vent / rotors',
  'strong-breeze': 'Brise forte',
  downdraft: 'Dégueulante',
  foehn: 'Foehn',
  'landing-turbulence': 'Atterrissage turbulent',
  airspace: 'Espace aérien',
  overdevelopment: 'Surdéveloppement',
  other: 'Autre',
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'fiabilité élevée',
  medium: 'fiabilité moyenne',
  low: 'fiabilité faible / déduction',
};
