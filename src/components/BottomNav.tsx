'use client';

import Link from 'next/link';

const tabs = [
  { key: 'dashboard', label: '總覽', icon: '🏠', href: '/dashboard' },
  { key: 'ask', label: '提問', icon: '💬', href: '/ask' },
  { key: 'reports', label: '報表', icon: '📊', href: '/reports' },
  { key: 'questions', label: '題庫', icon: '💡', href: '/questions' },
];

export default function BottomNav({ active }: { active: string }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around h-16 border-t z-50"
      style={{
        background: 'var(--color-bg-card)',
        borderColor: 'var(--color-bg-card-alt)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="flex flex-col items-center gap-0.5 py-1.5 px-4 transition-opacity"
            style={{ opacity: isActive ? 1 : 0.5 }}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[11px] font-medium" style={{
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
