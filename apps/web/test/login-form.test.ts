import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import { LoginForm } from '@/app/(auth)/login/login-form';

const html = renderToString(createElement(LoginForm));

function tagOf(markup: string, id: string): string {
  const match = new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`).exec(markup);
  if (!match) throw new Error(`no <input id="${id}"> in the rendered form`);
  return match[0];
}

describe('login form markup (a native submit before hydration must not leak credentials)', () => {
  const email = tagOf(html, 'email');
  const password = tagOf(html, 'password');

  it('the email and password inputs have NO name attribute', () => {
    expect(email).not.toMatch(/\sname=/);
    expect(password).not.toMatch(/\sname=/);
  });

  it('the password input keeps type="password"', () => {
    expect(password).toMatch(/type="password"/);
    expect(email).toMatch(/type="email"/);
  });

  it('both inputs keep their autocomplete tokens', () => {
    expect(email).toMatch(/autoComplete="username"|autocomplete="username"/i);
    expect(password).toMatch(/autoComplete="current-password"|autocomplete="current-password"/i);
  });

  it('every input has a matching <label for>', () => {
    expect(html).toMatch(/<label[^>]*\bfor="email"/);
    expect(html).toMatch(/<label[^>]*\bfor="password"/);
  });

  it('the <form> has no action attribute and no method attribute', () => {
    const form = /<form[^>]*>/.exec(html)?.[0] ?? '';
    expect(form).not.toMatch(/\saction=/);
    expect(form).not.toMatch(/\smethod=/);
  });
});
