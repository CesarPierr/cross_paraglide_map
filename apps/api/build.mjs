// Bundles the API into a single ESM file (fast cold start, no TypeScript at runtime).
// SQL migrations are embedded so the image only needs dist/ and production dependencies.
import { readdirSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

const dir = new URL('./src/db/migrations/', import.meta.url);
const migrations = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]),
);

await build({
  entryPoints: ['src/main.ts', 'src/cli/migrate.ts', 'src/cli/seed.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  minifySyntax: true,
  // Dev-only embedded database and native-ish deps stay external.
  external: ['@electric-sql/pglite', '@electric-sql/pglite-postgis', 'postgres'],
  define: { __MIGRATIONS__: JSON.stringify(migrations) },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
