import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** First statement of the file, skipping blank lines and comments. */
function firstStatement(file: string): string {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('//')) continue;
    return line;
  }
  return '';
}

const startsWithDirective = (file: string, directive: string) =>
  new RegExp(`^['"]${directive}['"]`).test(firstStatement(file));

const ROUTES = [
  'app/(app)/equipments',
  'app/(app)/equipments/[id]/request',
  'app/(app)/requests',
  'app/(app)/requests/[id]',
];

describe('route segments', () => {
  it.each(ROUTES)('%s has loading.tsx and a client-component error.tsx', (route) => {
    const loading = path.join(ROOT, route, 'loading.tsx');
    const error = path.join(ROOT, route, 'error.tsx');
    expect(existsSync(loading), `${route}/loading.tsx`).toBe(true);
    expect(existsSync(error), `${route}/error.tsx`).toBe(true);
    expect(startsWithDirective(error, 'use client'), `${route}/error.tsx must start with 'use client'`).toBe(true);
  });
});

describe('client/server boundaries', () => {
  const sources = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))].filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );

  it('finds source files to check', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it("no 'use client' file imports the server-only API client", () => {
    const offenders = sources
      .filter((file) => startsWithDirective(file, 'use client'))
      .filter((file) => /@\/lib\/api(?![-\w])/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("actions.ts starts with 'use server' and exports only async functions", () => {
    const file = path.join(ROOT, 'app/(app)/equipments/[id]/request/actions.ts');
    expect(startsWithDirective(file, 'use server')).toBe(true);
    const exports = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => /^export\s/.test(line));
    expect(exports.length).toBeGreaterThan(0);
    for (const line of exports) expect(line).toMatch(/^export async function /);
  });
});
