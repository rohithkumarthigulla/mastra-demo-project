import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { KnowledgeSource } from '../application';

/** Every `.md` file under `root`, sorted by path, with `/`-separated relative paths. */
export async function readKnowledgeFiles(root: string): Promise<KnowledgeSource[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  return Promise.all(
    files.map(async (file) => ({
      path: relative(root, file).split(sep).join('/'),
      content: await readFile(file, 'utf8'),
    })),
  );
}
