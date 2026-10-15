'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded px-3 py-1 text-sm ${active ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
    >
      {children}
    </Link>
  );
}
