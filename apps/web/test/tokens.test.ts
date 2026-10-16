import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');

const TOKENS = [
  'ground', 'surface', 'ink', 'muted', 'line', 'field-line',
  'brand', 'brand-strong', 'brand-text', 'brand-tint', 'on-brand',
  'approved-bg', 'approved-text', 'pending-bg', 'pending-text',
  'danger-bg', 'danger-text', 'danger-solid', 'on-danger',
  'chip-bg', 'chip-text', 'disabled-bg', 'disabled-text', 'inverse', 'on-inverse',
];
const MUST_OVERRIDE_IN_DARK = [
  'ground', 'surface', 'ink', 'muted', 'line', 'field-line', 'brand-text', 'brand-tint',
  'approved-bg', 'approved-text', 'pending-bg', 'pending-text', 'danger-text', 'danger-bg',
  'chip-bg', 'chip-text', 'disabled-bg', 'disabled-text', 'inverse', 'on-inverse',
];

/** Contents of the first top-level `{...}` block that follows `header` (balanced braces). */
function blockAfter(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start < 0) throw new Error(`missing ${header}`);
  let depth = 0;
  const open = source.indexOf('{', start);
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced ${header}`);
}

function declarations(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*([^;]+);/g)) result[match[1]] = match[2].trim();
  return result;
}

const light = declarations(blockAfter(css, ':root'));
const darkMedia = blockAfter(css, '@media (prefers-color-scheme: dark)');
const darkOverrides = declarations(blockAfter(darkMedia, ':root'));
const dark = { ...light, ...darkOverrides };
const theme = declarations(blockAfter(css, '@theme inline'));

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((shift) => {
    const channel = ((value >> shift) & 255) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ['ink', 'surface'], ['ink', 'ground'], ['muted', 'surface'], ['muted', 'ground'],
  ['on-brand', 'brand'], ['on-brand', 'brand-strong'], ['brand-text', 'surface'], ['brand-text', 'ground'],
  ['approved-text', 'approved-bg'], ['pending-text', 'pending-bg'], ['danger-text', 'danger-bg'],
  ['danger-text', 'surface'], ['on-danger', 'danger-solid'], ['chip-text', 'chip-bg'], ['on-inverse', 'inverse'],
];
const NON_TEXT_PAIRS: [string, string][] = [['field-line', 'surface'], ['brand', 'surface'], ['brand', 'ground']];

describe('design tokens', () => {
  it.each(TOKENS)('%s is defined in :root as a hex colour and exposed to Tailwind', (name) => {
    expect(light[name]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme[`color-${name}`]).toBe(`var(--${name})`);
  });

  it.each(MUST_OVERRIDE_IN_DARK)('%s is overridden in the dark media block', (name) => {
    expect(darkOverrides[name]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('the dark block only overrides known tokens', () => {
    expect(Object.keys(darkOverrides).filter((name) => !TOKENS.includes(name))).toEqual([]);
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ])('%s: text pairs are at least 4.5:1 and non-text pairs at least 3:1', (_theme, colours) => {
    const failures = [
      ...TEXT_PAIRS.filter(([fg, bg]) => ratio(colours[fg], colours[bg]) < 4.5),
      ...NON_TEXT_PAIRS.filter(([fg, bg]) => ratio(colours[fg], colours[bg]) < 3),
    ];
    expect(failures).toEqual([]);
  });

  it('the theme exposes the font and the three radii', () => {
    expect(theme['font-sans'].startsWith("'Noto Sans Thai Variable'")).toBe(true);
    expect(theme['radius-card']).toBe('20px');
    expect(theme['radius-field']).toBe('14px');
    expect(theme['radius-pill']).toBe('9999px');
  });
});
