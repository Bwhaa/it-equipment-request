import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const RAW_PALETTE =
  /\b(?:bg|text|border|ring|outline|divide|fill|stroke|from|to|via|decoration|placeholder|accent|caret|shadow)-(?:white|black|(?:red|green|neutral|gray|slate|zinc|stone|amber|yellow|orange|blue|emerald|lime|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?)\b/;

// Shrinks in U1-U3; must be empty after U3. A file leaves the list in the commit that removes its raw palette classes.
const NOT_YET_MIGRATED: string[] = [
  'app/(app)/admin/equipments/[id]/edit/page.tsx',
  'app/(app)/admin/equipments/equipment-form.tsx',
  'app/(app)/admin/equipments/page.tsx',
  'app/(app)/admin/requests/[id]/page.tsx',
  'app/(app)/admin/requests/[id]/review-panel.tsx',
  'app/(app)/admin/requests/page.tsx',
  'app/(app)/equipments/[id]/request/page.tsx',
  'app/(app)/equipments/[id]/request/request-form.tsx',
  'app/(app)/equipments/page.tsx',
  'app/(app)/loading.tsx',
  'app/(app)/not-found.tsx',
  'app/(app)/requests/[id]/page.tsx',
  'app/(app)/requests/page.tsx',
  'app/(auth)/login/login-form.tsx',
  'app/(auth)/login/page.tsx',
  'app/error.tsx',
];

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = ['app', 'components']
  .flatMap((dir) => walk(path.join(ROOT, dir)))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => path.relative(ROOT, file).split(path.sep).join('/'));

const hasRaw = (relative: string) => RAW_PALETTE.test(readFileSync(path.join(ROOT, relative), 'utf8'));

describe('raw palette classes', () => {
  it('finds source files to scan', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('does not flag transparent / inherit / currentColor utilities', () => {
    for (const ok of ['bg-transparent', 'text-inherit', 'border-current', 'bg-surface', 'text-muted', 'border-field-line']) {
      expect(RAW_PALETTE.test(ok)).toBe(false);
    }
    for (const bad of ['bg-white', 'text-black', 'text-neutral-600', 'dark:bg-neutral-800', 'border-red-400', 'ring-blue-500']) {
      expect(RAW_PALETTE.test(bad)).toBe(true);
    }
  });

  it('no file outside NOT_YET_MIGRATED uses a raw palette class', () => {
    const offenders = sources.filter((file) => !NOT_YET_MIGRATED.includes(file) && hasRaw(file));
    expect(offenders).toEqual([]);
  });

  it('every file in NOT_YET_MIGRATED still uses one (the list cannot go stale)', () => {
    const stale = NOT_YET_MIGRATED.filter((file) => !sources.includes(file) || !hasRaw(file));
    expect(stale).toEqual([]);
  });
});
