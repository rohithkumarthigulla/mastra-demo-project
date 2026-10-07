import { randomUUID } from 'node:crypto';
import type {
  KnowledgeDocumentMeta,
  KnowledgeRepository,
  NewChunk,
  RetrievedChunk,
  StoredKnowledgeDocument,
} from '../domain';

interface StoredChunk extends NewChunk {
  documentId: string;
  position: number;
  embeddingModel: string;
}

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  readonly documents: StoredKnowledgeDocument[] = [];
  readonly chunks: StoredChunk[] = [];
  /** How many times each path was (re)written; lets tests prove unchanged files are skipped. */
  readonly writes = new Map<string, number>();

  listDocuments(): Promise<StoredKnowledgeDocument[]> {
    return Promise.resolve(this.documents.map((doc) => ({ ...doc })));
  }

  findDocuments(ids: string[]): Promise<StoredKnowledgeDocument[]> {
    return Promise.resolve(
      this.documents.filter((doc) => ids.includes(doc.id)).map((doc) => ({ ...doc })),
    );
  }

  saveDocument(
    doc: KnowledgeDocumentMeta,
    chunks: NewChunk[],
    embeddingModel: string,
  ): Promise<void> {
    let stored = this.documents.find((existing) => existing.path === doc.path);
    if (stored) Object.assign(stored, doc);
    else {
      stored = { id: randomUUID(), ...doc };
      this.documents.push(stored);
    }
    const id = stored.id;
    this.removeChunks([id]);
    chunks.forEach((chunk, position) =>
      this.chunks.push({ ...chunk, documentId: id, position, embeddingModel }),
    );
    this.writes.set(doc.path, (this.writes.get(doc.path) ?? 0) + 1);
    return Promise.resolve();
  }

  deleteDocuments(ids: string[]): Promise<void> {
    this.removeChunks(ids);
    for (const id of ids) {
      const index = this.documents.findIndex((doc) => doc.id === id);
      if (index >= 0) this.documents.splice(index, 1);
    }
    return Promise.resolve();
  }

  searchChunks(embedding: number[], audiences: string[], limit: number): Promise<RetrievedChunk[]> {
    const results = this.chunks.flatMap((chunk) => {
      const doc = this.documents.find((d) => d.id === chunk.documentId);
      if (!doc || !audiences.includes(doc.audience)) return [];
      const similarity = chunk.embedding.reduce((sum, v, i) => sum + v * (embedding[i] ?? 0), 0);
      return [
        {
          documentId: doc.id,
          title: doc.title,
          topic: doc.topic,
          content: chunk.content,
          distance: 1 - similarity,
        },
      ];
    });
    return Promise.resolve(results.sort((a, b) => a.distance - b.distance).slice(0, limit));
  }

  countChunks(): Promise<number> {
    return Promise.resolve(this.chunks.length);
  }

  private removeChunks(documentIds: string[]): void {
    for (let i = this.chunks.length - 1; i >= 0; i -= 1) {
      if (documentIds.includes(this.chunks[i]?.documentId ?? '')) this.chunks.splice(i, 1);
    }
  }
}
