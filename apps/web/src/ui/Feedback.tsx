/**
 * Quick feedback on any item (confirm / not observed / correct / comment) and
 * the contribution panel to add a new local phenomenon placed on the map.
 * Goes through the DataClient: API in production, GitHub issue otherwise.
 */
import type { ContributionInput, FeedbackSummary } from '@brises/shared';
import { useEffect, useState } from 'react';
import { useApp, useRuntime, type ContributionDraft } from '../state/store';
import { getController, getDataClient } from './controller-ref';
import { fmtHour } from './format';
import { IconChat, IconCheck, IconClose, IconEdit, IconPin, IconPlus, IconX } from './icons';

/** Simulation context attached to every contribution (helps moderation). */
function context(): ContributionInput['context'] {
  const s = useApp.getState();
  return {
    heure: fmtHour(s.hour),
    mois: s.month0 + 1,
    ventMeteo: s.synopticKmh ? `${s.synopticFrom}° ${s.synopticKmh} km/h` : 'calme',
    vue: window.location.hash.slice(1, 60),
  };
}

export function startDraft(d: Omit<ContributionDraft, 'points' | 'picking'> & { points?: [number, number][] }) {
  useRuntime.getState().set({ draft: { points: [], picking: false, ...d } });
  useApp.getState().set({ panelOpen: true });
}

export function FeedbackBar({ targetRef, title }: { targetRef: string; title: string }) {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getDataClient()
      ?.feedbackSummary(targetRef)
      .then((s) => alive && setSummary(s));
    return () => {
      alive = false;
    };
  }, [targetRef]);

  const quick = async (kind: 'confirm' | 'dispute') => {
    const data = getDataClient();
    if (!data) return;
    try {
      await data.submitContribution({ kind, targetRef, title, message: kind === 'confirm' ? 'Observé conforme.' : 'Pas observé ainsi.', context: context() });
      setSent(kind);
      useRuntime.getState().set({ toast: 'Merci ! Votre retour aide à fiabiliser la carte.' });
    } catch {
      useRuntime.getState().set({ toast: 'Envoi impossible pour le moment.' });
    }
  };

  return (
    <section className="feedback" aria-label="Votre expérience">
      <h3>Votre expérience</h3>
      <div className="feedback-row">
        <button className={`fb-btn ok ${sent === 'confirm' ? 'on' : ''}`} onClick={() => void quick('confirm')} disabled={!!sent} title="J’ai observé ce phénomène ainsi">
          <IconCheck size={15} /> Je confirme{summary?.confirm ? <span className="fb-count">{summary.confirm}</span> : null}
        </button>
        <button className={`fb-btn bad ${sent === 'dispute' ? 'on' : ''}`} onClick={() => void quick('dispute')} disabled={!!sent} title="Ce n’est pas ce que j’observe">
          <IconX size={15} /> Pas observé{summary?.dispute ? <span className="fb-count">{summary.dispute}</span> : null}
        </button>
      </div>
      <div className="feedback-row">
        <button className="fb-btn" onClick={() => startDraft({ kind: 'correct', targetRef, targetTitle: title })}>
          <IconEdit size={15} /> Corriger / préciser
        </button>
        <button className="fb-btn" onClick={() => startDraft({ kind: 'comment', targetRef, targetTitle: title })}>
          <IconChat size={15} /> Commenter
        </button>
      </div>
    </section>
  );
}

const CATEGORIES: { key: NonNullable<ContributionInput['category']>; label: string; multi?: boolean }[] = [
  { key: 'breeze', label: 'Brise (tracez son trajet)', multi: true },
  { key: 'convergence', label: 'Convergence (tracez la ligne)', multi: true },
  { key: 'thermal', label: 'Thermique / gâchette' },
  { key: 'soaring', label: 'Spot de soaring' },
  { key: 'hazard', label: 'Piège (venturi, rotor, dégueulante…)' },
  { key: 'takeoff', label: 'Décollage' },
  { key: 'landing', label: 'Atterrissage' },
  { key: 'other', label: 'Autre' },
];

const KIND_TITLES: Record<ContributionInput['kind'], string> = {
  new: 'Ajouter un phénomène local',
  correct: 'Corriger / préciser',
  comment: 'Commenter',
  confirm: 'Confirmer',
  dispute: 'Signaler',
};

export function ContributionPanel() {
  const draft = useRuntime((r) => r.draft);
  const [form, setForm] = useState({ title: '', message: '', hours: '', strength: '', winds: '', sourceUrl: '', author: '', email: '' });
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const c = getController();
    if (!c) return;
    const pts = draft?.points ?? [];
    c.setScratch({
      type: 'FeatureCollection',
      features: [
        ...pts.map((p) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: p }, properties: {} })),
        ...(pts.length > 1 ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: pts }, properties: {} }] : []),
      ],
    });
    c.setPicking(!!draft?.picking);
  }, [draft]);
  if (!draft) return null;

  const set = (patch: Partial<ContributionDraft>) => useRuntime.getState().set({ draft: { ...draft, ...patch } });
  const close = () => {
    getController()?.setPicking(false);
    getController()?.setScratch({ type: 'FeatureCollection', features: [] });
    useRuntime.getState().set({ draft: null });
  };
  const cat = CATEGORIES.find((c) => c.key === draft.category);
  const isNew = draft.kind === 'new';
  const canSend = form.message.trim().length >= 2 && (!isNew || (draft.category && draft.points.length > 0 && form.title.trim()));

  const submit = async () => {
    const data = getDataClient();
    if (!data || !canSend) return;
    setSending(true);
    const details: Record<string, string> = {};
    if (form.hours) details.horaires = form.hours;
    if (form.strength) details.force = form.strength;
    if (form.winds) details.vents = form.winds;
    const geometry: ContributionInput['geometry'] =
      draft.points.length > 1 ? { type: 'LineString', coordinates: draft.points } : draft.points.length === 1 ? { type: 'Point', coordinates: draft.points[0] } : undefined;
    try {
      await data.submitContribution({
        kind: draft.kind,
        targetRef: draft.targetRef,
        category: draft.category,
        title: form.title || draft.targetTitle,
        message: form.message,
        geometry,
        details: Object.keys(details).length ? details : undefined,
        sourceUrl: form.sourceUrl || undefined,
        author: form.author || undefined,
        email: form.email || undefined,
        context: context(),
      });
      useRuntime.getState().set({ toast: data.mode === 'api' ? 'Contribution enregistrée, merci ! Elle sera relue avant publication.' : 'Contribution préparée sur GitHub : validez le ticket pour l’envoyer.' });
      close();
    } catch {
      useRuntime.getState().set({ toast: 'Envoi impossible pour le moment, réessayez plus tard.' });
    } finally {
      setSending(false);
    }
  };

  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="contrib panel" role="dialog" aria-label={KIND_TITLES[draft.kind]}>
      <header>
        <h2>{KIND_TITLES[draft.kind]}</h2>
        <button className="icon-btn ghost" onClick={close} aria-label="Fermer">
          <IconClose />
        </button>
      </header>
      {draft.targetTitle && <p className="muted small">À propos de : {draft.targetTitle}</p>}
      {isNew && (
        <>
          <label className="field">
            <span>Type de phénomène</span>
            <select value={draft.category ?? ''} onChange={(e) => set({ category: e.target.value as ContributionDraft['category'], points: [] })}>
              <option value="" disabled>
                Choisir…
              </option>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="pick-row">
            <button className={`btn small ${draft.picking ? '' : 'ghost'}`} onClick={() => set({ picking: !draft.picking })} disabled={!draft.category}>
              <IconPin size={15} /> {draft.picking ? 'Cliquez sur la carte…' : draft.points.length ? 'Replacer' : 'Placer sur la carte'}
            </button>
            <span className="muted small">
              {draft.points.length ? `${draft.points.length} point${draft.points.length > 1 ? 's' : ''}${cat?.multi ? ' (dans le sens du vent)' : ''}` : cat?.multi ? 'Cliquez les points dans le sens où l’air s’écoule' : ''}
            </span>
            {draft.points.length > 0 && (
              <button className="link-btn" onClick={() => set({ points: [] })}>
                Effacer
              </button>
            )}
          </div>
          <label className="field">
            <span>Nom</span>
            <input type="text" maxLength={160} placeholder="ex. Brise de lac de Doussard" {...field('title')} />
          </label>
        </>
      )}
      <label className="field">
        <span>{isNew ? 'Description' : 'Votre retour'}</span>
        <textarea rows={4} maxLength={4000} placeholder="Ce que vous observez, quand, dans quelles conditions…" {...field('message')} />
      </label>
      {(isNew || draft.kind === 'correct') && (
        <div className="grid-2">
          <label className="field">
            <span>Horaires</span>
            <input type="text" placeholder="ex. 12h-18h en été" {...field('hours')} />
          </label>
          <label className="field">
            <span>Force</span>
            <input type="text" placeholder="ex. 15-25 km/h" {...field('strength')} />
          </label>
          <label className="field">
            <span>Vents météo concernés</span>
            <input type="text" placeholder="ex. NO, bise" {...field('winds')} />
          </label>
          <label className="field">
            <span>Source (lien)</span>
            <input type="url" placeholder="https://…" {...field('sourceUrl')} />
          </label>
        </div>
      )}
      <details className="identity">
        <summary>Signer (facultatif)</summary>
        <div className="grid-2">
          <label className="field">
            <span>Nom / pseudo</span>
            <input type="text" maxLength={80} {...field('author')} />
          </label>
          <label className="field">
            <span>E-mail (jamais publié)</span>
            <input type="email" maxLength={160} {...field('email')} />
          </label>
        </div>
      </details>
      <footer>
        <button className="btn" onClick={() => void submit()} disabled={!canSend || sending}>
          <IconPlus size={15} /> {sending ? 'Envoi…' : 'Envoyer'}
        </button>
        <span className="muted small">Relu avant publication · contexte de simulation joint</span>
      </footer>
    </div>
  );
}
