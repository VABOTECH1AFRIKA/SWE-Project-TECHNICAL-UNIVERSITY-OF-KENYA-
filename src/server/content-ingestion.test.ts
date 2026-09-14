import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import pptxgen from 'pptxgenjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contentTypeForFilename, extractDocument } from './content-ingestion/extract';
import { LocalPrivateStorage } from './content-ingestion/storage';

let fixtureDir = '';

const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length  fifty >>
stream
BT /F1 18 Tf 72 720 Td (Binary Search) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;

beforeAll(async () => {
  fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'studyhub-ingestion-fixtures-'));
  await writeFile(path.join(fixtureDir, 'notes.txt'), 'Binary search halves the search space.\n', 'utf8');
  await writeFile(path.join(fixtureDir, 'notes.md'), '# Binary Search\n\n- Divide the search space\n', 'utf8');
  await writeFile(path.join(fixtureDir, 'notes.pdf'), minimalPdf, 'latin1');

  const docx = new Document({ sections: [{ children: [
    new Paragraph({ text: 'Binary Search', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('Divide the search space in half.'),
  ] }] });
  await writeFile(path.join(fixtureDir, 'notes.docx'), await Packer.toBuffer(docx));

  const pptx = new pptxgen();
  const slide = pptx.addSlide();
  slide.addText('Binary Search', { x: 1, y: 1, w: 5, h: 1 });
  slide.addText('Divide the search space in half.', { x: 1, y: 2, w: 5, h: 1 });
  await pptx.writeFile({ fileName: path.join(fixtureDir, 'notes.pptx') });
});

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

describe('content ingestion extraction and storage', () => {
  it.each([
    ['notes.txt', 'text/plain', 'Binary search'],
    ['notes.md', 'text/markdown', 'Binary Search'],
    ['notes.pdf', 'application/pdf', 'Binary Search'],
    ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Binary Search'],
    ['notes.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Binary Search'],
  ])('extracts %s with educational text', async (filename, mimeType, expected) => {
    const result = await extractDocument(path.join(fixtureDir, filename), mimeType as Parameters<typeof extractDocument>[1]);
    expect(result.text).toContain(expected);
    expect(result.sections.length).toBeGreaterThan(0);
    if (mimeType === 'application/pdf') expect(result.sections.some((section) => section.pageNumber === 1)).toBe(true);
    if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') expect(result.sections.some((section) => section.slideNumber === 1)).toBe(true);
  });

  it('rejects malformed PDF content without reporting success', async () => {
    const malformed = path.join(fixtureDir, 'malformed.pdf');
    await writeFile(malformed, Buffer.from('not a pdf'));
    await expect(extractDocument(malformed, 'application/pdf')).rejects.toThrow();
  });

  it('keeps local storage private and rejects traversal keys', async () => {
    const storage = new LocalPrivateStorage(path.join(fixtureDir, 'private'));
    const source = path.join(fixtureDir, 'notes.txt');
    const stored = await storage.put(source, 'resource/version/notes.txt', 'text/plain');
    expect(stored.private).toBe(true);
    expect(await storage.read(stored.key)).toEqual(await readFile(source));
    await expect(storage.put(source, '../escape.txt', 'text/plain')).rejects.toThrow();
    await storage.delete(stored.key);
    expect(await storage.metadata(stored.key)).toBeNull();
  });

  it('maps only allowlisted academic extensions', () => {
    expect(contentTypeForFilename('notes.txt')).toBe('text/plain');
    expect(contentTypeForFilename('notes.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(contentTypeForFilename('notes.exe')).toBeNull();
  });
});
