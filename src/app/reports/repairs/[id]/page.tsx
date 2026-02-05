'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface RepairDetail {
  repair_id: string;
  store: string;
  open_date: string;
  customer_name: string;
  customer_phone: string;
  repair_desc: string;
  deposit: number;
  store_note: string;
  vendor_quote: number;
  vendor_note: string;
  assigned_to: string;
  status: string;
  updated_at: string;
  created_at: string;
  customer_repairs: {
    repair_id: string;
    store: string;
    open_date: string;
    status: string;
    repair_desc: string;
  }[];
  customer_transactions: {
    date: string;
    store: string;
    product_name: string;
    quantity: number;
    total: number;
  }[];
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

const STATUS_COLORS: Record<string, string> = {
  '開單': 'var(--color-warning)',
  '維修中': 'var(--color-accent)',
  '已完成': 'var(--color-positive)',
  '已完修': 'var(--color-positive)',
  '待取件': '#9B5DE5',
  '已取車': 'var(--color-text-muted)',
  '已取消': 'var(--color-negative)',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
      <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

export default function RepairDetailPage() {
  const params = useParams();
  const repairId = decodeURIComponent(params.id as string);
  const [data, setData] = useState<RepairDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/reports/repairs/${encodeURIComponent(repairId)}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [repairId]);

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/reports/repairs" className="text-xl">←</Link>
        <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          維修詳情
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到維修資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Repair Header */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}>
                {data.repair_id}
              </span>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: STORE_COLORS[data.store] || 'var(--color-accent)', color: '#fff' }}
              >
                {data.store}
              </span>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: STATUS_COLORS[data.status] || 'var(--color-text-muted)', color: '#fff' }}
              >
                {data.status}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              開單日期: {data.open_date}
            </p>
            {data.updated_at && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                最後更新: {data.updated_at}
              </p>
            )}
          </div>

          {/* Customer Info */}
          <Card title="👤 客戶資訊">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>姓名</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {data.customer_name || '(無姓名)'}
                </span>
              </div>
              {data.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>電話</span>
                  <a
                    href={`tel:${data.customer_phone}`}
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {data.customer_phone}
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Repair Description */}
          {data.repair_desc && (
            <Card title="🔧 維修內容">
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                {data.repair_desc}
              </p>
            </Card>
          )}

          {/* Store Notes */}
          {data.store_note && (
            <Card title="📝 門市備註">
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                {data.store_note}
              </p>
            </Card>
          )}

          {/* Financial Info */}
          {(data.deposit > 0 || data.vendor_quote > 0) && (
            <Card title="💰 費用資訊">
              <div className="space-y-2">
                {data.deposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>暫付款</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-positive)' }}>
                      {fmt$(data.deposit)}
                    </span>
                  </div>
                )}
                {data.vendor_quote > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>廠商報價</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>
                      {fmt$(data.vendor_quote)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Vendor Notes */}
          {data.vendor_note && (
            <Card title="🏭 廠商備註">
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                {data.vendor_note}
              </p>
            </Card>
          )}

          {/* Assigned To */}
          {data.assigned_to && (
            <Card title="👨‍🔧 負責人員">
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {data.assigned_to}
              </p>
            </Card>
          )}

          {/* Customer's Other Repairs */}
          {data.customer_repairs.length > 0 && (
            <Card title="🔧 此客戶其他維修記錄">
              <div className="space-y-2">
                {data.customer_repairs.map((r, i) => (
                  <Link
                    key={i}
                    href={`/reports/repairs/${encodeURIComponent(r.repair_id)}`}
                    className="block py-2 border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-bg-card-alt)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{r.open_date}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: STORE_COLORS[r.store] || 'var(--color-accent)', color: '#fff' }}
                      >
                        {r.store}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: STATUS_COLORS[r.status] || 'var(--color-text-muted)', color: '#fff' }}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.repair_desc && (
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {r.repair_desc}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Customer's Recent Transactions */}
          {data.customer_transactions.length > 0 && (
            <Card title="🛒 此客戶近期消費">
              <div className="space-y-2">
                {data.customer_transactions.map((tx, i) => (
                  <div key={i} className="flex justify-between items-center text-xs py-1 border-b" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>{tx.date}</span>
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: STORE_COLORS[tx.store] || 'var(--color-accent)', color: '#fff' }}
                      >
                        {tx.store}
                      </span>
                    </div>
                    <span className="tabular-nums" style={{ color: 'var(--color-positive)' }}>{fmt$(tx.total)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <BottomNav active="reports" />
    </div>
  );
}
