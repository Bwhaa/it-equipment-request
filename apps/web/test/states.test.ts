import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { findFiles, importDefault, relativeToApp } from './support/discover';
import type { BoundaryProps } from './support/discover';
import { render } from './support/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/' }));

const loadingFiles = findFiles('loading.tsx');
const errorFiles = findFiles('error.tsx');

describe('loading.tsx states', () => {
  it('finds every loading.tsx (the number below must follow the app)', () => {
    expect(loadingFiles.length).toBeGreaterThanOrEqual(10);
    expect(loadingFiles.map(relativeToApp)).toMatchSnapshot();
  });

  it.each(loadingFiles.map((file) => [relativeToApp(file), file]))('%s renders a busy placeholder', async (_name, file) => {
    const Loading = await importDefault<Record<string, never>>(file as string);
    const html = render(createElement(Loading, {}));
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatchSnapshot();
  });
});

describe('error.tsx boundaries', () => {
  it('finds every error.tsx including app/error.tsx', () => {
    expect(errorFiles.length).toBeGreaterThanOrEqual(10);
    expect(errorFiles.map(relativeToApp)).toContain('error.tsx');
    expect(errorFiles.map(relativeToApp)).toMatchSnapshot();
  });

  it.each(errorFiles.map((file) => [relativeToApp(file), file]))(
    '%s shows a retry button and never the error text',
    async (_name, file) => {
      const Boundary = await importDefault<BoundaryProps>(file as string);
      const html = render(createElement(Boundary, { error: new Error('SECRET-ERROR-DETAIL'), reset: vi.fn() }));
      expect(html).toMatch(/<button[^>]*>ลองใหม่<\/button>/);
      expect(html).toContain('role="alert"');
      expect(html).not.toContain('SECRET-ERROR-DETAIL');
      expect(html).toMatchSnapshot();
    },
  );
});
