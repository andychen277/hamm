'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const ACTIONS = [
  { icon: '📋', label: '新增客訂', href: '/orders/create' },
  { icon: '🔧', label: '新增維修', href: '/repairs/create' },
  { icon: '💰', label: '匯款需求', href: '/remittance/create' },
  { icon: '📝', label: '新增任務', href: '/todo/create' },
];

export default function CreateFAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const toggle = useCallback(() => setOpen(prev => !prev), []);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Menu items */}
      <div
        className="fixed z-40 flex flex-col-reverse gap-2"
        style={{
          right: 20,
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {ACTIONS.map((action, i) => (
          <button
            key={action.href}
            onClick={() => go(action.href)}
            className="flex items-center gap-3 rounded-full px-5 h-12 shadow-lg transition-all duration-200"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
              transitionDelay: open ? `${i * 50}ms` : '0ms',
            }}
          >
            <span className="text-base" style={{ width: 24, textAlign: 'center' }}>
              {action.icon}
            </span>
            <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
          </button>
        ))}
      </div>

      {/* FAB button */}
      <button
        onClick={toggle}
        className="fixed z-40 flex items-center justify-center rounded-full transition-transform duration-200 active:scale-90"
        style={{
          width: 52,
          height: 52,
          right: 20,
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)',
          background: 'var(--color-accent)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </>
  );
}
