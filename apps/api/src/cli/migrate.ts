import { loadConfig } from '../config';
import { createDb } from '../db/client';
import { migrate } from '../db/migrate';

const db = await createDb(loadConfig().databaseUrl);
const applied = await migrate(db, console.log);
console.log(applied.length ? `${applied.length} migration(s) appliquée(s)` : 'schéma à jour');
await db.close();
