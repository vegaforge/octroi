import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../migrate';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Add it to .env (or export it) and try again.');
  process.exit(1);
}

runMigrations({ databaseUrl, migrationsDir })
  .then((result) => {
    if (result.applied.length === 0) {
      console.log(
        `✓ already up to date (${result.alreadyApplied.length} migration(s) applied previously)`,
      );
    } else {
      console.log(`✓ applied ${result.applied.length} migration(s):`);
      for (const f of result.applied) console.log(`  + ${f}`);
      if (result.alreadyApplied.length > 0) {
        console.log(`  (${result.alreadyApplied.length} skipped, already applied)`);
      }
    }
  })
  .catch((err: Error) => {
    console.error(`✗ migration failed: ${err.message}`);
    process.exit(1);
  });
