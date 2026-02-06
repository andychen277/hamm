'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramId.trim()) {
      setErrorMsg('請輸入 Telegram User ID');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/telegram-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: telegramId.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setErrorMsg(data.error || '登入失敗');
      }
    } catch {
      setErrorMsg('網路錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Logo & title */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">🐷</div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Hamm</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>277 Bicycle 商業智慧平台</p>
      </div>

      {/* Login form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {/* Telegram ID input */}
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Telegram User ID
          </label>
          <input
            type="text"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="請輸入你的 Telegram ID"
            className="w-full h-14 px-4 rounded-2xl text-base outline-none transition-all"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
            disabled={loading}
          />
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            傳訊息給 <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: 'var(--color-accent)' }}>@userinfobot</a> 取得你的 ID
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-xl text-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{errorMsg}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all active:brightness-90 disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: 'white' }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              登入
            </>
          )}
        </button>
      </form>

      {/* Help text */}
      <div className="mt-8 text-center">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          只有已授權的員工可以登入
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          請聯繫管理員開通帳號
        </p>
      </div>

      <p className="absolute bottom-8 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        277 Bicycle © {new Date().getFullYear()}
      </p>
    </div>
  );
}
