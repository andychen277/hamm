'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const TOOLS = [
  { icon: '📦', label: '掃描進貨', href: '/receiving' },
  { icon: '🚚', label: '掃描調貨', href: '/transfer' },
  { icon: '🔍', label: '快速查詢', href: '/scan' },
  { icon: 'S', label: 'Specialized', href: '/dashboard/specialized', isSpec: true },
];

const CREATES = [
  { icon: '📋', label: '新增客訂', href: '/orders/create' },
  { icon: '🔧', label: '新增維修', href: '/repairs/create' },
  { icon: '💰', label: '匯款需求', href: '/remittance/create' },
  { icon: '📝', label: '新增任務', href: '/todo/create' },
];

type PopupType = 'tools' | 'create' | null;

export default function BottomNav({ active }: { active: string }) {
  const [openPopup, setOpenPopup] = useState<PopupType>(null);
  const router = useRouter();

  // Close popup on page navigation
  useEffect(() => { setOpenPopup(null); }, [active]);

  const togglePopup = useCallback((type: PopupType) => {
    setOpenPopup(prev => prev === type ? null : type);
  }, []);

  const go = useCallback((href: string) => {
    setOpenPopup(null);
    router.push(href);
  }, [router]);

  const items = openPopup === 'tools' ? TOOLS : openPopup === 'create' ? CREATES : [];
  const popupTitle = openPopup === 'tools' ? '進出貨工具' : '快速建立';

  return (
    <>
      {/* Backdrop */}
      {openPopup && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpenPopup(null)}
        />
      )}

      {/* Popup menu — 2x2 grid, big & tappable */}
      {openPopup && (
        <div
          className="fixed left-3 right-3 z-50 rounded-2xl overflow-hidden"
          style={{
            bottom: 'calc(64px + env(safe-area-inset-bottom) + 8px)',
            background: 'var(--color-bg-card)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <p className="text-[11px] font-medium px-4 pt-3 pb-1" style={{ color: 'var(--color-text-muted)' }}>
            {popupTitle}
          </p>
          <div className="grid grid-cols-2 gap-1.5 p-3">
            {items.map((item, i) => (
              <button
                key={item.href}
                onClick={() => go(item.href)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 active:scale-95 transition-all duration-150"
                style={{
                  background: 'var(--color-bg-card-alt)',
                  opacity: openPopup ? 1 : 0,
                  transform: openPopup ? 'translateY(0)' : 'translateY(8px)',
                  transitionDelay: `${i * 40}ms`,
                }}
              >
                <span className={`text-2xl ${'isSpec' in item && item.isSpec ? 'font-bold' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ask Bubble — floating chat widget */}
      {!openPopup && active !== 'ask' && (
        <Link
          href="/ask"
          className="fixed z-30 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{
            width: 48,
            height: 48,
            right: 16,
            bottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            boxShadow: '0 3px 12px rgba(99,102,241,0.4)',
          }}
        >
          <span className="text-xl">💬</span>
        </Link>
      )}

      {/* Nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex items-center justify-around h-16 border-t z-50"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-bg-card-alt)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 總覽 */}
        <Link
          href="/dashboard"
          className="flex flex-col items-center gap-0.5 py-1.5 px-4 transition-opacity"
          style={{ opacity: active === 'dashboard' ? 1 : 0.5 }}
        >
          <span className="text-xl">🏠</span>
          <span className="text-[11px] font-medium" style={{
            color: active === 'dashboard' ? 'var(--color-accent)' : 'var(--color-text-muted)',
          }}>
            總覽
          </span>
        </Link>

        {/* 進出貨 (popup) */}
        <button
          onClick={() => togglePopup('tools')}
          className="flex flex-col items-center gap-0.5 py-1.5 px-4 transition-opacity"
          style={{ opacity: openPopup === 'tools' ? 1 : 0.5 }}
        >
          <span className="text-xl">📦</span>
          <span className="text-[11px] font-medium" style={{
            color: openPopup === 'tools' ? 'rgb(147,51,234)' : 'var(--color-text-muted)',
          }}>
            進出貨
          </span>
        </button>

        {/* 建立 (popup) */}
        <button
          onClick={() => togglePopup('create')}
          className="flex flex-col items-center gap-0.5 py-1.5 px-4 transition-opacity"
          style={{ opacity: openPopup === 'create' ? 1 : 0.5 }}
        >
          <span className="text-xl">📝</span>
          <span className="text-[11px] font-medium" style={{
            color: openPopup === 'create' ? 'var(--color-accent)' : 'var(--color-text-muted)',
          }}>
            建立
          </span>
        </button>

        {/* 報表 */}
        <Link
          href="/reports"
          className="flex flex-col items-center gap-0.5 py-1.5 px-4 transition-opacity"
          style={{ opacity: active === 'reports' ? 1 : 0.5 }}
        >
          <span className="text-xl">📊</span>
          <span className="text-[11px] font-medium" style={{
            color: active === 'reports' ? 'var(--color-accent)' : 'var(--color-text-muted)',
          }}>
            報表
          </span>
        </Link>
      </nav>
    </>
  );
}
