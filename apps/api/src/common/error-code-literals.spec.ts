import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ERROR_STATUS } from './error-codes';

// CLAUDE.md: error codes written as string literals must be keys of ERROR_STATUS. Nest accepts any
// `{ code: string }`, so a typo would only surface at runtime (the filter falls back to VALIDATION_ERROR).
// Every quoted string inside a `code:` expression is checked, including both branches of a conditional.

const SRC = join(__dirname, '..');

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Every quoted string of every `code: <expression>` property assignment. */
function codeLiterals(text: string): string[] {
  const literals: string[] = [];
  for (const property of withoutComments(text).matchAll(/\bcode:\s*([^,}]+)/g)) {
    for (const quoted of (property[1] ?? '').matchAll(/(['"])((?:(?!\1).)*)\1/g)) {
      if (quoted[2] !== undefined) literals.push(quoted[2]);
    }
  }
  return literals;
}

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.spec.ts'))
    .map((entry) => join(SRC, entry));
}

const found = sourceFiles().flatMap((file) =>
  codeLiterals(readFileSync(file, 'utf8')).map((literal) => ({ file: relative(SRC, file), literal })),
);

describe('error code literals', () => {
  it('the extractor returns every string of a conditional expression (self-test)', () => {
    expect(codeLiterals(`code: x ? 'A' : "B"`)).toEqual(['A', 'B']);
    expect(codeLiterals(`throw new X({ code: cond\n ? 'A'\n : 'B', message: 'm' })`)).toEqual(['A', 'B']);
    expect(codeLiterals(`// code: 'COMMENTED'\nconst a = { code: variable }`)).toEqual([]);
    expect(codeLiterals(`{ rawCode: 'IGNORED', statusCode: 'IGNORED' }`)).toEqual([]);
  });

  it('finds the literals of the application (a silent scan failure must fail, not pass)', () => {
    expect(found.length).toBeGreaterThan(15);
  });

  it('every literal is a key of ERROR_STATUS', () => {
    const unknown = found.filter(({ literal }) => !Object.hasOwn(ERROR_STATUS, literal)).map(({ file, literal }) => `${file}: ${literal}`);
    expect(unknown).toEqual([]);
  });
});
