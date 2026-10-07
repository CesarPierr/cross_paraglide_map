/**
 * Short plain-language explanations of the phenomena shown on the map, for
 * pilots who discover them. Keyed by atlas category, breeze kind or hazard kind.
 * Sources: the training documents cited in the atlas rules (ATA « Les brises »,
 * FFVL training material, Zardi & Whiteman 2013).
 */
export const EXPLAIN: Record<string, string> = {
  // Breeze kinds
  valley: 'Brise de vallée : le jour, l’air chauffé des vallées remonte vers l’amont, de la plaine vers les sommets. Elle forcit l’après-midi et peut rendre les atterrissages turbulents.',
  downvalley: 'Brise descendante : le soir et la nuit, l’air refroidi s’écoule vers l’aval. Elle s’installe après le coucher du soleil et dure jusqu’au matin.',
  slope: 'Brise de pente : une pente au soleil chauffe l’air qui la longe et le fait monter vers la crête. C’est elle qui porte au décollage et alimente les thermiques.',
  katabatic: 'Écoulement catabatique : air froid qui dévale les pentes à l’ombre ou la nuit, en couche mince près du sol.',
  'plain-to-mountain': 'Aspiration de la plaine vers la montagne : à grande échelle, le massif chauffé aspire l’air des plaines voisines l’après-midi.',
  lake: 'Brise de lac : le jour, l’air frais du lac part vers les rives chaudes ; elle peut se heurter à la brise de pente et créer une convergence.',
  'pass-transfer': 'Transfert par un col : la brise d’une vallée déborde par un col vers la vallée voisine, avec souvent un effet venturi au passage.',
  regional: 'Brise régionale : écoulement d’échelle régionale (brise de mer, flux entre massifs) qui s’ajoute aux brises locales.',
  // Categories
  convergences: 'Convergence : ligne où deux masses d’air se rencontrent. L’air n’a pas d’autre choix que de monter : ascendances larges, souvent marquées par un alignement de cumulus, mais risque de surdéveloppement.',
  thermals: 'Thermique : colonne d’air chaud qui se détache d’une surface bien chauffée (barre rocheuse, éperon, village). Les pilotes y enroulent pour prendre de la hauteur ; un point de relance est un thermique fiable qui permet de repartir.',
  soaring: 'Soaring : vol dans l’air soulevé par le vent qui frappe une pente (vol dynamique), sans avoir besoin de thermique.',
  hazards: 'Piège : endroit ou situation où l’air devient dangereux ou trompeur (venturi, rotor sous le vent, brise forte à l’atterrissage, descendances).',
  routes: 'Itinéraire de cross : enchaînement de points de passage réellement volés, avec les transitions et les relances qui les rendent possibles.',
  takeoffs: 'Décollage : lieu de décollage cité par les sources. Vérifiez toujours la fiche FFVL, l’orientation et les consignes locales.',
  landings: 'Atterrissage : terrain cité par les sources. Repérez-le avant de voler ; la brise de vallée y souffle souvent fort l’après-midi.',
  // Hazard kinds
  venturi: 'Venturi : le vent accélère en passant dans un rétrécissement (col, cluse, entre deux reliefs). On peut ne plus avancer.',
  'lee-rotor': 'Rotor sous le vent : derrière un relief, le vent forme des tourbillons violents et des descendances. À éviter absolument.',
  'strong-breeze': 'Brise forte : la brise de vallée devient assez forte pour gêner l’atterrissage ou le décollage, surtout l’après-midi.',
  downdraft: 'Descendance : zone où l’air descend (souvent à l’ombre, sous le vent ou à côté d’un thermique) : on y perd vite de la hauteur.',
  foehn: 'Foehn : vent chaud et sec qui dévale le versant sous le vent d’une chaîne ; turbulences fortes et rafales.',
  'landing-turbulence': 'Turbulence à l’atterrissage : brise forte, rotors d’obstacles ou cisaillement près du sol.',
  overdevelopment: 'Surdéveloppement : les cumulus grossissent jusqu’à l’orage ; aspiration sous le nuage, rafales et pluie.',
  airspace: 'Espace aérien : zone réglementée (contrôlée, interdite, protection de la faune) avec des limites de hauteur à respecter.',
};

export type Level = 'decouverte' | 'pilote' | 'expert';

export const LEVELS: { key: Level; label: string; hint: string }[] = [
  { key: 'decouverte', label: 'Je débute', hint: 'Explications des phénomènes, l’essentiel d’abord.' },
  { key: 'pilote', label: 'Je vole régulièrement', hint: 'Brises, thermiques, pièges et sites.' },
  { key: 'expert', label: 'Je fais du cross', hint: 'Tout le détail : itinéraires, transitions, espaces aériens.' },
];
