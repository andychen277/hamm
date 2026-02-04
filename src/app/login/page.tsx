'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [mode, setMode] = useState<'main' | 'pin'>('main');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    error === 'not_authorized' ? '此帳號無權限存取' :
    error === 'token_failed' ? 'LINE 登入失敗，請重試' :
    error === 'profile_failed' ? '無法取得 LINE 資料' :
    error === 'no_code' ? '登入流程中斷' :
    error === 'unknown' ? '登入失敗，請重試' : ''
  );

  const handlePinSubmitDirect = async (pinValue: string) => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue }),
      });
      const data = await res.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setErrorMsg(data.error);
        setPin('');
      }
    } catch {
      setErrorMsg('網路錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 6) {
      setTimeout(() => handlePinSubmitDirect(newPin), 150);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  if (mode === 'pin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐷</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>輸入 PIN 碼</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>請輸入 6 位數密碼</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full transition-all duration-200"
              style={{
                background: i < pin.length ? 'var(--color-accent)' : 'var(--color-bg-card-alt)',
                border: i < pin.length ? 'none' : '1px solid var(--color-text-muted)',
                transform: i < pin.length ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-sm mb-4" style={{ color: 'var(--color-negative)' }}>{errorMsg}</p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {['1','2','3','4','5','6','7','8','9','_','0','⌫'].map((key) => {
            if (key === '_') return <div key="empty" />;
            if (key === '⌫') {
              return (
                <button
                  key="backspace"
                  onClick={handleBackspace}
                  className="h-16 rounded-2xl text-xl font-medium transition-colors active:opacity-70"
                  style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
                  disabled={loading}
                >
                  ⌫
                </button>
              );
            }
            return (
              <button
                key={key}
                onClick={() => handlePinInput(key)}
                className="h-16 rounded-2xl text-2xl font-medium transition-colors active:opacity-70"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
                disabled={loading}
              >
                {key}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => { setMode('main'); setPin(''); setErrorMsg(''); }}
          className="mt-8 text-sm transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← 返回
        </button>

        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-10 h-10 border-[3px] rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Logo & title */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🐷</div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Hamm</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>277 Bicycle 商業智慧平台</p>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="w-full max-w-sm mb-6 p-3 rounded-xl text-center"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{errorMsg}</p>
        </div>
      )}

      {/* LINE Login button */}
      <a
        href="/api/auth/line-login"
        className="w-full max-w-sm h-14 rounded-2xl bg-[#06C755] text-white text-base font-semibold flex items-center justify-center gap-2 active:brightness-90 transition-all"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.271.173-.508.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
        LINE 登入
      </a>

      {/* PIN Code backup */}
      <button
        onClick={() => { setMode('pin'); setErrorMsg(''); }}
        className="mt-4 text-sm transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
      >
        使用 PIN 碼登入
      </button>

      <p className="absolute bottom-8 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        277 Bicycle © {new Date().getFullYear()}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] rounded-full animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
