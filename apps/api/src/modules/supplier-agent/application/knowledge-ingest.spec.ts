import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { FakeProvider } from '../../ai/infrastructure';
import { readKnowledgeFiles } from '../infrastructure/knowledge-files';
import { InMemoryKnowledgeRepository } from '../testing';
import { chunkMarkdown, parseKnowledgeDocument } from './knowledge-document';
import { ingestKnowledge } from './knowledge-ingest';

// dist/modules/supplier-agent/application → repository root
const KNOWLEDGE_ROOT = resolve(__dirname, '../../../../../../docs/knowledge');

describe('knowledge ingest', () => {
  it('is idempotent and re-chunks only changed documents', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const ai = new FakeProvider();
    const sources = await readKnowledgeFiles(KNOWLEDGE_ROOT);
    assert.ok(sources.length >= 19, `expected the help documents, found ${sources.length}`);

    const first = await ingestKnowledge(repo, ai, sources);
    assert.equal(first.added, sources.length);
    const documents = repo.documents.length;
    const chunks = repo.chunks.length;
    assert.ok(chunks > documents, 'documents are split into several chunks');

    const second = await ingestKnowledge(repo, ai, sources);
    assert.deepEqual(second, {
      added: 0,
      updated: 0,
      unchanged: sources.length,
      removed: 0,
      chunks: 0,
    });
    assert.equal(repo.documents.length, documents);
    assert.equal(repo.chunks.length, chunks);

    const [edited, ...rest] = sources;
    assert.ok(edited);
    const changed = [
      { ...edited, content: `${edited.content}\n\n## Extra\n\nA new paragraph.\n` },
      ...rest,
    ];
    const writesBefore = new Map(repo.writes);
    const third = await ingestKnowledge(repo, ai, changed);
    assert.equal(third.updated, 1);
    assert.equal(third.unchanged, sources.length - 1);
    for (const [path, count] of repo.writes) {
      assert.equal(count, (writesBefore.get(path) ?? 0) + (path === edited.path ? 1 : 0), path);
    }
    assert.equal(repo.chunks.length, chunks + 1);

    const fourth = await ingestKnowledge(repo, ai, rest);
    assert.equal(fourth.removed, 1);
    assert.equal(repo.documents.length, documents - 1);
    assert.ok(repo.documents.every((doc) => doc.path !== edited.path));
    assert.ok(
      repo.chunks.every((chunk) => repo.documents.some((doc) => doc.id === chunk.documentId)),
    );
  });

  it('reads front matter and title, and rejects documents without it', () => {
    const source =
      '---\nlanguage: en\naudience: SUPPLIER\ndomain: MACHINES\ntopic: machines.x\n---\n\n# Title\n\nBody\n';
    const { meta, chunks } = parseKnowledgeDocument('a.md', source, 'm');
    assert.equal(meta.title, 'Title');
    assert.equal(meta.audience, 'SUPPLIER');
    assert.deepEqual(chunks, ['# Title\n\nBody']);
    assert.notEqual(
      meta.contentHash,
      parseKnowledgeDocument('a.md', source, 'other').meta.contentHash,
    );
    assert.throws(() => parseKnowledgeDocument('b.md', '# No front matter', 'm'), {
      code: 'invalid_knowledge_document',
    });
  });

  it('splits on sections and keeps chunks bounded', () => {
    const long = Array.from({ length: 10 }, (_, i) => `Paragraph ${i} ${'word '.repeat(60)}`).join(
      '\n\n',
    );
    const chunks = chunkMarkdown('T', `# T\n\nIntro\n\n## A\n\n${long}\n\n## B\n\nShort`);
    assert.equal(chunks[0], '# T\n\nIntro');
    assert.equal(chunks.at(-1), '# T\n\n## B\n\nShort');
    assert.ok(chunks.length > 3);
    assert.ok(chunks.every((chunk) => chunk.length <= 1500 + 10));
  });
});
