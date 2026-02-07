'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  has_line_binding: boolean;
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
  const router = useRouter();
  const repairId = decodeURIComponent(params.id as string);
  const [data, setData] = useState<RepairDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Notification state
  const [showNotifyPanel, setShowNotifyPanel] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ success: boolean; message: string } | null>(null);

  // Close case state
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleClose = async () => {
    if (!data || closing) return;
    setClosing(true);
    setCloseResult(null);
    try {
      const res = await fetch(`/api/reports/repairs/${encodeURIComponent(repairId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '已取車' }),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => prev ? { ...prev, status: '已取車' } : null);
        setCloseResult({ success: true, message: '已結案（已取車）' });
      } else {
        setCloseResult({ success: false, message: json.error || '結案失敗' });
      }
    } catch {
      setCloseResult({ success: false, message: '網路錯誤，請重試' });
    } finally {
      setClosing(false);
    }
  };

  const handleNotify = async () => {
    if (!data) return;

    setNotifying(true);
    setNotifyResult(null);

    try {
      const res = await fetch('/api/notify/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'repair_done',
          phone: data.customer_phone,
          repairId: data.repair_id,
          customMessage: notifyMessage.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setNotifyResult({ success: true, message: '通知已發送至客戶 LINE，狀態已更新為「已完修」' });
        setShowNotifyPanel(false);
        setNotifyMessage('');
        // Update local state to reflect status change
        setData(prev => prev ? { ...prev, status: '已完修' } : null);
      } else {
        setNotifyResult({
          success: false,
          message: json.notBound ? '此客戶尚未綁定 LINE' : (json.error || '發送失敗'),
        });
      }
    } catch {
      setNotifyResult({ success: false, message: '發送失敗，請稍後再試' });
    } finally {
      setNotifying(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/reports/repairs/${encodeURIComponent(repairId)}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
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
        <button onClick={() => router.back()} className="text-xl">←</button>
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
          {/* Close Result */}
          {closeResult && (
            <div
              className="rounded-xl p-3 mb-3 text-sm"
              style={{
                background: closeResult.success ? 'var(--color-positive)' : 'var(--color-negative)',
                color: '#fff',
              }}
            >
              {closeResult.success ? '✓' : '✗'} {closeResult.message}
            </div>
          )}

          {/* Notify Result */}
          {notifyResult && (
            <div
              className="rounded-xl p-3 mb-3 text-sm"
              style={{
                background: notifyResult.success ? 'var(--color-positive)' : 'var(--color-negative)',
                color: '#fff',
              }}
            >
              {notifyResult.success ? '✓' : '✗'} {notifyResult.message}
            </div>
          )}

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
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>LINE 綁定</span>
                <span className="text-sm" style={{ color: data.has_line_binding ? 'var(--color-positive)' : 'var(--color-text-muted)' }}>
                  {data.has_line_binding ? '已綁定' : '未綁定'}
                </span>
              </div>
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

          {/* Notify Button */}
          {data.customer_phone && (
            <div className="mb-3">
              <button
                onClick={() => setShowNotifyPanel(!showNotifyPanel)}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                📢 完修通知
              </button>
            </div>
          )}

          {/* Notify Panel */}
          {showNotifyPanel && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                發送完修通知
              </h3>

              {!data.has_line_binding && (
                <div className="p-3 rounded-lg mb-3 text-xs" style={{ background: 'var(--color-warning)', color: '#fff' }}>
                  此客戶尚未綁定 LINE，通知可能無法送達
                </div>
              )}

              <div className="mb-3">
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                  自訂訊息（選填）
                </label>
                <textarea
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  placeholder="您好！您的維修已完成，歡迎來店取車。"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  留空則使用預設訊息，內容會包含維修項目及門市資訊
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowNotifyPanel(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleNotify}
                  disabled={notifying}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {notifying ? '發送中...' : '發送通知'}
                </button>
              </div>
            </div>
          )}

          {/* Close Case Button */}
          {data.status !== '已取車' && data.status !== '已取消' && (
            <div className="mb-3">
              <button
                onClick={handleClose}
                disabled={closing}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ background: 'var(--color-text-muted)', color: '#fff' }}
              >
                {closing ? '處理中...' : '結案（已取車）'}
              </button>
            </div>
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
