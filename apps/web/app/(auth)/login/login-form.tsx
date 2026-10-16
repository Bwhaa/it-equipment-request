'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { retryAfterMinutes } from '@/lib/retry-after';
import { ROLE_HOME, isRole } from '@/lib/roles';
import { FORM_INPUT_CLASS } from '@/lib/ui-classes';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readRole(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('user' in body)) return undefined;
  const user = body.user;
  if (typeof user !== 'object' || user === null || !('role' in user)) return undefined;
  return isRole(user.role) ? ROLE_HOME[user.role] : undefined;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [banner, setBanner] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(undefined);

    const nextEmailError = EMAIL_SHAPE.test(email.trim()) ? undefined : 'กรุณากรอกอีเมลให้ถูกต้อง';
    const nextPasswordError = password.length >= 6 ? undefined : 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (response.ok) {
        const home = readRole(await response.json());
        if (home) {
          router.replace(home);
          router.refresh();
          return;
        }
        setBanner('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่');
      } else if (response.status === 401) {
        setBanner('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (response.status === 429) {
        const minutes = retryAfterMinutes(response.headers.get('Retry-After'));
        setBanner(`พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${minutes} นาที`);
      } else if (response.status === 400) {
        setBanner('กรุณากรอกข้อมูลให้ถูกต้อง');
      } else {
        setBanner('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่');
      }
    } catch {
      setBanner('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่');
    } finally {
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    // The inputs deliberately have no `name`: a native submit before hydration (or without JS) is a GET that
    // would put the credentials in the URL; without names it sends nothing. The state below holds the values.
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {banner && (
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">
          {banner}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          อีเมล
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
          className={FORM_INPUT_CLASS}
        />
        {emailError && (
          <p id="email-error" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {emailError}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          รหัสผ่าน
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? 'password-error' : undefined}
          className={FORM_INPUT_CLASS}
        />
        {passwordError && (
          <p id="password-error" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {passwordError}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
