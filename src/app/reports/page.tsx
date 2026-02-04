'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';

type ReportType = 'daily' | 'weekly' | 'monthly';

interface StoreRow { store: string; revenue: number; orders: number; avg_order: number }
interface ProductRow { product_name: string; quantity: number; revenue: number }
interface LevelRow { level: string; count: number }

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B35', '高雄': '#F7C948', '台中': '#2EC4B6', '台北': '#E71D73', '美術': '#9B5DE5',
};

const LEVEL_LABELS: Record<string, string> = {
  vip: '💎 VIP', gold: '🥇 金卡', silver: '🥈 銀卡', normal: '一般',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

function ChangeTag({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="text-xs font-medium ml-1" style={{ color: value >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
      {value >= 0 ? '↑' : '↓'}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StoreTable({ stores }: { stores: StoreRow[] }) {
  if (!stores.length) return <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>無資料</p>;
  return (
    <div className="space-y-2">
      {stores.map(s => (
        <div key={s.store} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STORE_COLORS[s.store] || '#64748b' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.store}店</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{fmt$(s.revenue)}</span>
            <span className="text-[11px] ml-2" style={{ color: 'var(--color-text-muted)' }}>{s.orders}單</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductList({ products }: { products: ProductRow[] }) {
  if (!products.length) return null;
  return (
    <div className="space-y-1.5">
      {products.map((p, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="truncate flex-1 mr-2" style={{ color: 'var(--color-text-secondary)' }}>
            {i + 1}. {p.product_name}
          </span>
          <span className="tabular-nums flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>{fmt$(p.revenue)}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
      <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>('daily');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${type}/${date}`);
      const json = await res.json();
      if (json.success) setReport(json.data);
      else setReport(null);
    } catch { setReport(null); }
    finally { setLoading(false); }
  }, [type, date]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const navigateDate = (dir: number) => {
    const d = new Date(date);
    if (type === 'daily') d.setDate(d.getDate() + dir);
    else if (type === 'weekly') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setDate(d.toISOString().split('T')[0]);
  };

  const dateLabel = () => {
    if (!report) return date;
    if (type === 'daily') return `${report.date}（${report.weekday}）`;
    if (type === 'weekly') return `${report.week_start} ~ ${report.week_end}`;
    return report.month;
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>📊 報表</h1>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 px-5 mb-3">
        {(['daily', 'weekly', 'monthly'] as ReportType[]).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: type === t ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: type === t ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {t === 'daily' ? '日報' : t === 'weekly' ? '週報' : '月報'}
          </button>
        ))}
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between px-5 mb-4">
        <button onClick={() => navigateDate(-1)} className="p-2 rounded-lg" style={{ color: 'var(--color-text-secondary)' }}>←</button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{dateLabel()}</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-5 h-5 opacity-0 absolute"
            style={{ cursor: 'pointer' }}
          />
        </div>
        <button onClick={() => navigateDate(1)} className="p-2 rounded-lg" style={{ color: 'var(--color-text-secondary)' }}>→</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !report ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無報表資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Revenue summary */}
          <Card title="📈 營收摘要">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                {fmt$(report.total_revenue)}
              </span>
              <ChangeTag value={report.revenue_change} />
            </div>
            {type === 'daily' && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                本月累計：{fmt$(report.month_cumulative)}
              </p>
            )}
            {type === 'monthly' && report.yoy_change !== null && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                YoY {report.yoy_change >= 0 ? '+' : ''}{report.yoy_change.toFixed(1)}%（去年同期 {fmt$(report.yoy_revenue)}）
              </p>
            )}
          </Card>

          {/* Store breakdown */}
          <Card title="🏪 各門市表現">
            <StoreTable stores={report.stores} />
          </Card>

          {/* Top products (weekly/monthly) */}
          {report.top_products && report.top_products.length > 0 && (
            <Card title="🏆 暢銷商品 TOP 10">
              <ProductList products={report.top_products} />
            </Card>
          )}

          {/* Member stats */}
          <Card title="👥 會員動態">
            <div className="grid grid-cols-2 gap-3">
              {type === 'daily' && (
                <>
                  <div>
                    <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>{report.new_members}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>新加入</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>{report.new_line_bindings}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>LINE 新綁定</p>
                  </div>
                </>
              )}
              {(type === 'weekly' || type === 'monthly') && (
                <>
                  <div>
                    <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>{report.new_members ?? report.member_growth}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>新會員</p>
                  </div>
                  {report.active_members !== undefined && (
                    <div>
                      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>{report.active_members}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>活躍會員</p>
                    </div>
                  )}
                  {report.total_members !== undefined && (
                    <div>
                      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{report.total_members.toLocaleString()}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>總會員數</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Level distribution (monthly) */}
          {report.level_distribution && (
            <Card title="📊 會員等級分佈">
              <div className="space-y-2">
                {report.level_distribution.map((l: LevelRow) => (
                  <div key={l.level} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>{LEVEL_LABELS[l.level] || l.level}</span>
                    <span className="tabular-nums font-medium" style={{ color: 'var(--color-text-primary)' }}>{l.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Service status (daily) */}
          {type === 'daily' && (
            <Card title="🛠️ 服務狀態">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>{report.active_repairs}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>維修中</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>{report.pending_orders}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>待到貨</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>{report.completed_repairs}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>今日完修</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      <BottomNav active="reports" />
    </div>
  );
}
