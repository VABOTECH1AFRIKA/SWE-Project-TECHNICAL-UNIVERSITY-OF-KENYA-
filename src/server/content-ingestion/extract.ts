import { readFile } from 'node:fs/promises';

export type SupportedContentType = 'text/plain' | 'text/markdown' | 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export interface ExtractedSection {
  text: string;
  pageNumber?: number;
  slideNumber?: number;
  headingPath?: string;
}

export interface ExtractedDocument {
  text: string;
  sections: ExtractedSection[];
}

const MIME_BY_EXTENSION: Record<string, SupportedContentType> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function contentTypeForFilename(filename: string): SupportedContentType | null {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? null;
}

export function isSupportedContentType(value: string): value is SupportedContentType {
  return Object.values(MIME_BY_EXTENSION).includes(value as SupportedContentType);
}

async function extractPdf(filePath: string): Promise<ExtractedDocument> {
  const bytes = await readFile(filePath);

  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const parsePromise = parser.getText();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('PDF parsing timed out')), 5000);
    });

    const result = await Promise.race([parsePromise, timeoutPromise]);
    const pages = (result as any).pages as Array<{ text?: string }> | undefined;
    const sections = pages?.map((page, index) => ({
      text: String(page.text ?? '').trim(),
      pageNumber: index + 1,
    })).filter((section) => section.text.length > 0) ?? [];
    const text = sections.map((section) => section.text).join('\n\n').trim();
    if (!text) throw new Error('PDF contains no extractable text');
    return { text, sections };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    await parser.destroy();
  }
}

function collectOfficeSections(node: unknown, sections: ExtractedSection[], slideNumber?: number, pageNumber?: number): void {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const metadata = (record.metadata && typeof record.metadata === 'object' ? record.metadata : {}) as Record<string, unknown>;
  const currentSlide = typeof metadata.slideNumber === 'number' ? metadata.slideNumber : slideNumber;
  const currentPage = typeof metadata.pageNumber === 'number' ? metadata.pageNumber : pageNumber;
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  if (text) sections.push({ text, slideNumber: currentSlide, pageNumber: currentPage });
  const children = Array.isArray(record.children) ? record.children : Array.isArray(record.content) ? record.content : [];
  for (const child of children) collectOfficeSections(child, sections, currentSlide, currentPage);
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function extractPptx(filePath: string): Promise<ExtractedDocument> {
  const { unzipSync } = await import('fflate');
  const archive = unzipSync(await readFile(filePath));
  const slideFiles = Object.keys(archive)
    .map((name) => ({ name, number: Number(name.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1] ?? 0) }))
    .filter((slide) => slide.number > 0)
    .sort((left, right) => left.number - right.number);
  const sections = slideFiles.map((slide) => {
    const xml = new TextDecoder().decode(archive[slide.name]);
    const text = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g), (match) => decodeXml(match[1])).join(' ').trim();
    return { text, slideNumber: slide.number };
  }).filter((section) => section.text.length > 0);
  const text = sections.map((section) => section.text).join('\n\n').trim();
  if (!text) throw new Error('Presentation contains no extractable text');
  return { text, sections };
}

async function extractOffice(filePath: string, mimeType: SupportedContentType): Promise<ExtractedDocument> {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return extractPptx(filePath);
  const { OfficeParser } = await import('officeparser');
  const ast = await OfficeParser.parseOffice(await readFile(filePath), { ocr: false, extractAttachments: false });
  const sections: ExtractedSection[] = [];
  collectOfficeSections(ast.content, sections);
  const text = typeof ast.toText === 'function' ? String(ast.toText()).trim() : sections.map((section) => section.text).join('\n\n').trim();
  if (!text) throw new Error('Document contains no extractable text');
  return { text, sections: sections.length > 0 ? sections : [{ text }] };
}

export async function extractDocument(filePath: string, mimeType: SupportedContentType): Promise<ExtractedDocument> {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    const text = (await readFile(filePath, 'utf8')).trim();
    if (!text) throw new Error('Text file is empty');
    return { text, sections: [{ text }] };
  }
  if (mimeType === 'application/pdf') return extractPdf(filePath);
  return extractOffice(filePath, mimeType);
}
