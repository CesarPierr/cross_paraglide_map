import { useEffect, useRef } from 'react';
import { useApp, useRuntime } from '../state/store';
import { IconClose } from './icons';

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
        <IconClose size={18} />
      </button>
      <h2 id="about-title">Brises des Alpes</h2>
      <p className="lead">Explorer comment le relief, le soleil et le vent météo dessinent les brises, les convergences et les zones porteuses des Alpes françaises.</p>
      <p className="note">
        <b>Outil pédagogique, pas une prévision.</b> Le vent affiché vient d’un modèle conceptuel (relief, soleil, connaissances locales publiées). Il ne remplace ni la
        prévision, ni les balises, ni l’observation sur place, ni l’avis des pilotes et moniteurs locaux.
      </p>
      <div className="about-grid">
        <section>
          <h3>Lire la carte</h3>
          <ul>
            <li>
              <b>Particules</b> : vent simulé à la hauteur choisie, masqué derrière les reliefs.
            </li>
            <li>
              <b>Flux colorés</b> : brises citées par des clubs, écoles, fiches FFVL ou forums (pointillés = déduction).
            </li>
            <li>
              <b>Bulles orange</b> : thermiques probables à l’heure choisie (modèle et spots connus).
            </li>
            <li>
              <b>Violet</b> : convergences, là où les brises se rencontrent et l’air monte.
            </li>
            <li>
              <b>Clic sur le relief</b> : décomposition du vent local et prévision du jour au point.
            </li>
          </ul>
        </section>
        <section>
          <h3>Raccourcis</h3>
          <ul className="keys">
            <li>
              <kbd>Espace</kbd> animer la journée
            </li>
            <li>
              <kbd>Maj</kbd>+<kbd>←</kbd>/<kbd>→</kbd> ±15 min
            </li>
            <li>
              <kbd>Ctrl</kbd>+glisser : orienter la vue 3D
            </li>
            <li>
              <kbd>Échap</kbd> fermer la fiche
            </li>
          </ul>
        </section>
      </div>
      <h3>Le modèle en bref</h3>
      <ul>
        <li>Relief à ~216 m (AWS Terrain Tiles) : pentes, réseau de vallées, lacs, mer.</li>
        <li>Soleil réel à la date et l’heure, ombres portées : les pentes ensoleillées génèrent des brises montantes.</li>
        <li>Brises de vallée montantes l’après‑midi, descendantes la nuit, remplacées localement par les brises documentées.</li>
        <li>Vent météo freiné en vallée, canalisé dans l’axe, accéléré en venturi, abrité sous le vent des crêtes.</li>
        <li>Calcul sur la carte graphique : les réglages s’appliquent en direct.</li>
      </ul>
      {atlas && (
        <>
          <h3>Données</h3>
          <p>
            {atlas.stats.massifs} secteurs, {atlas.stats.breezes} brises, {atlas.stats.convergences} convergences, {atlas.stats.hazards} pièges et {atlas.stats.sources} sources.
            Chaque élément affiche ses sources et peut être confirmé, contesté ou corrigé : vos retours enrichissent la base.
          </p>
        </>
      )}
      <h3>Crédits</h3>
      <p className="small muted">
        Imagerie © IGN Géoplateforme, Sentinel‑2 cloudless © EOX (Copernicus), OpenTopoMap · relief AWS Terrain Tiles (Mapzen) · libellés OpenFreeMap © OpenStreetMap · sites
        FFVL (data.gouv.fr), OpenStreetMap, ParaglidingEarth · espaces aériens FFVP planeur‑net (non officiel) · thermiques et skyways © thermal.kk7.ch (CC BY‑NC‑SA 4.0) ·
        prévisions Open‑Meteo.com (CC BY 4.0) · rendu MapLibre GL JS.
      </p>
      <p className="small">
        <a href={REPO} target="_blank" rel="noopener noreferrer">
          Code source, méthodologie et rapport de recherche
        </a>
      </p>
    </dialog>
  );
}
