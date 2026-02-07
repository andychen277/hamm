'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const STORES = ['台南', '高雄', '美術', '台中', '台北'];

interface ScannedItem {
  product_id: string;
  product_name: string;
  barcode: string;
  price: number;
  quantity: number;
  found: boolean; // whether product was found in inventory
}

interface UserInfo {
  name: string;
  store: string;
}

interface PendingShipment {
  id: number;
  shipment_id: string;
  cust_po_number: string;
  ship_to: string;
  date_shipped: string;
  shipped_total: number;
  shipped_qty: number;
  tracking_url: string;
}

export default function ReceivingPage() {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [store, setStore] = useState('台南');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ id: number; orderNo: string; totalItems: number; totalQty: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingShipments, setPendingShipments] = useState<PendingShipment[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);

  const scannerRef = useRef<unknown>(null);
  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });
  const itemsRef = useRef<ScannedItem[]>([]);

  // Keep itemsRef in sync
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Get user info on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setUserInfo({ name: data.user.name, store: data.user.store || '' });
          if (data.user.store_access?.[0] && data.user.store_access[0] !== 'all') {
            setStore(data.user.store_access[0]);
          }
        }
      })
      .catch(() => {});

    // Fetch pending Specialized shipments
    fetch('/api/specialized/shipments/pending-receive')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.length > 0) {
          setPendingShipments(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  }, []);

  // Handle scan result
  const onScanSuccess = useCallback(async (decodedText: string) => {
    const barcode = decodedText.trim();
    if (!barcode) return;

    // Debounce: same barcode within 2 seconds
    const now = Date.now();
    if (lastScanRef.current.barcode === barcode && now - lastScanRef.current.time < 2000) {
      return;
    }
    lastScanRef.current = { barcode, time: now };

    // Vibrate feedback
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    // Check if already in list
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

    // Lookup product
    try {
      const res = await fetch(`/api/receiving/lookup?barcode=${encodeURIComponent(barcode)}`);
      const json = await res.json();

      if (json.success && json.data) {
        const newItem: ScannedItem = {
          product_id: json.data.product_id,
          product_name: json.data.product_name,
          barcode,
          price: json.data.price,
          quantity: 1,
          found: true,
        };
        setItems(prev => [newItem, ...prev]);
        showToast(`${json.data.product_name}`, 'success');
      } else {
        // Product not found - add with barcode as name
        const newItem: ScannedItem = {
          product_id: barcode,
          product_name: `未知商品 (${barcode})`,
          barcode,
          price: 0,
          quantity: 1,
          found: false,
        };
        setItems(prev => [newItem, ...prev]);
        showToast(`未找到商品: ${barcode}`, 'error');
      }
    } catch {
      showToast('查詢失敗，請重試', 'error');
    }
  }, [showToast]);

  // Initialize scanner
  useEffect(() => {
    let mounted = true;

    async function initScanner() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (!mounted) return;

        const scanner = new Html5Qrcode('scanner-region', {
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
          {
            fps: 15,
            qrbox: { width: boxW, height: Math.floor(boxW * 0.45) },
          },
          (decodedText: string) => {
            onScanSuccess(decodedText);
          },
          () => {
            // Ignore scan failures (no code in frame)
          }
        );

        if (mounted) {
          setScannerReady(true);
        }
      } catch (err) {
        console.error('Scanner init error:', err);
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
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty };
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError('請先掃描商品');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store,
          supplier,
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
        setSupplier('');
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

  // Load a Specialized shipment into the form
  const loadSpecShipment = async (shipment: PendingShipment) => {
    setLoadingPending(true);
    setSupplier('Specialized');
    setNote(`Spec Shipment: ${shipment.shipment_id} / PO: ${shipment.cust_po_number}`);
    setShowPending(false);

    // Try to parse items from raw_data via API
    // For now, create a placeholder entry for the shipment
    const newItem: ScannedItem = {
      product_id: shipment.cust_po_number || shipment.shipment_id,
      product_name: `Specialized ${shipment.ship_to || ''} (PO: ${shipment.cust_po_number})`.trim(),
      barcode: shipment.shipment_id,
      price: shipment.shipped_total || 0,
      quantity: shipment.shipped_qty || 1,
      found: true,
    };
    setItems(prev => [newItem, ...prev]);
    showToast('Specialized 出貨已載入', 'success');
    setLoadingPending(false);
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
            進貨單已建立
          </h2>
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            單號：{success.orderNo}
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            共 {success.totalItems} 項 / {success.totalQty} 件
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link
              href={`/receiving/${success.id}/labels`}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-center"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              列印商品標籤
            </Link>
            <div className="flex gap-3">
              <button
                onClick={() => setSuccess(null)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
              >
                繼續掃描
              </button>
              <Link
                href="/receiving/history"
                className="flex-1 py-3 rounded-2xl text-sm font-medium text-center"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
              >
                進貨紀錄
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
            &#128125; Alien 掃描進貨
          </h1>
          {userInfo && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {userInfo.name} - {store}
            </p>
          )}
        </div>
        <Link
          href="/receiving/history"
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
        >
          進貨紀錄
        </Link>
      </div>

      {/* Scanner Area */}
      <div className="relative" style={{ background: '#000' }}>
        <div id="scanner-region" style={{ width: '100%' }} />
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
              <button
                onClick={() => window.location.reload()}
                className="text-sm underline text-white/70"
              >
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

      {/* Specialized Pending Shipments Banner */}
      {pendingShipments.length > 0 && (
        <div className="px-4 py-2">
          <button
            onClick={() => setShowPending(!showPending)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(147,51,234,0.3)' }}
          >
            <span style={{ color: 'rgb(147,51,234)' }}>
              Specialized {pendingShipments.length} 筆待收貨
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {showPending ? '收合 ▲' : '展開 ▼'}
            </span>
          </button>
          {showPending && (
            <div className="mt-2 space-y-2">
              {pendingShipments.map(s => (
                <div
                  key={s.shipment_id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid rgba(147,51,234,0.2)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      PO: {s.cust_po_number || s.shipment_id}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {s.date_shipped} {s.ship_to ? `/ ${s.ship_to}` : ''}
                      {s.shipped_qty > 0 && ` / ${s.shipped_qty} 件`}
                      {s.shipped_total > 0 && ` / $${s.shipped_total.toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => loadSpecShipment(s)}
                    disabled={loadingPending}
                    className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                    style={{ background: 'rgb(147,51,234)', color: '#fff' }}
                  >
                    載入
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scanned Items List */}
      <div className="flex-1 overflow-auto px-4 py-3" style={{ paddingBottom: showForm ? '320px' : '160px' }}>
        {items.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">&#128247;</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              將相機對準商品條碼開始掃描
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
                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {item.product_name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {item.product_id}
                    {item.price > 0 && ` / $${item.price.toLocaleString()}`}
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(index, -1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(index, 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
                  >
                    +
                  </button>
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeItem(index)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                  style={{ color: 'var(--color-negative)' }}
                >
                  &#10005;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Fixed Area */}
      <div className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'var(--color-bg-card)',
          borderTop: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>

        {/* Toggle form button */}
        {items.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full py-1.5 text-xs text-center"
            style={{ color: 'var(--color-text-muted)', borderBottom: showForm ? '1px solid var(--color-border)' : 'none' }}
          >
            {showForm ? '收合表單 ▼' : '展開表單 ▲（門市/廠商/備註）'}
          </button>
        )}

        {/* Form fields (collapsible) */}
        {showForm && (
          <div className="px-4 py-3 space-y-3">
            {/* Store select */}
            <div className="flex items-center gap-2">
              <label className="text-xs w-12 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>門市</label>
              <select
                value={store}
                onChange={e => setStore(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              >
                {STORES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Supplier */}
            <div className="flex items-center gap-2">
              <label className="text-xs w-12 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>廠商</label>
              <input
                type="text"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="選填"
                className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
            </div>

            {/* Note */}
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

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <p className="text-xs text-center" style={{ color: 'var(--color-negative)' }}>{error}</p>
          </div>
        )}

        {/* Submit bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {totalItems} 項 / {totalQty} 件
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {store}{supplier ? ` - ${supplier}` : ''}
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
              '送出進貨單'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
