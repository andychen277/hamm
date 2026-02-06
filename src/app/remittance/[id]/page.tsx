'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface RemittanceDetail {
  remittanceNo: string;
  supplierName: string;
  amount: number;
  store: string;
  creator: string;
  requestDate: string;
  arrivalStore: string;
  description: string;
  status: string;
  paidDate?: string;
  paidAmount?: number;
  paidBy?: string;
  paidNote?: string;
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '崇明': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
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

export default function RemittanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const remittanceNo = decodeURIComponent(params.id as string);
  const [data, setData] = useState<RemittanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Photo state
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);

  // Complete remittance state
  const [showCompletePanel, setShowCompletePanel] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [paidNote, setPaidNote] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Query remittances with a date range that should include this one
        const today = new Date();
        const startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 6); // 6 months back

        const params = new URLSearchParams({
          start: startDate.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0],
        });

        const res = await fetch(`/api/reports/remittances?${params}`);
        const json = await res.json();

        if (json.success && json.data) {
          const found = json.data.find((r: RemittanceDetail) => r.remittanceNo === remittanceNo);
          if (found) {
            setData(found);
            setPaidAmount(String(found.amount)); // Pre-fill with requested amount
          } else {
            setError('找不到此匯款需求');
          }
        } else {
          setError('查詢失敗');
        }
      } catch {
        setError('查詢失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [remittanceNo]);

  // Fetch photo from local DB
  useEffect(() => {
    if (!remittanceNo) return;
    fetch(`/api/remittance/${encodeURIComponent(remittanceNo)}/photo`)
      .then(res => res.json())
      .then(json => { if (json.success && json.data) setPhotoData(json.data); })
      .catch(() => {});
  }, [remittanceNo]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleComplete = async () => {
    if (!data) return;

    setCompleting(true);
    setCompleteResult(null);

    try {
      const res = await fetch('/api/remittance/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remittanceNo: data.remittanceNo,
          paidAmount: Number(paidAmount) || data.amount,
          paidNote: paidNote.trim() || undefined,
          creator: data.creator,
          supplierName: data.supplierName,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const notif = json.data?.notifications;
        const msg = notif
          ? `匯款完成！已發送 ${notif.sent} 則通知${notif.failed > 0 ? `（${notif.failed} 則失敗）` : ''}`
          : '匯款完成！';
        setCompleteResult({ success: true, message: msg });
        setShowCompletePanel(false);
        // Update local state
        setData(prev => prev ? {
          ...prev,
          status: '已匯',
          paidDate: new Date().toISOString().split('T')[0],
          paidAmount: Number(paidAmount) || prev.amount,
          paidNote: paidNote.trim() || undefined,
        } : null);
      } else {
        setCompleteResult({ success: false, message: json.error || '操作失敗' });
      }
    } catch {
      setCompleteResult({ success: false, message: '操作失敗，請稍後再試' });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          匯款詳情
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{error}</p>
        </div>
      ) : data && (
        <div className="px-5">
          {/* Complete Result */}
          {completeResult && (
            <div
              className="rounded-xl p-3 mb-3 text-sm"
              style={{
                background: completeResult.success ? 'var(--color-positive)' : 'var(--color-negative)',
                color: '#fff',
              }}
            >
              {completeResult.success ? '✓' : '✗'} {completeResult.message}
            </div>
          )}

          {/* Remittance Number Card */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: STORE_COLORS[data.store] || 'var(--color-accent)', color: '#fff' }}
              >
                {data.store}
              </span>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  background: data.status === '已匯' ? 'var(--color-positive)' : 'var(--color-warning)',
                  color: '#fff',
                }}
              >
                {data.status === '已匯' ? '已匯款' : '待匯款'}
              </span>
            </div>

            {/* Big remittance number for copying */}
            <div className="p-3 rounded-xl mb-2" style={{ background: 'var(--color-bg-card-alt)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>匯款單號</div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                  {data.remittanceNo}
                </span>
                <button
                  onClick={() => copyToClipboard(data.remittanceNo)}
                  className="px-3 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  複製
                </button>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              請在銀行匯款時附註此單號，方便會計對帳
            </p>
          </div>

          {/* Remittance Info */}
          <Card title="💰 匯款資訊">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>廠商</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {data.supplierName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>需匯金額</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>
                  {fmt$(data.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>需求日期</span>
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {data.requestDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>到貨門市</span>
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {data.arrivalStore}
                </span>
              </div>
            </div>
          </Card>

          {/* Description */}
          {data.description && (
            <Card title="📦 商品說明">
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                {data.description}
              </p>
            </Card>
          )}

          {/* Photo */}
          {photoData && (
            <Card title="📷 附件照片">
              <button
                type="button"
                onClick={() => setPhotoFullscreen(true)}
                className="w-full rounded-lg overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoData} alt="附件照片" className="w-full object-contain rounded-lg" style={{ maxHeight: '300px' }} />
              </button>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>點擊照片可放大檢視</p>
            </Card>
          )}

          {/* Creator Info */}
          <Card title="👤 建檔資訊">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>建檔人員</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {data.creator}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>匯款門市</span>
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {data.store}
                </span>
              </div>
            </div>
          </Card>

          {/* Paid Info (if completed) */}
          {data.status === '已匯' && (
            <Card title="✅ 匯款完成">
              <div className="space-y-2">
                {data.paidDate && (
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>匯款日期</span>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {data.paidDate}
                    </span>
                  </div>
                )}
                {data.paidAmount && (
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>匯款金額</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-positive)' }}>
                      {fmt$(data.paidAmount)}
                    </span>
                  </div>
                )}
                {data.paidBy && (
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>匯款人員</span>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {data.paidBy}
                    </span>
                  </div>
                )}
                {data.paidNote && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>備註：</span>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {data.paidNote}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Complete Button (only for pending) */}
          {data.status !== '已匯' && (
            <div className="mb-3">
              <button
                onClick={() => setShowCompletePanel(!showCompletePanel)}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity"
                style={{ background: 'var(--color-positive)', color: '#fff' }}
              >
                ✅ 完成匯款
              </button>
            </div>
          )}

          {/* Complete Panel */}
          {showCompletePanel && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                確認匯款完成
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                    匯款金額
                  </label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    placeholder={String(data.amount)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                  />
                </div>

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                    備註（選填）
                  </label>
                  <textarea
                    value={paidNote}
                    onChange={e => setPaidNote(e.target.value)}
                    placeholder="例：已於今日完成匯款"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                  />
                </div>

                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  確認後將發送 Telegram 通知給建檔人員（{data.creator}）
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowCompletePanel(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--color-positive)', color: '#fff' }}
                >
                  {completing ? '處理中...' : '確認完成'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Photo Overlay */}
      {photoFullscreen && photoData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setPhotoFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold z-10 w-10 h-10 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            onClick={() => setPhotoFullscreen(false)}
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoData} alt="附件照片" className="max-w-full max-h-full object-contain p-4" />
        </div>
      )}

      <BottomNav active="reports" />
    </div>
  );
}
