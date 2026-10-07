/**
 * Source display: compact numbered list (domain, title, publisher, link) and
 * inline citations that point into it. Unobtrusive by default, one click away
 * from the original resource.
 */
import type { Atlas, AtlasSource } from '@brises/shared';
import { useState } from 'react';
import { IconExternal } from './icons';

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  web: 'Web',
  forum: 'Forum',
  video: 'Vidéo',
  book: 'Livre',
  presentation: 'Présentation',
};

export function domainOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function SourceList({ ids, atlas, limit = 4, title = 'Sources' }: { ids: string[]; atlas: Atlas; limit?: number; title?: string }) {
  const [all, setAll] = useState(false);
  const list = ids.map((id) => atlas.sources[id]).filter((s): s is AtlasSource => !!s);
  if (!list.length)
    return (
      <section className="sources-block">
        <h3>{title}</h3>
        <p className="muted small">Aucune source citée : élément déduit, à confirmer par les pilotes locaux.</p>
      </section>
    );
  const shown = all ? list : list.slice(0, limit);
  return (
    <section className="sources-block" aria-label={title}>
      <h3>
        {title} <span className="count">{list.length}</span>
      </h3>
      <ol className="sources">
        {shown.map((s, i) => {
          const domain = domainOf(s.url);
          return (
            <li key={s.id} id={`src-${s.id}`}>
              <span className="src-num">{i + 1}</span>
              <div className="src-body">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="src-title" title={s.notes ?? s.title}>
                    {s.title}
                    <IconExternal size={12} />
                  </a>
                ) : (
                  <span className="src-title">{s.title}</span>
                )}
                <span className="src-meta">
                  {[domain, s.publisher, s.type ? TYPE_LABELS[s.type] ?? s.type : null].filter(Boolean).join(' · ')}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {list.length > limit && (
        <button className="link-btn" onClick={() => setAll(!all)}>
          {all ? 'Réduire' : `+ ${list.length - limit} autre${list.length - limit > 1 ? 's' : ''}`}
        </button>
      )}
    </section>
  );
}

/** Text with inline "[region:S3, region:S4]" citations turned into small numbered links. */
export function RichText({ text, atlas, order }: { text: string; atlas: Atlas; order?: string[] }) {
  const parts = text.split(/(\[[^\]]*:S\d+[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(.*)\]$/);
        if (!m) return <span key={i}>{p}</span>;
        const ids = m[1].split(/\s*,\s*/);
        return (
          <sup key={i} className="cite">
            {ids.map((id) => {
              const s = atlas.sources[id];
              const n = order ? order.indexOf(id) + 1 : 0;
              const label = n > 0 ? String(n) : (domainOf(s?.url) ?? id.split(':')[1] ?? '?');
              return s?.url ? (
                <a key={id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>
                  {label}
                </a>
              ) : (
                <span key={id} title={s?.title}>
                  {label}
                </span>
              );
            })}
          </sup>
        );
      })}
    </>
  );
}
