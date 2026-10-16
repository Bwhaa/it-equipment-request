'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isActivePath } from '@/lib/active-path';

const PILL = 'inline-flex h-11 items-center rounded-pill px-5 text-[15px] font-semibold transition-colors';

// With an icon the same link is a bottom-tab-bar item below md (icon above label) and a pill from md up.
const TAB =
  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-semibold transition-colors md:h-11 md:min-h-0 md:flex-row md:rounded-pill md:px-5 md:text-[15px]';

export function NavLink({ href, children, icon }: { href: string; children: ReactNode; icon?: ReactNode }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  if (icon === undefined) {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`${PILL} ${active ? 'bg-inverse text-on-inverse' : 'text-muted hover:bg-ground'}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${TAB} ${active ? 'bg-brand-tint text-approved-text md:bg-inverse md:text-on-inverse' : 'text-muted md:hover:bg-ground'}`}
    >
      <span aria-hidden="true" className="md:hidden">
        {icon}
      </span>
      {children}
    </Link>
  );
}
