'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface ProductResult {
  product_id: string;
  product_name: string;
  price: number;
  stores: { store: string; quantity: number }[];
}

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B35', '高雄': '#F7C948', '台中': '#2EC4B6', '台北': '#E71D73', '美術': '#9B5DE5',
};

export default function ScanLookupPage() {
  const [product, setProduct] = useState<ProductResult | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lastBarcode, setLastBarcode] = useState('');

  const scannerRef = useRef<unknown>(null);
  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });

  const onScanSuccess = useCallback(async (decodedText: string) => {
    const barcode = decodedText.trim();
    if (!barcode) return;

    const now = Date.now();
    if (lastScanRef.current.barcode === barcode && now - lastScanRef.current.time < 3000) return;
    lastScanRef.current = { barcode, time: now };

    if (navigator.vibrate) navigator.vibrate(100);

    setLastBarcode(barcode);
    setLookupError(null);
    setProduct(null);

    try {
      const res = await fetch(`/api/receiving/lookup?barcode=${encodeURIComponent(barcode)}`);
      const json = await res.json();

      if (json.success && json.data) {
        setProduct(json.data);
      } else {
        setLookupError(`找不到商品: ${barcode}`);
      }
    } catch {
      setLookupError('查詢失敗');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        const scanner = new Html5Qrcode('lookup-scanner');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
          (decodedText: string) => onScanSuccess(decodedText),
          () => {}
        );

        if (mounted) setScannerReady(true);
      } catch (err) {
        if (mounted) {
          setCameraError(
            err instanceof Error && err.message.includes('Permission')
              ? '請允許相機權限'
              : '無法啟動相機'
          );
        }
      }
    }

    initScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        const scanner = scannerRef.current as { stop: () => Promise<void>; clear: () => void };
        scanner.stop().catch(() => {});
        try { scanner.clear(); } catch { /* ignore */ }
      }
    };
  }, [onScanSuccess]);

  const totalStock = product ? product.stores.reduce((sum, s) => sum + s.quantity, 0) : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          &#128125; 快速查詢
        </h1>
        <Link href="/reports" className="text-sm" style={{ color: 'var(--color-accent)' }}>
          返回
        </Link>
      </div>

      {/* Scanner */}
      <div className="relative" style={{ background: '#000' }}>
        <div id="lookup-scanner" style={{ width: '100%' }} />
        {!scannerReady && !cameraError && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/70">啟動相機中...</p>
            </div>
          </div>
        )}
        {cameraError && (
          <div className="flex items-center justify-center py-16 px-6">
            <p className="text-sm text-red-400">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Result area */}
      <div className="flex-1 px-4 py-4">
        {!product && !lookupError && (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">&#128269;</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              掃描商品條碼查看庫存和售價
            </p>
          </div>
        )}

        {lookupError && (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{lookupError}</p>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>條碼：{lastBarcode}</p>
          </div>
        )}

        {product && (
          <div className="space-y-4">
            {/* Product info */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <h2 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {product.product_name}
              </h2>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                {product.product_id}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                  ${product.price.toLocaleString()}
                </span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  全店庫存 {totalStock}
                </span>
              </div>
            </div>

            {/* Stock by store */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                各店庫存
              </h3>
              <div className="space-y-2">
                {product.stores.map(s => (
                  <div key={s.store} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: STORE_COLORS[s.store] || '#64748b' }} />
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.store}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{
                      color: s.quantity > 0 ? 'var(--color-positive)' : 'var(--color-negative)',
                    }}>
                      {s.quantity}
                    </span>
                  </div>
                ))}
                {product.stores.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>無庫存記錄</p>
                )}
              </div>
            </div>

            {/* Scan again hint */}
            <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              掃描其他條碼查看更多商品
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
