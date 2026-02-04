'use client';

import { useState, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface MemberTransaction {
  transaction_date: string;
  store: string;
  product_name: string;
  quantity: number;
  total: number;
  transaction_type: string;
}

interface MemberInfo {
  phone: string;
  name: string;
  member_level: string;
  total_spent: number;
  line_bindind: boolean;
  transactions: MemberTransaction[];
}

const LEVEL_LABELS: Record<string, string> = {
  vip: '💎 VIP',
  gold: '🥇 金卡',
  silver: '🥈 銀卡',
  normal: '一般',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function MembersReportPage() {
  const [search, setSearch] = useState('');
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/members?q=${encodeURIComponent(search.trim())}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMember(json.data);
      } else {
        setMember(null);
        setError(json.error || '找不到會員');
      }
    } catch {
      setMember(null);
      setError('查詢失敗');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/reports" className="text-xl">←</Link>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          👥 會員交易查詢
        </h1>
      </div>

      {/* Search */}
      <div className="px-5">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="輸入手機號碼或姓名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-11 px-4 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="h-11 px-5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            查詢
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="px-5 mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{error}</p>
          </div>
        ) : searched && !member ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到符合的會員</p>
          </div>
        ) : member && (
          <>
            {/* Member Info Card */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {member.name || '未知'}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{member.phone}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: member.member_level === 'vip' ? '#8B5CF6' :
                              member.member_level === 'gold' ? '#F59E0B' :
                              member.member_level === 'silver' ? '#6B7280' : 'var(--color-bg-card-alt)',
                    color: '#fff',
                  }}>
                  {LEVEL_LABELS[member.member_level] || member.member_level}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>累計消費</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                    {fmt$(member.total_spent)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>LINE 綁定</p>
                  <p className="text-lg font-bold" style={{ color: member.line_bindind ? 'var(--color-positive)' : 'var(--color-text-muted)' }}>
                    {member.line_bindind ? '✓ 已綁定' : '✗ 未綁定'}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              交易紀錄（最近 50 筆）
            </h3>
            {member.transactions.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                無交易紀錄
              </p>
            ) : (
              <div className="space-y-2">
                {member.transactions.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3"
                    style={{ background: 'var(--color-bg-card)' }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                        {t.product_name}
                      </span>
                      <span className="text-sm font-medium tabular-nums"
                        style={{ color: t.transaction_type === '銷退' ? 'var(--color-negative)' : 'var(--color-positive)' }}>
                        {t.transaction_type === '銷退' ? '-' : ''}{fmt$(t.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{t.transaction_date} · {t.store}</span>
                      <span>x{t.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav active="reports" />
    </div>
  );
}
