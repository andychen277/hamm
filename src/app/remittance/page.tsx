'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface RemittanceItem {
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

const STATUS_COLORS: Record<string, string> = {
  '開單': 'var(--color-warning)',
  '已匯': 'var(--color-positive)',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function RemittanceListPage() {
  const router = useRouter();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [store, setStore] = useState('all');
  const [status, setStatus] = useState('all');
  const [results, setResults] = useState<RemittanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        ...(store !== 'all' && { store }),
        ...(status !== 'all' && { status }),
      });
      const res = await fetch(`/api/reports/remittances?${params}`);
      const json = await res.json();
      if (json.success) setResults(json.data);
      else setResults([]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, store, status]);

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Calculate totals
  const pending = results.filter(r => r.status !== '已匯');
  const completed = results.filter(r => r.status === '已匯');
  const pendingTotal = pending.reduce((sum, r) => sum + r.amount, 0);
  const completedTotal = completed.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-xl">←</button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            💰 匯款需求
          </h1>
        </div>
        <Link
          href="/remittance/create"
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          + 新增
        </Link>
      </div>

      {/* Search Form */}
      <div className="px-5 space-y-3">
        {/* Date range */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-card-alt)',
              }}
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-card-alt)',
              }}
            />
          </div>
        </div>

        {/* Quick date buttons */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '今天', days: 0 },
            { label: '7天', days: 7 },
            { label: '30天', days: 30 },
            { label: '90天', days: 90 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setQuickRange(days)}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Store & Status filters */}
        <div className="flex gap-2">
          <select
            value={store}
            onChange={e => setStore(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          >
            <option value="all">全部門市</option>
            <option value="台南">台南</option>
            <option value="崇明">崇明</option>
            <option value="高雄">高雄</option>
            <option value="台中">台中</option>
            <option value="台北">台北</option>
            <option value="美術">美術</option>
            <option value="配貨">配貨</option>
          </select>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          >
            <option value="all">全部狀態</option>
            <option value="開單">待匯款</option>
            <option value="已匯">已匯款</option>
          </select>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full h-11 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? '查詢中...' : '查詢'}
        </button>
      </div>

      {/* Summary */}
      {searched && results.length > 0 && (
        <div className="px-5 mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-warning)' }}>待匯款</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {fmt$(pendingTotal)}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pending.length} 筆</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-positive)' }}>已匯款</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {fmt$(completedTotal)}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{completed.length} 筆</div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-5 mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無符合條件的匯款記錄</p>
          </div>
        ) : results.length > 0 && (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              共 {results.length} 筆匯款需求
            </p>
            <div className="space-y-2">
              {results.map((item, i) => (
                <Link
                  key={`${item.remittanceNo}-${i}`}
                  href={`/remittance/${encodeURIComponent(item.remittanceNo)}`}
                  className="block rounded-xl p-3 transition-opacity active:opacity-80"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  {/* Header: Store, Status, Date */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: STORE_COLORS[item.store] || 'var(--color-accent)', color: '#fff' }}
                    >
                      {item.store}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: STATUS_COLORS[item.status] || 'var(--color-text-muted)', color: '#fff' }}
                    >
                      {item.status === '已匯' ? '已匯款' : '待匯款'}
                    </span>
                    <span className="text-[11px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                      {item.requestDate}
                    </span>
                  </div>

                  {/* Supplier & Amount */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {item.supplierName}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                        建檔人：{item.creator}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums" style={{ color: item.status === '已匯' ? 'var(--color-positive)' : 'var(--color-warning)' }}>
                      {fmt$(item.amount)}
                    </span>
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.description}
                    </p>
                  )}

                  {/* Remittance number */}
                  <div className="flex justify-between text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    <span>單號: {item.remittanceNo}</span>
                    {item.arrivalStore && (
                      <span>到貨: {item.arrivalStore}</span>
                    )}
                  </div>

                  {/* Paid info if available */}
                  {item.status === '已匯' && item.paidDate && (
                    <div className="mt-2 pt-2 border-t text-[11px]" style={{ borderColor: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}>
                      已於 {item.paidDate} 匯款 {fmt$(item.paidAmount || item.amount)}
                      {item.paidBy && ` (${item.paidBy})`}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav active="reports" />
    </div>
  );
}
