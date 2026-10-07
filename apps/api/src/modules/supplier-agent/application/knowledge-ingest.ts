import type { AiProvider } from '../../ai/domain';
import type { KnowledgeRepository } from '../domain';
import { parseKnowledgeDocument } from './knowledge-document';

export interface KnowledgeSource {
  /** Path relative to the knowledge root, with `/` separators. */
  path: string;
  content: string;
}

export interface IngestSummary {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  chunks: number;
}

/**
 * Brings the knowledge tables in line with `sources`: unchanged files (same content hash) are
 * skipped, changed or new files are re-chunked and re-embedded, and files no longer present are
 * deleted. Running it twice in a row changes nothing.
 */
export async function ingestKnowledge(
  repo: KnowledgeRepository,
  ai: AiProvider,
  sources: KnowledgeSource[],
): Promise<IngestSummary> {
  const existing = new Map((await repo.listDocuments()).map((doc) => [doc.path, doc]));
  const summary: IngestSummary = { added: 0, updated: 0, unchanged: 0, removed: 0, chunks: 0 };

  for (const source of sources) {
    const parsed = parseKnowledgeDocument(source.path, source.content, ai.embeddingModel);
    const stored = existing.get(source.path);
    existing.delete(source.path);
    if (stored?.contentHash === parsed.meta.contentHash) {
      summary.unchanged += 1;
      continue;
    }
    const embeddings = await ai.embed(parsed.chunks, 'document');
    const chunks = parsed.chunks.map((content, i) => ({ content, embedding: embeddings[i] ?? [] }));
    await repo.saveDocument(parsed.meta, chunks, ai.embeddingModel);
    summary.chunks += chunks.length;
    if (stored) summary.updated += 1;
    else summary.added += 1;
  }

  const removed = [...existing.values()].map((doc) => doc.id);
  if (removed.length > 0) await repo.deleteDocuments(removed);
  summary.removed = removed.length;
  return summary;
}
