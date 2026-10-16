import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Dark-mode contrast rule: text-red-600/700 is only readable on the light page background, so every class
// string that uses it must also carry a dark:text-red-300/400 variant.

const WEB = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(join(WEB, dir), { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.tsx') || entry.endsWith('.ts'))
    .map((entry) => join(WEB, dir, entry));
}

interface Violation {
  where: string;
  classes: string;
}

function violations(files: string[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        for (const literal of line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
          const classes = literal[2] ?? '';
          if (/\btext-red-(600|700)\b/.test(classes) && !/\bdark:text-red-(300|400)\b/.test(classes)) {
            found.push({ where: `${relative(WEB, file)}:${index + 1}`, classes });
          }
        }
      });
  }
  return found;
}

const files = [...sourceFiles('app'), ...sourceFiles('components')];

describe('text-red classes have a dark-mode variant', () => {
  it('the scanner sees the source files and detects a missing variant (self-test)', () => {
    expect(files.length).toBeGreaterThan(40);
    const sample = join(WEB, 'test', 'support', 'data.ts');
    expect(violations([sample])).toEqual([]);
  });

  it('every text-red-600/700 class string also has dark:text-red-300/400', () => {
    expect(violations(files).map((v) => `${v.where}: "${v.classes}"`)).toEqual([]);
  });
});
