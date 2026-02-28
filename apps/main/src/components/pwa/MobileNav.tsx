'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Library, FolderOpen, Heart, User } from 'lucide-react';

const navItems = [
  {
    href: '/app',
    label: 'Library',
    icon: Library,
    exact: true,
  },
  {
    href: '/app/collections',
    label: 'Collections',
    icon: FolderOpen,
    exact: false,
  },
  {
    href: '/app/favorites',
    label: 'Favorites',
    icon: Heart,
    exact: false,
  },
  {
    href: '/app/profile',
    label: 'Profile',
    icon: User,
    exact: false,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#08080c] border-t border-white/10 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors ${
                active
                  ? 'text-[#FFA500]'
                  : 'text-white/60 active:text-white/80'
              }`}
            >
              <Icon
                className={`w-6 h-6 ${active ? 'fill-current' : ''}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="mt-1 text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
