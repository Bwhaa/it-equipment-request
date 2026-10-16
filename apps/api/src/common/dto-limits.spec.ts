import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// PERMANENT guard (CLAUDE.md hard rule): every @IsInt() has a @Max(...) and every @IsString() has a length limit,
// so out-of-range or oversized input is a 400, never a 500. There is deliberately NO allowlist.

const SRC = join(__dirname, '..');

interface Property {
  file: string;
  name: string;
  decorators: string;
}

function dtoFiles(): string[] {
  const dtos = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /(^|[\\/])dto[\\/][^\\/]+\.dto\.ts$/.test(entry))
    .map((entry) => join(SRC, entry));
  return [...dtos, join(SRC, 'common', 'pagination.ts')];
}

/** A property declaration is a two-space-indented `name!: type` / `name?: type` / `name = value` line; the
 * decorator lines directly above it belong to it. */
function parseProperties(file: string, text: string): Property[] {
  const properties: Property[] = [];
  let pending: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@')) {
      pending.push(trimmed);
    } else if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    } else {
      const match = /^ {2}(\w+)[!?]?\s*(?::|=)/.exec(line);
      if (match?.[1] !== undefined) properties.push({ file, name: match[1], decorators: pending.join(' ') });
      pending = [];
    }
  }
  return properties;
}

const properties = dtoFiles().flatMap((file) =>
  parseProperties(relative(SRC, file), readFileSync(file, 'utf8')),
);

describe('DTO limits guard', () => {
  it('parses the DTO property declarations (a silent parse failure must fail, not pass)', () => {
    expect(properties.length).toBeGreaterThan(15);
  });

  it('every @IsInt() property has a @Max(...)', () => {
    const missing = properties
      .filter((p) => p.decorators.includes('@IsInt('))
      .filter((p) => !p.decorators.includes('@Max('))
      .map((p) => `${p.file}: ${p.name}`);
    expect(missing).toEqual([]);
  });

  it('every @IsString() property has @MaxLength(...) or @Length(...)', () => {
    const missing = properties
      .filter((p) => p.decorators.includes('@IsString('))
      .filter((p) => !p.decorators.includes('@MaxLength(') && !p.decorators.includes('@Length('))
      .map((p) => `${p.file}: ${p.name}`);
    expect(missing).toEqual([]);
  });

  it('the parser really sees the decorators it checks (sanity)', () => {
    const page = properties.find((p) => p.name === 'page');
    expect(page?.decorators).toContain('@Max(');
    expect(properties.filter((p) => p.decorators.includes('@IsInt(')).length).toBeGreaterThanOrEqual(5);
    expect(properties.filter((p) => p.decorators.includes('@IsString(')).length).toBeGreaterThanOrEqual(7);
  });
});
