'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav({ items }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={path === it.href ? 'active' : ''}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
