import { useEffect, useRef } from 'react';
import { useApp, useRuntime } from '../state/store';

const REPO = 'https://github.com/CesarPierr/cross_paraglide_map';

export function AboutModal() {
  const { aboutOpen, set } = useApp();
  const atlas = useRuntime((r) => r.atlas);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aboutOpen && !d.open) d.showModal();
    if (!aboutOpen && d.open) d.close();
  }, [aboutOpen]);
  return (
    <dialog ref={ref} className="about panel" onClose={() => set({ aboutOpen: false })} aria-labelledby="about-title">
      <button className="close" onClick={() => set({ aboutOpen: false })} aria-label="Fermer">
        ×
      </button>
      <h2 id="about-title">Brises des Alpes — mode d’emploi</h2>
      <p className="warn">
        <b>Outil pédagogique, pas une prévision.</b> Le vent affiché est un modèle conceptuel construit à partir du relief, de la position du soleil et de
        connaissances locales publiées. Il ne remplace ni la prévision météo, ni les balises, ni l’observation sur place, ni l’avis des pilotes et moniteurs
        locaux.
      </p>
      <h3>Ce que vous voyez</h3>
      <ul>
        <li>
          <b>Particules 3D</b> : vent estimé à la hauteur choisie (au‑dessus du sol ou à altitude fixe). Elles suivent le relief, sont masquées derrière les
          montagnes et colorées par la vitesse ou par l’ascendance.
        </li>
        <li>
          <b>Brises documentées</b> (lignes animées) : brises citées par des clubs, écoles, fiches FFVL ou forums, recalées sur les fonds de vallée. Elles
          s’allument selon l’heure. Cliquez pour lire la source.
        </li>
        <li>
          <b>Convergences</b> (violet) : lignes de rencontre de brises ou de brise et vent météo, documentées ou calculées.
        </li>
        <li>
          <b>Au vent / sous le vent</b> : vert là où le vent météo est forcé de monter (soaring), rouge à l’abri d’un relief (air rabattant, rotors), orange en
          venturi.
        </li>
        <li>
          <b>Sonde</b> : cliquez n’importe où sur le relief pour décomposer le vent local (brise de pente, de vallée, brise connue, vent météo après relief).
        </li>
      </ul>
      <h3>Le modèle en bref</h3>
      <ul>
        <li>Relief : grille de ~216 m (AWS Terrain Tiles), analyse des pentes, des vallées (réseau de drainage), des lacs et de la mer.</li>
        <li>Soleil : position réelle pour la date et l’heure, ombres portées ; les pentes ensoleillées génèrent des brises montantes.</li>
        <li>Brises de vallée : montantes l’après‑midi, descendantes la nuit, plus fortes dans les grandes vallées ; remplacées localement par les brises documentées.</li>
        <li>Vent météo : freiné dans les vallées, canalisé dans l’axe, accéléré en venturi, abrité sous le vent des crêtes (indice d’abri de Winstral).</li>
        <li>Combinaison : addition vectorielle ; au‑delà de ~35 km/h de vent météo les brises sont largement écrasées, sauf au fond des vallées profondes.</li>
      </ul>
      {atlas && (
        <>
          <h3>Données de recherche</h3>
          <p>
            {atlas.stats.massifs} secteurs, {atlas.stats.breezes} brises, {atlas.stats.convergences} convergences, {atlas.stats.hazards} pièges, {atlas.stats.takeoffs}{' '}
            décollages et {atlas.stats.sources} sources citées. La collecte a été faite sans pouvoir ouvrir directement les pages des clubs : beaucoup de positions
            sont approximatives et certaines brises sont des déductions (signalées). Les contributions sont bienvenues.
          </p>
        </>
      )}
      <h3>Crédits</h3>
      <p className="small">
        Imagerie © IGN Géoplateforme, Sentinel‑2 cloudless © EOX (données Copernicus), OpenTopoMap, relief AWS Terrain Tiles (Mapzen), libellés OpenFreeMap ©
        OpenStreetMap, thermiques et skyways © thermal.kk7.ch (CC BY‑NC‑SA 4.0), prévisions Open‑Meteo.com (CC BY 4.0). Rendu MapLibre GL JS.
      </p>
      <p className="small">
        Code source, méthodologie et rapport de recherche :{' '}
        <a href={REPO} target="_blank" rel="noopener noreferrer">
          {REPO.replace('https://', '')}
        </a>
      </p>
    </dialog>
  );
}
