import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface StoredObject {
  key: string;
  byteSize: number;
  private: true;
}

export interface StorageProvider {
  put(source: string | Buffer, key: string, contentType: string): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  metadata(key: string): Promise<{ byteSize: number; contentType?: string } | null>;
}

function assertStorageKey(key: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,240}$/.test(key) || key.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Invalid storage key');
  }
}

export class LocalPrivateStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertStorageKey(key);
    const root = path.resolve(this.root);
    const resolved = path.resolve(root, key);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error('Storage key escapes private storage root');
    }
    return resolved;
  }

  async put(source: string | Buffer, key: string, _contentType: string): Promise<StoredObject> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    const sourceBytes = typeof source === 'string' ? await readFile(source) : source;
    await writeFile(target, sourceBytes, { flag: 'wx', mode: 0o600 });
    return { key, byteSize: sourceBytes.byteLength, private: true };
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async metadata(key: string): Promise<{ byteSize: number; contentType?: string } | null> {
    try {
      const details = await stat(this.resolve(key));
      return { byteSize: details.size };
    } catch {
      return null;
    }
  }
}

export class SupabasePrivateStorage implements StorageProvider {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string,
  ) {}

  async put(source: string | Buffer, key: string, contentType: string): Promise<StoredObject> {
    assertStorageKey(key);
    const sourceBytes = typeof source === 'string' ? await readFile(source) : source;
    const { error } = await this.client.storage.from(this.bucket).upload(key, sourceBytes, {
      contentType,
      upsert: false,
    });
    if (error) throw error;
    const byteSize = typeof source === 'string' ? (await stat(source)).size : source.length;
    return { key, byteSize, private: true };
  }

  async read(key: string): Promise<Buffer> {
    assertStorageKey(key);
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    assertStorageKey(key);
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw error;
  }

  async metadata(key: string): Promise<{ byteSize: number; contentType?: string } | null> {
    assertStorageKey(key);
    const slash = key.lastIndexOf('/');
    const directory = slash >= 0 ? key.slice(0, slash) : '';
    const filename = slash >= 0 ? key.slice(slash + 1) : key;
    const { data, error } = await this.client.storage.from(this.bucket).list(directory, { search: filename, limit: 1 });
    if (error) throw error;
    const item = data?.find((entry) => entry.name === filename);
    return item ? { byteSize: item.metadata?.size ?? 0, contentType: item.metadata?.mimetype } : null;
  }
}

export function createStorageProvider(): StorageProvider {
  const root = process.env.CONTENT_STORAGE_ROOT || path.join(process.cwd(), '.private-content');
  if (process.env.DATABASE_PROVIDER === 'supabase' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    return new SupabasePrivateStorage(client, process.env.SUPABASE_STORAGE_BUCKET || 'studyhub-private');
  }
  return new LocalPrivateStorage(root);
}

export async function cleanupStorageObject(storage: StorageProvider, key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await storage.delete(key);
  } catch {
    // Cleanup is best-effort after the primary failure and must not mask it.
  }
}
