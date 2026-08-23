/** TREAT AS IMMUTABLE - This file is protected by the file-edit tool
 *
 * Drizzle Kit configuration for database migrations
 *
 * Usage:
 * - Generate migrations: npx drizzle-kit generate
 * - Push schema to database: npx drizzle-kit push
 *
 * Configuration source:
 * - Reads from $NOMAD_TASK_DIR/config.json (defaults to /local/config.json)
 * - Throws error if config file not found or invalid
 */
import { defineConfig } from 'drizzle-kit';
import { getDatabaseCredentials } from './src/server/db/config';

const credentials = getDatabaseCredentials();

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: credentials.host,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
    ssl: {
      rejectUnauthorized: false,
    }
  },
  verbose: true,
  strict: false,
});
