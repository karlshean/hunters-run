'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Work Orders', href: '/work-orders', icon: '🔧' },
  { name: 'Payments', href: '/payments', icon: '💳' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-900 text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold">Hunters Run</h1>
        <p className="text-gray-300 text-sm">Property Management</p>
      </div>
      
      <nav className="mt-6">
        <div className="px-3">
          {navigation.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center px-3 py-2 rounded-md text-sm font-medium mb-1 transition-colors',
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
      
      <div className="absolute bottom-0 w-64 p-6 border-t border-gray-700">
        <div className="text-xs text-gray-400">
          <div>Demo Mode</div>
          <div className="font-mono text-xs mt-1">
            Org: ...{process.env.NEXT_PUBLIC_ORG_ID?.slice(-8)}
          </div>
        </div>
      </div>
    </div>
  );
}