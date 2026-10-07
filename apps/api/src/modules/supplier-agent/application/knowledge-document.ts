import { createHash } from 'node:crypto';
import { DomainError } from '../../../platform/http';
import type { KnowledgeDocumentMeta } from '../domain';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const REQUIRED = ['language', 'audience', 'domain', 'topic'] as const;
/** Sections longer than this are split on paragraphs so each chunk stays focused. */
const CHUNK_MAX_CHARS = 1500;

export class InvalidKnowledgeDocumentError extends DomainError {
  constructor(path: string, reason: string) {
    super('invalid_knowledge_document', `${path}: ${reason}`);
  }
}

export interface ParsedKnowledgeDocument {
  meta: KnowledgeDocumentMeta;
  chunks: string[];
}

/**
 * Parses one markdown help document. The hash covers the embedding model too, so switching
 * models re-embeds every document on the next ingest.
 */
export function parseKnowledgeDocument(
  path: string,
  source: string,
  embeddingModel: string,
): ParsedKnowledgeDocument {
  const match = FRONT_MATTER.exec(source);
  if (!match) throw new InvalidKnowledgeDocumentError(path, 'missing front matter');
  const fields = new Map<string, string>();
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const field = /^([A-Za-z]+):\s*(\S.*)$/.exec(line);
    if (field?.[1] && field[2]) fields.set(field[1], field[2].trim());
  }
  for (const key of REQUIRED) {
    if (!fields.get(key)) throw new InvalidKnowledgeDocumentError(path, `missing ${key}`);
  }
  const body = (match[2] ?? '').trim();
  const title = /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? path;

  return {
    meta: {
      path,
      language: fields.get('language') ?? '',
      audience: fields.get('audience') ?? '',
      domain: fields.get('domain') ?? '',
      topic: fields.get('topic') ?? '',
      title,
      contentHash: createHash('sha256')
        .update(embeddingModel)
        .update('\0')
        .update(source)
        .digest('hex'),
    },
    chunks: chunkMarkdown(title, body),
  };
}

/** One chunk per `##` section (split further if long), each prefixed with the document title. */
export function chunkMarkdown(title: string, body: string): string[] {
  const sections = body
    .replace(/^#\s+.+$/m, '')
    .split(/^(?=##\s)/m)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const section of sections) {
    let current = '';
    for (const paragraph of section.split(/\n{2,}/)) {
      if (current && current.length + paragraph.length + 2 > CHUNK_MAX_CHARS) {
        chunks.push(current);
        current = '';
      }
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    if (current) chunks.push(current);
  }
  return chunks.map((chunk) => `# ${title}\n\n${chunk}`);
}
