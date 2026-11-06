/**
 * Hindcast bench: scores any revision of the wind model against observed winds.
 *
 *   npm run model:hindcast -- --prepare            downloads and caches the dataset (once)
 *   npm run model:hindcast                         scores the working tree
 *   npm run model:hindcast -- --rev <rev>          scores a revision in a temporary worktree
 *   npm run model:hindcast -- --compare <rev>      working tree (or --rev) against <rev>
 *
 * Options: --shards N (default 6), --force (ignore a cached run), --write (docs/validation/results-<rev>.json),
 * --report <file> (Markdown tables), --tree <dir> --label <name> (scores a prepared tree: a worktree
 * with an uncommitted patch and the dependencies set up by --keep-tree <rev>).
 * Runs are cached in .cache/validation/runs/<rev>.
 * Results depend only on the dataset and the revision. See docs/VALIDATION.md.
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BUNDLE, CACHE, ensureDir, readJson, type Bundle } from './common';
import type { RunMeta } from './evaluate';
import { buildResults, loadSamples, printCompare, printReport, type Results } from './metrics';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(name);
const REPO = resolve(process.env.HINDCAST_REPO ?? process.cwd());
const SHARDS = Number(opt('--shards') ?? 6);
const RUNS = join(CACHE, 'runs');
const git = (...a: string[]) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();

/** Files that decide what the model answers. */
const MODEL_PATHS = ['packages/model', 'packages/shared', 'apps/web/src/ui/air-brief.ts', 'apps/web/public/data/atlas.json', 'apps/web/public/data/dem.json', 'apps/web/public/data/dem.png', 'apps/web/public/data/landcover.png'];

function workingLabel(): string {
  const sha = git('rev-parse', '--short=9', 'HEAD');
  return git('status', '--porcelain', '--', ...MODEL_PATHS) ? `${sha}-dirty` : sha;
}

/** A temporary worktree of `sha`, using the repo's dependencies but its own @brises packages. */
function makeWorktree(sha: string): string {
  const base = mkdtempSync(join(process.env.HINDCAST_SCRATCH ?? tmpdir(), 'brises-hindcast-'));
  const tree = join(base, sha);
  git('worktree', 'add', '--detach', tree, sha);
  const modules = join(tree, 'node_modules');
  mkdirSync(modules, { recursive: true });
  for (const name of readdirSync(join(REPO, 'node_modules'))) {
    if (name === '@brises' || name === '.bin' || name.startsWith('.')) continue;
    symlinkSync(join(REPO, 'node_modules', name), join(modules, name));
  }
  mkdirSync(join(modules, '@brises'));
  for (const [name, target] of [
    ['model', 'packages/model'],
    ['shared', 'packages/shared'],
    ['api', 'apps/api'],
    ['web', 'apps/web'],
  ])
    symlinkSync(join(tree, target), join(modules, '@brises', name));
  // The harness of this tree scores the model of that one.
  mkdirSync(join(tree, 'scripts/validation'), { recursive: true });
  cpSync(join(REPO, 'scripts/validation'), join(tree, 'scripts/validation'), { recursive: true });
  return tree;
}

function removeWorktree(tree: string): void {
  git('worktree', 'remove', '--force', tree);
  rmSync(resolve(tree, '..'), { recursive: true, force: true });
  git('worktree', 'prune');
}

/** Evaluates the tree at `cwd` shard by shard, in child processes, and merges them. */
async function runInTree(cwd: string, label: string): Promise<void> {
  ensureDir(RUNS);
  const tsx = join(REPO, 'node_modules/.bin/tsx');
  const script = join(cwd, 'scripts/validation/hindcast.ts');
  const started = Date.now();
  await Promise.all(
    Array.from({ length: SHARDS }, (_, i) =>
      new Promise<void>((ok, ko) => {
        const child = spawn(tsx, [script, '--eval-shard', String(i), '--shards', String(SHARDS), '--label', label], { cwd, env: { ...process.env, HINDCAST_REPO: REPO }, stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('exit', (code) => (code === 0 ? ok() : ko(new Error(`shard ${i}: code ${code}`))));
      }),
    ),
  );
  const parts = Array.from({ length: SHARDS }, (_, i) => new Float32Array(new Uint8Array(readFileSync(join(RUNS, `${label}.shard${i}.bin`))).buffer));
  const merged = parts[0];
  for (let p = 1; p < parts.length; p++) {
    const part = parts[p];
    for (let k = 0; k < part.length; k++) if (!Number.isNaN(part[k])) merged[k] = part[k];
  }
  writeFileSync(join(RUNS, `${label}.bin`), Buffer.from(merged.buffer));
  const metas = parts.map((_, i) => readJson<RunMeta>(join(RUNS, `${label}.shard${i}.json`)));
  const meta = metas[0];
  for (const m of metas) Object.assign(meta.groundM, m.groundM);
  writeFileSync(join(RUNS, `${label}.json`), JSON.stringify(meta));
  for (let i = 0; i < SHARDS; i++) {
    rmSync(join(RUNS, `${label}.shard${i}.bin`));
    rmSync(join(RUNS, `${label}.shard${i}.json`));
  }
  process.stderr.write(`Évaluation ${label} : ${Math.round((Date.now() - started) / 1000)} s\n`);
}

function hasRun(label: string): boolean {
  return existsSync(join(RUNS, `${label}.bin`)) && !flag('--force');
}

/** Runs a revision if needed; returns its label. */
async function ensureRev(rev: string | null): Promise<string> {
  if (rev === null) {
    const label = workingLabel();
    // A dirty tree is never reused: its content is not named by its label.
    if (label.endsWith('-dirty') || !hasRun(label)) await runInTree(process.cwd(), label);
    return label;
  }
  const label = git('rev-parse', '--short=9', rev);
  if (hasRun(label)) return label;
  const tree = makeWorktree(label);
  try {
    await runInTree(tree, label);
  } finally {
    removeWorktree(tree);
  }
  return label;
}

function load(label: string, bundle: Bundle) {
  const data = new Float32Array(new Uint8Array(readFileSync(join(RUNS, `${label}.bin`))).buffer);
  const meta = readJson<RunMeta>(join(RUNS, `${label}.json`));
  const samples = loadSamples(bundle, data, meta);
  return { samples, results: buildResults(label, bundle, samples) };
}

function writeResults(r: Results): string {
  const dir = join(REPO, 'docs/validation');
  ensureDir(dir);
  const path = join(dir, `results-${r.rev}.json`);
  writeFileSync(path, `${JSON.stringify(r)}\n`);
  return path;
}

async function main(): Promise<void> {
  if (flag('--prepare')) {
    const { prepare } = await import('./prepare');
    await prepare({ balises: !flag('--no-balises'), dry: flag('--dry') });
    return;
  }
  if (!existsSync(BUNDLE)) throw new Error(`Banc absent : lancer d'abord --prepare (${BUNDLE})`);
  const bundle = readJson<Bundle>(BUNDLE);
  const shard = opt('--eval-shard');
  if (shard !== undefined) {
    const { evaluateShard, writeShard } = await import('./evaluate');
    const label = opt('--label')!;
    const { data, meta } = await evaluateShard(bundle, Number(shard), SHARDS, label);
    writeShard(join(RUNS, `${label}.shard${shard}`), data, meta);
    return;
  }
  const keep = opt('--keep-tree');
  if (keep) {
    // A scoring tree left in place, to try a patch on the model without touching the repo.
    process.stdout.write(`${makeWorktree(git('rev-parse', '--short=9', keep))}\n`);
    return;
  }
  const tree = opt('--tree');
  let label: string;
  if (tree) {
    label = opt('--label') ?? 'tree';
    cpSync(join(REPO, 'scripts/validation'), join(tree, 'scripts/validation'), { recursive: true });
    if (!hasRun(label)) await runInTree(resolve(tree), label);
  } else label = await ensureRev(opt('--rev') ?? null);
  const a = load(label, bundle);
  const compare = opt('--compare');
  if (compare) {
    const other = await ensureRev(compare);
    const b = load(other, bundle);
    process.stdout.write(`${printCompare(a.results, b.results, a.samples, b.samples, bundle)}\n`);
    return;
  }
  const text = printReport(a.results);
  const report = opt('--report');
  if (report) writeFileSync(report, `${text}\n`);
  else process.stdout.write(`${text}\n`);
  if (flag('--write')) process.stderr.write(`Écrit : ${writeResults(a.results)}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
