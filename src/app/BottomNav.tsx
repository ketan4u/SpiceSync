'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/explore',  emoji: '🔥', label: 'Discover' },
  { href: '/matches',  emoji: '💚', label: 'Matches' },
  { href: '/questions',emoji: '💬', label: 'Questions' },
  { href: '/settings', emoji: '👤', label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map(({ href, emoji, label }) => (
        <Link
          key={href}
          href={href}
          className="bottom-nav-tab"
          data-active={pathname.startsWith(href)}
          aria-current={pathname.startsWith(href) ? 'page' : undefined}
        >
          <span className="bottom-nav-tab-icon" aria-hidden>{emoji}</span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
