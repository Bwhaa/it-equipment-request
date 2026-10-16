import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['node_modules', '.next', 'coverage']);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('font', () => {
  it("layout.tsx imports the bundled Noto Sans Thai exactly once", () => {
    const source = readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8');
    const imports = source.match(/import '@fontsource-variable\/noto-sans-thai\/wght\.css';/g) ?? [];
    expect(imports).toHaveLength(1);
  });

  it('no file imports next/font (the build must not need the network)', () => {
    const offenders = walk(ROOT)
      .filter((file) => /\.(ts|tsx|mts|js|mjs)$/.test(file))
      .filter((file) => !file.endsWith(`${path.sep}test${path.sep}font.test.ts`))
      .filter((file) => /from\s+['"]next\/font[/'"]|require\(['"]next\/font/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
