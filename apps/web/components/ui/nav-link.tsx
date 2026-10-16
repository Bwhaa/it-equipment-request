'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isActivePath } from '@/lib/active-path';

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex h-11 items-center rounded-pill px-5 text-[15px] font-semibold transition-colors ${active ? 'bg-inverse text-on-inverse' : 'text-muted hover:bg-ground'}`}
    >
      {children}
    </Link>
  );
}
