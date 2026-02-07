'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface OrderDetail {
  id: number;
  source_type: 'order' | 'pending';
  order_id: string;
  order_number: string;
  order_type: string;
  order_status: string;
  total_amount: number;
  currency_code: string;
  raw_data: Record<string, unknown> | null;
  // Order fields
  order_date_fmt?: string;
  // Pending fields
  submitted_date_fmt?: string;
  created_at_fmt: string;
  updated_at_fmt: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Shipped': 'rgb(34,197,94)',
  'Cancelled': 'var(--color-negative)',
  'Pending': 'var(--color-warning)',
  'Processing': 'rgb(147,51,234)',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch(`/api/specialized/orders/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const statusColor = data ? (STATUS_COLORS[data.order_status] || 'var(--color-text-muted)') : '';

  return (
    <div className="pb-20 min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">&#8592;</button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          訂單詳情
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到此訂單</p>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{
                background: statusColor + '22',
                color: statusColor,
              }}>
              {data.order_status || (data.source_type === 'pending' ? '待處理' : '-')}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {data.source_type === 'pending' ? '待處理訂單' : '歷史訂單'}
            </span>
          </div>

          {/* Info Card */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              訂單資訊
            </h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                { label: 'Order ID', value: data.order_id },
                { label: 'Order Number', value: data.order_number || '-' },
                { label: 'Order Type', value: data.order_type || '-' },
                { label: '狀態', value: data.order_status || '-' },
                { label: '日期', value: data.order_date_fmt || data.submitted_date_fmt || '-' },
                { label: '金額', value: fmt$(data.total_amount) },
                { label: '幣別', value: data.currency_code || 'TWD' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

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
