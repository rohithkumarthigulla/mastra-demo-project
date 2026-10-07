import { Inject, Injectable } from '@nestjs/common';
import { asc, cosineDistance, count, eq, inArray, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import { knowledgeChunks, knowledgeDocuments } from '../../../platform/database/schema';
import type {
  KnowledgeDocumentMeta,
  KnowledgeRepository,
  NewChunk,
  RetrievedChunk,
  StoredKnowledgeDocument,
} from '../domain';

const documentColumns = {
  id: knowledgeDocuments.id,
  path: knowledgeDocuments.path,
  language: knowledgeDocuments.language,
  audience: knowledgeDocuments.audience,
  domain: knowledgeDocuments.domain,
  topic: knowledgeDocuments.topic,
  title: knowledgeDocuments.title,
  contentHash: knowledgeDocuments.contentHash,
};

@Injectable()
export class DrizzleKnowledgeRepository implements KnowledgeRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  listDocuments(): Promise<StoredKnowledgeDocument[]> {
    return this.db
      .select(documentColumns)
      .from(knowledgeDocuments)
      .orderBy(asc(knowledgeDocuments.path));
  }

  findDocuments(ids: string[]): Promise<StoredKnowledgeDocument[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db
      .select(documentColumns)
      .from(knowledgeDocuments)
      .where(inArray(knowledgeDocuments.id, ids));
  }

  async saveDocument(
    doc: KnowledgeDocumentMeta,
    chunks: NewChunk[],
    embeddingModel: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(knowledgeDocuments)
        .values(doc)
        .onConflictDoUpdate({
          target: knowledgeDocuments.path,
          set: { ...doc, updatedAt: sql`now()` },
        })
        .returning({ id: knowledgeDocuments.id });
      if (!row) throw new Error(`could not save knowledge document ${doc.path}`);
      await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, row.id));
      if (chunks.length > 0) {
        await tx.insert(knowledgeChunks).values(
          chunks.map((chunk, position) => ({
            documentId: row.id,
            position,
            content: chunk.content,
            embedding: chunk.embedding,
            embeddingModel,
          })),
        );
      }
    });
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.delete(knowledgeDocuments).where(inArray(knowledgeDocuments.id, ids));
  }

  async searchChunks(
    embedding: number[],
    audiences: string[],
    limit: number,
  ): Promise<RetrievedChunk[]> {
    const distance = cosineDistance(knowledgeChunks.embedding, embedding);
    const rows = await this.db
      .select({
        documentId: knowledgeDocuments.id,
        title: knowledgeDocuments.title,
        topic: knowledgeDocuments.topic,
        content: knowledgeChunks.content,
        distance: sql<number>`${distance}`.mapWith(Number),
      })
      .from(knowledgeChunks)
      .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
      .where(inArray(knowledgeDocuments.audience, audiences))
      .orderBy(distance)
      .limit(limit);
    return rows;
  }

  async countChunks(): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(knowledgeChunks);
    return row?.total ?? 0;
  }
}
