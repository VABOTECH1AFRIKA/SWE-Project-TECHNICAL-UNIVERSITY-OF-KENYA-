export type DataSourceStatus = 'ACTIVE' | 'OPTIONAL' | 'DEPRECATED' | 'UNUSED';

export interface RuntimeDataSource {
  id: string;
  status: DataSourceStatus;
  file: string;
  currentMount: string;
  notes: string;
}

export interface RuntimeDataArchitecture {
  canonicalRuntimeDataPath: RuntimeDataSource;
  activeDataSources: RuntimeDataSource[];
  optionalIntegrationPaths: RuntimeDataSource[];
  deprecatedPaths: RuntimeDataSource[];
  unusedPaths: RuntimeDataSource[];
}

export const DATA_ARCHITECTURE: RuntimeDataArchitecture = {
  canonicalRuntimeDataPath: {
    id: 'sqlite-runtime',
    status: 'ACTIVE',
    file: 'src/server/api/studyhub-sqlite.ts',
    currentMount: 'src/server/entry.ts -> app.use("/api", studyhubSqlite)',
    notes: 'Current Express entrypoint mounts the SQLite router at /api, so SQLite is the authoritative runtime data path for the shipped app.',
  },
  activeDataSources: [
    {
      id: 'sqlite-runtime',
      status: 'ACTIVE',
      file: 'src/server/api/studyhub-sqlite.ts',
      currentMount: 'src/server/entry.ts -> app.use("/api", studyhubSqlite)',
      notes: 'SQLite is the only data source wired into the current production Express runtime.',
    },
  ],
  optionalIntegrationPaths: [
    {
      id: 'python-proxy',
      status: 'OPTIONAL',
      file: 'src/server/api/studyhub-proxy.ts',
      currentMount: 'NOT MOUNTED in src/server/entry.ts',
      notes: 'This proxy is present for an optional Python FastAPI integration, but it is not currently wired into the runtime entrypoint. It is explicitly optional and must not silently replace the SQLite runtime.',
    },
  ],
  deprecatedPaths: [
    {
      id: 'mysql-drizzle',
      status: 'DEPRECATED',
      file: 'src/server/db/client.ts',
      currentMount: 'NOT MOUNTED in src/server/entry.ts',
      notes: 'The MySQL/Drizzle stack exists as a legacy or future integration path, but no active runtime route imports or mounts it. It is retained only for explicit review and should not be treated as the shipped app data path.',
    },
    {
      id: 'drizzle-config',
      status: 'DEPRECATED',
      file: 'drizzle.config.ts',
      currentMount: 'NOT USED by current runtime request flow',
      notes: 'Drizzle configuration is available for schema generation or future migrations, but the current runtime does not consume it for request handling.',
    },
  ],
  unusedPaths: [
    {
      id: 'demo-data',
      status: 'UNUSED',
      file: 'src/server/api/studyhub-data.ts',
      currentMount: 'NOT MOUNTED in src/server/entry.ts',
      notes: 'This router mirrors the live routes with in-memory data only. It is a demo/fallback artifact and must never silently mask production failures.',
    },
    {
      id: 'sqlite-client-helper',
      status: 'UNUSED',
      file: 'src/server/db/sqlite-client.ts',
      currentMount: 'NOT IMPORTED by current runtime request flow',
      notes: 'The helper exists as a SQLite client artifact, but the active server API accesses SQLite directly via better-sqlite3 and DB_PATH.',
    },
    {
      id: 'mysql-schema-placeholder',
      status: 'UNUSED',
      file: 'src/server/db/schema.ts',
      currentMount: 'NOT CONSUMED by current runtime request flow',
      notes: 'The MySQL schema file is an empty placeholder. It is not wired into the active runtime and is therefore not part of the current authoritative data path.',
    },
  ],
};

export const ROUTE_DATA_SOURCE_MAP: Record<string, string> = {
  '/courses': 'sqlite-runtime',
  '/courses/:id': 'sqlite-runtime',
  '/notes': 'sqlite-runtime',
  '/assignments': 'sqlite-runtime',
  '/quizzes': 'sqlite-runtime',
  '/quizzes/:id': 'sqlite-runtime',
  '/flashcards': 'sqlite-runtime',
  '/videos': 'sqlite-runtime',
  '/study-plan': 'sqlite-runtime',
  '/study-plan/:id/toggle': 'sqlite-runtime',
  '/analytics': 'sqlite-runtime',
  '/forum': 'sqlite-runtime',
  '/forum/:id': 'sqlite-runtime',
  '/forum/:id/replies': 'sqlite-runtime',
  '/admin/stats': 'sqlite-runtime',
  '/admin/users': 'sqlite-runtime',
  '/admin/users/:id/status': 'sqlite-runtime',
  '/auth/register': 'sqlite-runtime',
  '/auth/login': 'sqlite-runtime',
  '/auth/logout': 'sqlite-runtime',
  '/user/me': 'sqlite-runtime',
};

export function getRuntimeDataSourceStatus(sourceId: string): DataSourceStatus {
  const allSources = [
    ...DATA_ARCHITECTURE.activeDataSources,
    ...DATA_ARCHITECTURE.optionalIntegrationPaths,
    ...DATA_ARCHITECTURE.deprecatedPaths,
    ...DATA_ARCHITECTURE.unusedPaths,
  ];

  return allSources.find((source) => source.id === sourceId)?.status ?? 'UNUSED';
}
