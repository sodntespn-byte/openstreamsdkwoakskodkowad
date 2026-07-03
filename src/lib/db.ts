import { Pool, PoolClient } from 'pg';

// URL de conexao do PostgreSQL
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// Verificar se esta em modo offline (sem configuracao do banco)
const isOfflineMode = !DATABASE_URL;

// Interface para QueryResult compativel
interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number | null;
}

// Interfaces
interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  is_admin: boolean;
  status: string;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  avatar_url?: string | null;
  theme?: string;
}

interface WatchHistoryItem {
  id: number;
  user_id: number;
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  poster_path: string | null;
  media_type: string;
  season: number | null;
  episode: number | null;
  progress: number;
  watched_at: Date;
  vote_average?: number | null;
  max_quality?: string | null;
}

interface Favorite {
  id: number;
  user_id: number;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  media_type: string;
  added_at: Date;
}

export interface ViewerProfileRow {
  id: number;
  user_id: number;
  name: string;
  avatar_id: string;
  avatar_url?: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface TitleReviewRow {
  id: number;
  user_id: number;
  tmdb_id: number;
  media_type: string;
  rating: number;
  body: string;
  created_at: Date;
}

// Dados em memoria para modo offline
const inMemoryData = {
  users: [] as User[],
  watchHistory: [] as WatchHistoryItem[],
  favorites: [] as Favorite[],
  viewerProfiles: [] as ViewerProfileRow[],
  titleReviews: [] as TitleReviewRow[],
  settings: new Map<string, string>(),
};

export function nextViewerProfileIdAlloc(): number {
  if (inMemoryData.viewerProfiles.length === 0) return 1;
  return Math.max(...inMemoryData.viewerProfiles.map((p) => p.id)) + 1;
}

// Pool de conexoes PostgreSQL
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool && !isOfflineMode) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL?.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Log de erros do pool
    pool.on('error', (err) => {
      console.error('Erro inesperado no pool do PostgreSQL:', err);
    });
  }
  return pool!;
}

// Funcao de query generica usando pg
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (isOfflineMode) {
    console.warn('Database offline - using in-memory storage');
    return { rows: [] as T[], rowCount: null } as QueryResult<T>;
  }

  const client = getPool();

  try {
    const result = await client.query(text, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount,
    };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

// Funcao sql template literal (compativel com @vercel/postgres)
export async function sql<T = unknown>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> {
  if (isOfflineMode) {
    console.warn('Database offline - using in-memory storage');
    return { rows: [] as T[], rowCount: null } as QueryResult<T>;
  }

  // Converter template literal para query parametrizada
  let queryText = '';
  const params: unknown[] = [];

  strings.forEach((string, i) => {
    queryText += string;
    if (i < values.length) {
      params.push(values[i]);
      queryText += `$${params.length}`;
    }
  });

  return query<T>(queryText, params);
}

// Obter uma conexao do pool para transacoes
export async function getClient(): Promise<PoolClient> {
  if (isOfflineMode) {
    throw new Error('Database offline - cannot get client');
  }
  return getPool().connect();
}

async function applySchemaPatches(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await client.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(32) DEFAULT 'dark'`
  );
  await client.query(`ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS vote_average REAL`);
  await client.query(
    `ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS max_quality VARCHAR(50)`
  );
  await client.query(`
    CREATE TABLE IF NOT EXISTS title_reviews (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tmdb_id INTEGER NOT NULL,
      media_type VARCHAR(10) NOT NULL,
      rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 10),
      body TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_title_reviews_tmdb ON title_reviews(tmdb_id, media_type)`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_title_reviews_user ON title_reviews(user_id)`
  );
  await client.query(`ALTER TABLE viewer_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT`);

  // Favoritos: mesmo número TMDB pode existir em filme e série — chave composta com media_type
  await client.query(`
    ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_tmdb_id_key
  `);
  await client.query(`
    DO $mig$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'favorites' AND c.conname = 'favorites_user_id_tmdb_id_media_type_key'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_favorites_user_tmdb_mediatype'
      ) THEN
        ALTER TABLE favorites ADD CONSTRAINT favorites_user_id_tmdb_id_media_type_key
          UNIQUE (user_id, tmdb_id, media_type);
      END IF;
    END $mig$
  `);
}

// Inicializar banco de dados (criar tabelas se nao existirem)
export async function initializeDatabase() {
  if (isOfflineMode) {
    console.log('Running in offline mode - skipping database initialization');
    return;
  }

  const client = await getClient();

  try {
    // Criar tabelas
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'active',
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS watch_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tmdb_id INTEGER NOT NULL,
        imdb_id VARCHAR(50),
        title VARCHAR(500) NOT NULL,
        poster_path VARCHAR(500),
        media_type VARCHAR(50) NOT NULL,
        season INTEGER,
        episode INTEGER,
        progress DECIMAL(5,4) DEFAULT 0,
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, tmdb_id, season, episode)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tmdb_id INTEGER NOT NULL,
        title VARCHAR(500) NOT NULL,
        poster_path VARCHAR(500),
        media_type VARCHAR(50) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, tmdb_id, media_type)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        target_type VARCHAR(100),
        target_id VARCHAR(100),
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabelas de TV
    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        channel_id VARCHAR(255) NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        channel_logo TEXT,
        channel_category VARCHAR(100),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, channel_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        channel_id VARCHAR(255) NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        channel_logo TEXT,
        channel_category VARCHAR(100),
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, channel_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS viewer_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        avatar_id VARCHAR(50) NOT NULL DEFAULT 'gradient-1',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_viewer_profiles_user_id ON viewer_profiles(user_id)`);

    // Criar indices se nao existirem
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_watch_history_tmdb_id ON watch_history(tmdb_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at ON watch_history(watched_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_favorites_tmdb_id ON favorites(tmdb_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at)`);

    // Indices para TV
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tv_favorites_user_id ON tv_favorites(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tv_favorites_channel_id ON tv_favorites(channel_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tv_history_user_id ON tv_history(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tv_history_channel_id ON tv_history(channel_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tv_history_watched_at ON tv_history(watched_at)`);

    await applySchemaPatches(client);

    console.log('Database tables initialized successfully');
  } finally {
    client.release();
  }
}

/** Garante tabela de perfis (deploys sem migração completa). Idempotente. */
export async function ensureViewerProfilesTable(): Promise<void> {
  if (isOfflineMode) return;
  await query(`
    CREATE TABLE IF NOT EXISTS viewer_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      avatar_id VARCHAR(50) NOT NULL DEFAULT 'gradient-1',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_viewer_profiles_user_id ON viewer_profiles(user_id)`
  );
  await query(`ALTER TABLE viewer_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
}

/** Garante patches de schema (avatar_url, theme, title_reviews, etc.) antes de auth. Idempotente. */
let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema(): Promise<void> {
  if (isOfflineMode || schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const client = await getClient();
      try {
        await applySchemaPatches(client);
      } finally {
        client.release();
      }
    })();
  }
  try {
    await schemaPromise;
    schemaReady = true;
  } catch (e) {
    schemaPromise = null;
    throw e;
  }
}

// Fechar pool de conexoes (para cleanup)
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Exportar para uso externo
export { isOfflineMode, inMemoryData, getPool };
export type { User, WatchHistoryItem, Favorite, QueryResult };
