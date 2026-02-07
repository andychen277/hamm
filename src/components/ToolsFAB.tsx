'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const TOOLS = [
  { icon: '📦', label: '掃描進貨', href: '/receiving' },
  { icon: '🚚', label: '掃描調貨', href: '/transfer' },
  { icon: '🔍', label: '快速查詢', href: '/scan' },
  { icon: 'S', label: 'Specialized', href: '/dashboard/specialized', isSpec: true },
];

export default function ToolsFAB() {
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
          right: 80,
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {TOOLS.map((tool, i) => (
          <button
            key={tool.href}
            onClick={() => go(tool.href)}
            className="flex items-center gap-3 rounded-full px-5 h-12 shadow-lg transition-all duration-200"
            style={{
              background: 'rgb(147,51,234)',
              color: '#fff',
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
              transitionDelay: open ? `${i * 50}ms` : '0ms',
            }}
          >
            <span className={`text-base ${tool.isSpec ? 'font-bold' : ''}`} style={{ width: 24, textAlign: 'center' }}>
              {tool.icon}
            </span>
            <span className="text-sm font-medium whitespace-nowrap">{tool.label}</span>
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
          right: 80,
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)',
          background: 'rgb(147,51,234)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        <span className="text-xl" style={{ color: '#fff' }}>📦</span>
      </button>
    </>
  );
}
