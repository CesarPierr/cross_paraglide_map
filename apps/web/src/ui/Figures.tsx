import type { Atlas, AtlasFigure } from '@brises/shared';
import { useEffect, useState } from 'react';
import { useRuntime } from '../state/store';
import { getController } from './controller-ref';

function openFeature(id: string) {
  const c = getController();
  const d = c?.describe(`atlas:${id}`);
  if (!d) return;
  useRuntime.getState().set({ feature: d });
  c?.flyToBbox(d.bbox);
}

const pageLink = (f: AtlasFigure) => (f.pdfPage && /\.pdf($|\?)/i.test(f.pageUrl) ? `${f.pageUrl}#page=${f.pdfPage}` : f.pageUrl);

function Lightbox({ fig, atlas, onClose }: { fig: AtlasFigure; atlas: Atlas; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const names = new Map(Object.values(atlas.features).flatMap((list) => list.map((f) => [f.properties.id, f.properties.name] as const)));
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={fig.title} onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        {fig.imageUrl ? <img src={fig.imageUrl} alt={fig.title} referrerPolicy="no-referrer" /> : <div className="lightbox-noimg">Figure dans un document : ouvrez l’original.</div>}
        <figcaption>
          <b>{fig.title}</b>
          {fig.publisher && <span className="muted"> · {fig.publisher}</span>}
          <p>{fig.shows}</p>
          {fig.features.length > 0 && (
            <div className="chips">
              {fig.features.map((id) => (
                <button
                  key={id}
                  className="chip"
                  onClick={() => {
                    onClose();
                    openFeature(id);
                  }}
                >
                  {names.get(id) ?? id}
                </button>
              ))}
            </div>
          )}
          <a className="btn small" href={pageLink(fig)} target="_blank" rel="noopener noreferrer">
            Ouvrir l’original{fig.pdfPage ? ` (page ${fig.pdfPage})` : ''}
          </a>
          <button className="btn ghost small" onClick={onClose}>
            Fermer
          </button>
        </figcaption>
      </figure>
    </div>
  );
}

/** Annotated drawings from clubs and federations: thumbnails linked to the original, never re-hosted. */
export function FigureGallery({ atlas, massif, featureId, title = 'Schémas et cartes des clubs' }: { atlas: Atlas; massif?: string; featureId?: string; title?: string }) {
  const [open, setOpen] = useState<AtlasFigure | null>(null);
  const figs = (atlas.figures ?? []).filter((f) => (massif ? f.massif === massif : true) && (featureId ? f.features.includes(featureId) : true));
  if (!figs.length) return null;
  return (
    <section className="item-section">
      <h3>
        {title} <span className="count">{figs.length}</span>
      </h3>
      <div className="figures">
        {figs.map((f) => (
          <button key={f.id} className="figure-card" onClick={() => setOpen(f)} title={f.shows}>
            {f.imageUrl ? <img src={f.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="figure-doc">PDF{f.pdfPage ? ` p. ${f.pdfPage}` : ''}</span>}
            <span className="figure-title">{f.title}</span>
            {f.publisher && <span className="figure-pub">{f.publisher}</span>}
          </button>
        ))}
      </div>
      {open && <Lightbox fig={open} atlas={atlas} onClose={() => setOpen(null)} />}
    </section>
  );
}
