export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');

export interface KnowledgeDocumentMeta {
  path: string;
  language: string;
  audience: string;
  domain: string;
  topic: string;
  title: string;
  contentHash: string;
}

export interface StoredKnowledgeDocument extends KnowledgeDocumentMeta {
  id: string;
}

export interface NewChunk {
  content: string;
  embedding: number[];
}

export interface RetrievedChunk {
  documentId: string;
  title: string;
  topic: string;
  content: string;
  /** Cosine distance: 0 is identical, 2 is opposite. */
  distance: number;
}

export interface KnowledgeRepository {
  listDocuments(): Promise<StoredKnowledgeDocument[]>;
  /** Inserts or replaces the document at `doc.path` together with all of its chunks. */
  saveDocument(
    doc: KnowledgeDocumentMeta,
    chunks: NewChunk[],
    embeddingModel: string,
  ): Promise<void>;
  deleteDocuments(ids: string[]): Promise<void>;
  /** Nearest chunks to `embedding` among documents for any of `audiences`. */
  searchChunks(embedding: number[], audiences: string[], limit: number): Promise<RetrievedChunk[]>;
  findDocuments(ids: string[]): Promise<StoredKnowledgeDocument[]>;
  countChunks(): Promise<number>;
}
