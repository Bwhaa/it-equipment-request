import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { findFiles, importDefault, relativeToApp } from './support/discover';
import { render } from './support/render';

const loadingFiles = findFiles('loading.tsx');

describe('loading.tsx semantics', () => {
  it('finds every loading.tsx', () => {
    expect(loadingFiles.length).toBeGreaterThanOrEqual(10);
  });

  it.each(loadingFiles.map((file) => [relativeToApp(file), file]))(
    '%s: root role="status", an sr-only text first, aria-busy kept, no aria-label on a div',
    async (_name, file) => {
      const Loading = await importDefault<Record<string, never>>(file as string);
      const html = render(createElement(Loading, {}));
      const root = /^<[a-z]+[^>]*>/.exec(html)?.[0] ?? '';
      expect(root).toContain('role="status"');
      expect(root).toContain('aria-busy="true"');
      expect(html).toMatch(/^<[a-z]+[^>]*>\s*<span class="sr-only">กำลังโหลด…<\/span>/);
      expect(html).not.toMatch(/<div[^>]*aria-label=/);
    },
  );
});
