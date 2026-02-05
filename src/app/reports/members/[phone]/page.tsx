'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface MemberTransaction {
  transaction_date: string;
  store: string;
  product_id: string;
  product_name: string;
  quantity: number;
  total: number;
  transaction_type: string;
}

interface MemberDetail {
  phone: string;
  name: string;
  member_level: string;
  total_spent: number;
  line_binding: boolean;
  transactions: MemberTransaction[];
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  vip: { label: '💎 VIP', color: '#8B5CF6' },
  gold: { label: '🥇 金卡', color: '#F59E0B' },
  silver: { label: '🥈 銀卡', color: '#6B7280' },
  normal: { label: '一般', color: 'var(--color-bg-card-alt)' },
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const phone = decodeURIComponent(params.phone as string);
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/reports/members/${encodeURIComponent(phone)}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [phone]);

  const levelInfo = LEVEL_LABELS[data?.member_level || 'normal'] || LEVEL_LABELS.normal;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          會員資訊
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到會員資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Member Info Card */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {data.name || '未知'}
                </h2>
                <a
                  href={`tel:${data.phone}`}
                  className="text-sm"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {data.phone}
                </a>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: levelInfo.color, color: '#fff' }}
              >
                {levelInfo.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>累計消費</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                  {fmt$(data.total_spent)}
                </p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>LINE 綁定</p>
                <p className="text-lg font-bold" style={{ color: data.line_binding ? 'var(--color-positive)' : 'var(--color-text-muted)' }}>
                  {data.line_binding ? '✓ 已綁定' : '✗ 未綁定'}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            交易紀錄（最近 50 筆）
          </h3>
          {data.transactions.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
              無交易紀錄
            </p>
          ) : (
            <div className="space-y-2">
              {data.transactions.map((t, i) => (
                <Link
                  key={i}
                  href={`/reports/products/${encodeURIComponent(t.product_id)}`}
                  className="block rounded-xl p-3"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                      {t.product_name}
                    </span>
                    <span
                      className="text-sm font-medium tabular-nums"
                      style={{ color: t.transaction_type === '銷退' ? 'var(--color-negative)' : 'var(--color-positive)' }}
                    >
                      {t.transaction_type === '銷退' ? '-' : ''}{fmt$(t.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    <span>
                      {t.transaction_date}
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: STORE_COLORS[t.store] || 'var(--color-accent)', color: '#fff' }}
                      >
                        {t.store}
                      </span>
                    </span>
                    <span>x{t.quantity}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav active="reports" />
    </div>
  );
}
