'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const STORES = ['台南', '高雄', '美術', '台中', '台北'];
const LOGISTICS = ['新竹貨運', '大榮貨運', '宅急便', '自送'];

interface ScannedItem {
  product_id: string;
  product_name: string;
  barcode: string;
  price: number;
  quantity: number;
  found: boolean;
}

interface UserInfo {
  name: string;
  store: string;
}

export default function TransferPage() {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [fromStore, setFromStore] = useState('台南');
  const [toStore, setToStore] = useState('高雄');
  const [logistics, setLogistics] = useState('新竹貨運');
  const [trackingNo, setTrackingNo] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ id: number; orderNo: string; totalItems: number; totalQty: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showForm, setShowForm] = useState(false);

  const scannerRef = useRef<unknown>(null);
  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });
  const itemsRef = useRef<ScannedItem[]>([]);

  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setUserInfo({ name: data.user.name, store: data.user.store || '' });
          if (data.user.store_access?.[0] && data.user.store_access[0] !== 'all') {
            setFromStore(data.user.store_access[0]);
            // Default to_store to a different store
            const otherStore = STORES.find(s => s !== data.user.store_access[0]);
            if (otherStore) setToStore(otherStore);
          }
        }
      })
      .catch(() => {});
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  }, []);

  const onScanSuccess = useCallback(async (decodedText: string) => {
    const barcode = decodedText.trim();
    if (!barcode) return;

    const now = Date.now();
    if (lastScanRef.current.barcode === barcode && now - lastScanRef.current.time < 2000) return;
    lastScanRef.current = { barcode, time: now };

    if (navigator.vibrate) navigator.vibrate(100);

    const existingIndex = itemsRef.current.findIndex(
      item => item.barcode === barcode || item.product_id === barcode
    );
    if (existingIndex >= 0) {
      setItems(prev => prev.map((item, i) =>
        i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      ));
      showToast(`${itemsRef.current[existingIndex].product_name} +1`, 'success');
      return;
    }

    try {
      const res = await fetch(`/api/receiving/lookup?barcode=${encodeURIComponent(barcode)}`);
      const json = await res.json();

      if (json.success && json.data) {
        setItems(prev => [{
          product_id: json.data.product_id,
          product_name: json.data.product_name,
          barcode,
          price: json.data.price,
          quantity: 1,
          found: true,
        }, ...prev]);
        showToast(`${json.data.product_name}`, 'success');
      } else {
        setItems(prev => [{
          product_id: barcode,
          product_name: `未知商品 (${barcode})`,
          barcode,
          price: 0,
          quantity: 1,
          found: false,
        }, ...prev]);
        showToast(`未找到商品: ${barcode}`, 'error');
      }
    } catch {
      showToast('查詢失敗，請重試', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    let mounted = true;

    async function initScanner() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (!mounted) return;

        const scanner = new Html5Qrcode('transfer-scanner', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        scannerRef.current = scanner;

        const boxW = Math.min(Math.floor(window.innerWidth * 0.85), 400);
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: boxW, height: Math.floor(boxW * 0.45) } },
          (decodedText: string) => onScanSuccess(decodedText),
          () => {}
        );

        if (mounted) setScannerReady(true);
      } catch (err) {
        if (mounted) {
          setCameraError(
            err instanceof Error && err.message.includes('Permission')
              ? '請允許相機權限以使用掃描功能'
              : '無法啟動相機，請確認瀏覽器支援'
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

  const updateQuantity = (index: number, delta: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, quantity: Math.max(1, item.quantity + delta) };
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (items.length === 0) { setError('請先掃描商品'); return; }
    if (fromStore === toStore) { setError('來源與目的門市不能相同'); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_store: fromStore,
          to_store: toStore,
          logistics,
          tracking_no: trackingNo,
          note,
          staff_name: userInfo?.name || '',
          items: items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            barcode: item.barcode,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccess({
          id: json.data.id,
          orderNo: json.data.order_no,
          totalItems: json.data.total_items,
          totalQty: json.data.total_qty,
        });
        setItems([]);
        setTrackingNo('');
        setNote('');
      } else {
        setError(json.error || '建單失敗');
      }
    } catch {
      setError('網路錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };

  const totalItems = items.length;
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  // Success view
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--color-bg-primary)' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            調貨單已建立
          </h2>
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            單號：{success.orderNo}
          </p>
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            {fromStore} → {toStore}
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            共 {success.totalItems} 項 / {success.totalQty} 件
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link
              href={`/transfer/${success.id}/shipping`}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-center"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              列印寄貨單
            </Link>
            <div className="flex gap-3">
              <button
                onClick={() => setSuccess(null)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
              >
                繼續調貨
              </button>
              <Link
                href="/transfer/history"
                className="flex-1 py-3 rounded-2xl text-sm font-medium text-center"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
              >
                調貨紀錄
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            &#128125; Alien 調貨
          </h1>
          {userInfo && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {userInfo.name} - {fromStore} → {toStore}
            </p>
          )}
        </div>
        <Link
          href="/transfer/history"
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
        >
          調貨紀錄
        </Link>
      </div>

      {/* Store selection - always visible */}
      <div className="flex items-center gap-2 px-4 py-2"
        style={{ background: 'var(--color-bg-card-alt)' }}>
        <select
          value={fromStore}
          onChange={e => setFromStore(e.target.value)}
          className="flex-1 h-8 px-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        >
          {STORES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>→</span>
        <select
          value={toStore}
          onChange={e => setToStore(e.target.value)}
          className="flex-1 h-8 px-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        >
          {STORES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Scanner */}
      <div className="relative" style={{ background: '#000' }}>
        <div id="transfer-scanner" style={{ width: '100%' }} />
        {!scannerReady && !cameraError && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/70">啟動相機中...</p>
            </div>
          </div>
        )}
        {cameraError && (
          <div className="flex items-center justify-center py-20 px-6">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">{cameraError}</p>
              <button onClick={() => window.location.reload()} className="text-sm underline text-white/70">
                重新載入
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-16 left-4 right-4 z-50 py-2 px-4 rounded-xl text-center text-sm font-medium animate-pulse"
          style={{
            background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
            color: '#fff',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-auto px-4 py-3" style={{ paddingBottom: showForm ? '360px' : '160px' }}>
        {items.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">&#128230;</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              掃描要調貨的商品
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`${item.barcode}-${index}`}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: 'var(--color-bg-card)',
                  border: item.found ? 'none' : '1px solid rgba(239,68,68,0.3)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {item.product_name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {item.product_id}
                    {item.price > 0 && ` / $${item.price.toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(index, -1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
                  >-</button>
                  <span className="w-8 text-center text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(index, 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
                  >+</button>
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                  style={{ color: 'var(--color-negative)' }}
                >&#10005;</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'var(--color-bg-card)',
          borderTop: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>

        {items.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full py-1.5 text-xs text-center"
            style={{ color: 'var(--color-text-muted)', borderBottom: showForm ? '1px solid var(--color-border)' : 'none' }}
          >
            {showForm ? '收合表單 ▼' : '展開表單 ▲（物流/備註）'}
          </button>
        )}

        {showForm && (
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs w-12 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>物流</label>
              <select
                value={logistics}
                onChange={e => setLogistics(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              >
                {LOGISTICS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-12 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>單號</label>
              <input
                type="text"
                value={trackingNo}
                onChange={e => setTrackingNo(e.target.value)}
                placeholder="物流追蹤單號（選填）"
                className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-12 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>備註</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="選填"
                className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 pb-2">
            <p className="text-xs text-center" style={{ color: 'var(--color-negative)' }}>{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {totalItems} 項 / {totalQty} 件
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {fromStore} → {toStore} ({logistics})
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            className="px-8 py-3 rounded-2xl text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '送出調貨單'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
