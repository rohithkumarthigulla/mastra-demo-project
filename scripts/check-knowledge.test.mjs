import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..', 'docs', 'knowledge');

const EXPECTED_FILES = [
  'platform/assistant-and-confirmation.md',
  'platform/equipment-categories.md',
  'platform/glossary.md',
  'platform/how-rentals-work.md',
  'platform/pricing-and-quotes.md',
  'supplier/listings/creating-a-listing.md',
  'supplier/listings/listings.md',
  'supplier/listings/publishing.md',
  'supplier/machines/adding-a-machine.md',
  'supplier/machines/availability.md',
  'supplier/machines/blocking.md',
  'supplier/machines/editing-a-machine.md',
  'supplier/machines/fleet.md',
  'supplier/machines/specifications.md',
  'supplier/rentals/lifecycle.md',
  'supplier/rentals/rentals.md',
  'supplier/requests/declining.md',
  'supplier/requests/requests.md',
  'supplier/yards/yards.md',
];

const KEYS = ['language', 'audience', 'domain', 'topic', 'sourceType'];
const DOMAINS = [
  'RENTALS',
  'PRICING',
  'LISTINGS',
  'MACHINES',
  'YARDS',
  'REQUESTS',
  'PAYMENTS',
  'VERIFICATION',
  'EQUIPMENT',
  'ASSISTANT',
];
const TOPIC = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

function parse(source) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  assert.ok(match, 'file must start with a --- front matter block');
  const meta = {};
  for (const line of match[1].split('\n')) {
    const field = /^([A-Za-z]+): (\S.*)$/.exec(line);
    assert.ok(field, `unexpected front matter line: ${line}`);
    assert.ok(!(field[1] in meta), `duplicate key: ${field[1]}`);
    meta[field[1]] = field[2];
  }
  return { meta, body: match[2] };
}

const files = markdownFiles(root).map((path) => relative(root, path).split('\\').join('/'));

test('knowledge folder holds exactly the expected help documents', () => {
  assert.deepEqual([...files].sort(), EXPECTED_FILES);
});

const topics = new Map();

for (const file of files) {
  test(`${file} has valid front matter and length`, () => {
    const { meta, body } = parse(readFileSync(join(root, file), 'utf8'));

    assert.deepEqual(Object.keys(meta).sort(), [...KEYS].sort());
    assert.equal(meta.language, 'en');
    assert.equal(meta.audience, file.startsWith('platform/') ? 'ALL' : 'SUPPLIER');
    assert.ok(DOMAINS.includes(meta.domain), `unknown domain: ${meta.domain}`);
    assert.match(meta.topic, TOPIC);
    assert.equal(meta.sourceType, 'internal');

    const owner = topics.get(meta.topic);
    assert.equal(owner, undefined, `topic ${meta.topic} is also used by ${owner}`);
    topics.set(meta.topic, file);

    const words = body.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
    assert.ok(words >= 200 && words <= 500, `${words} words; expected 200–500`);
  });
}
