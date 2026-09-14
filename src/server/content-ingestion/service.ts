import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractDocument, type SupportedContentType } from './extract.js';
import { cleanupStorageObject, type StorageProvider } from './storage.js';

async function materializeUploadToTempFile(buffer: Buffer): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `studyhub-ingestion-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, 'upload-source');
  await writeFile(tempFile, buffer, { mode: 0o600 });
  return tempFile;
}

export interface ContentIngestionRepository {
  createProcessingIntent(payload: {
    resourceId: string;
    mimeType: SupportedContentType;
    byteSize: number;
    checksum: string;
    createdBy: string;
  }): Promise<{ versionId: string; jobId: string; versionNumber: number; duplicate?: boolean } | null>;
  setVersionStorageReference(versionId: string, storageReference: string): Promise<void>;
  startProcessing(versionId: string): Promise<void>;
  completeProcessing(payload: { versionId: string; text: string; sections: Array<{ text: string; pageNumber?: number; slideNumber?: number; headingPath?: string }> }): Promise<unknown>;
  failProcessing(versionId: string, errorMessage: string): Promise<void>;
  beginRetry(resourceId: string): Promise<{ versionId: string; storageReference: string; mimeType: SupportedContentType } | null>;
  getProcessing(resourceId: string): Promise<unknown>;
  getVersionSource(resourceId: string): Promise<{ versionId: string; storageReference: string; mimeType: SupportedContentType } | null>;
}

function safeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 120) || 'upload.bin';
}

function storageKey(resourceId: string, versionId: string, filename: string): string {
  return `content/${resourceId}/${versionId}/${randomUUID()}-${safeFilename(filename)}`;
}

export async function ingestUploadedFile(input: {
  repository: ContentIngestionRepository;
  storage: StorageProvider;
  resourceId: string;
  createdBy: string;
  filename: string;
  mimeType: SupportedContentType;
  tempFilePath?: string;
  buffer?: Buffer;
}): Promise<unknown> {
  const source = input.buffer ? input.buffer : await readFile(input.tempFilePath ?? '');
  const checksum = createHash('sha256').update(source).digest('hex');
  const intent = await input.repository.createProcessingIntent({
    resourceId: input.resourceId,
    mimeType: input.mimeType,
    byteSize: source.byteLength,
    checksum,
    createdBy: input.createdBy,
  });
  if (!intent) return null;
  if (intent.duplicate) return input.repository.getProcessing(input.resourceId);

  const key = storageKey(input.resourceId, intent.versionId, input.filename);
  let stored = false;
  let referencePersisted = false;
  let tempFilePath = input.tempFilePath;
  const createdTempFile = input.buffer ? await materializeUploadToTempFile(input.buffer) : undefined;
  if (createdTempFile) tempFilePath = createdTempFile;

  try {
    await input.storage.put(input.buffer ?? input.tempFilePath ?? '', key, input.mimeType);
    stored = true;
    await input.repository.setVersionStorageReference(intent.versionId, key);
    referencePersisted = true;
    await input.repository.startProcessing(intent.versionId);
    const extracted = await extractDocument(tempFilePath ?? input.tempFilePath ?? '', input.mimeType);
    return await input.repository.completeProcessing({
      versionId: intent.versionId,
      text: extracted.text,
      sections: extracted.sections,
    });
  } catch (error) {
    await input.repository.failProcessing(intent.versionId, error instanceof Error ? error.message : 'Processing failed');
    if (stored && (!referencePersisted || process.env.RETAIN_FAILED_CONTENT === 'false')) await cleanupStorageObject(input.storage, key);
    throw error;
  } finally {
    if (createdTempFile) await rm(path.dirname(createdTempFile), { recursive: true, force: true });
  }
}

export async function retryStoredFile(input: {
  repository: ContentIngestionRepository;
  storage: StorageProvider;
  resourceId: string;
}): Promise<unknown> {
  const retrySource = await input.repository.beginRetry(input.resourceId);
  if (!retrySource) return null;
  const tempDir = path.join(os.tmpdir(), `studyhub-ingestion-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, 'retry-source');
  try {
    const bytes = await input.storage.read(retrySource.storageReference);
    await writeFile(tempFile, bytes, { mode: 0o600 });
    const extracted = await extractDocument(tempFile, retrySource.mimeType);
    return await input.repository.completeProcessing({
      versionId: retrySource.versionId,
      text: extracted.text,
      sections: extracted.sections,
    });
  } catch (error) {
    await input.repository.failProcessing(retrySource.versionId, error instanceof Error ? error.message : 'Retry failed');
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
