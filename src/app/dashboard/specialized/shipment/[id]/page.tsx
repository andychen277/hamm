'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ShipmentDetail {
  id: number;
  shipment_id: string;
  cust_po_number: string;
  ship_to: string;
  order_type: string;
  date_shipped_fmt: string;
  shipped_total: number;
  shipped_qty: number;
  tracking_url: string;
  currency_code: string;
  raw_data: Record<string, unknown> | null;
  created_at_fmt: string;
  updated_at_fmt: string;
  receiving_order_id: number | null;
  receiving_order_no: string | null;
  received_at: string | null;
}

const STORE_OPTIONS = ['台南', '高雄', '美術', '台中', '台北', '崇明'];

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  // Receive confirmation state
  const [confirmStore, setConfirmStore] = useState('台南');
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/specialized/shipments/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleReceive = async () => {
    if (!data || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/specialized/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipment_id: data.shipment_id, store: confirmStore }),
      });
      const json = await res.json();
      if (json.success) {
        setConfirmResult(`收貨成功！進貨單號: ${json.data.order_no}`);
        setData(prev => prev ? {
          ...prev,
          receiving_order_id: json.data.receiving_order_id,
          receiving_order_no: json.data.order_no,
          received_at: new Date().toISOString(),
        } : prev);
      } else {
        setConfirmResult(`錯誤: ${json.error}`);
      }
    } catch {
      setConfirmResult('網路錯誤，請重試');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="pb-20 min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">&#8592;</button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          出貨詳情
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到此出貨單</p>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{
                background: data.receiving_order_id ? 'rgba(34,197,94,0.15)' : 'rgba(147,51,234,0.15)',
                color: data.receiving_order_id ? 'rgb(34,197,94)' : 'rgb(147,51,234)',
              }}>
              {data.receiving_order_id ? '已收貨' : '在途中'}
            </span>
            {data.receiving_order_no && (
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {data.receiving_order_no}
              </span>
            )}
          </div>

          {/* Info Card */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              出貨資訊
            </h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                { label: 'Shipment ID', value: data.shipment_id },
                { label: 'PO Number', value: data.cust_po_number || '-' },
                { label: 'Ship To', value: data.ship_to || '-' },
                { label: 'Order Type', value: data.order_type || '-' },
                { label: '出貨日', value: data.date_shipped_fmt },
                { label: '數量', value: `${data.shipped_qty} 件` },
                { label: '金額', value: fmt$(data.shipped_total) },
                { label: '幣別', value: data.currency_code || 'TWD' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {data.tracking_url && (
              <a href={data.tracking_url} target="_blank" rel="noreferrer"
                className="mt-3 inline-block text-xs underline"
                style={{ color: 'var(--color-accent)' }}>
                追蹤出貨連結
              </a>
            )}
          </div>

          {/* Receive Confirmation (if not yet received) */}
          {!data.receiving_order_id && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                確認收貨
              </h3>
              <div className="flex gap-2 items-center">
                <select
                  value={confirmStore}
                  onChange={e => setConfirmStore(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--color-bg-card-alt)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-bg-card-alt)',
                  }}
                >
                  {STORE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleReceive}
                  disabled={confirming}
                  className="h-10 px-5 rounded-xl text-sm font-medium shrink-0"
                  style={{
                    background: confirming ? 'var(--color-bg-card-alt)' : 'rgb(34,197,94)',
                    color: '#fff',
                    opacity: confirming ? 0.6 : 1,
                  }}
                >
                  {confirming ? '處理中...' : '確認收貨'}
                </button>
              </div>
              {confirmResult && (
                <p className="text-xs mt-2" style={{
                  color: confirmResult.startsWith('錯誤') ? 'var(--color-negative)' : 'var(--color-positive)',
                }}>
                  {confirmResult}
                </p>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              時間紀錄
            </h3>
            <div className="space-y-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="flex justify-between">
                <span>建立時間</span>
                <span>{data.created_at_fmt}</span>
              </div>
              {data.updated_at_fmt && (
                <div className="flex justify-between">
                  <span>更新時間</span>
                  <span>{data.updated_at_fmt}</span>
                </div>
              )}
              {data.received_at && (
                <div className="flex justify-between">
                  <span>收貨時間</span>
                  <span style={{ color: 'var(--color-positive)' }}>{data.received_at}</span>
                </div>
              )}
            </div>
          </div>

          {/* Raw Data */}
          {data.raw_data && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="w-full flex justify-between items-center"
              >
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  原始資料
                </h3>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {showRaw ? '收起' : '展開'}
                </span>
              </button>
              {showRaw && (
                <pre className="mt-3 text-[11px] overflow-x-auto p-3 rounded-lg whitespace-pre-wrap break-all"
                  style={{
                    background: 'var(--color-bg-card-alt)',
                    color: 'var(--color-text-secondary)',
                  }}>
                  {JSON.stringify(data.raw_data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
