'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface TrendData {
  period: string;
  revenue: number;
}

const RANGES = [
  { key: '7d', label: '7天' },
  { key: '30d', label: '30天' },
  { key: '6m', label: '6個月' },
  { key: '1y', label: '1年' },
];

function formatRevenue(value: number): string {
  if (value >= 100000000) return (value / 100000000).toFixed(1) + '億';
  if (value >= 10000) return (value / 10000).toFixed(0) + '萬';
  return value.toLocaleString();
}

function formatLabel(period: string): string {
  // "2026-02" → "2月", "2026-01-15" → "1/15"
  if (period.length === 7) {
    return parseInt(period.split('-')[1]) + '月';
  }
  const parts = period.split('-');
  return parseInt(parts[1]) + '/' + parseInt(parts[2]);
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--color-bg-card-alt)', border: '1px solid var(--color-text-muted)' }}>
      <p style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
      <p className="font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
        ${formatRevenue(payload[0].value)}
      </p>
    </div>
  );
};

export default function TrendChart() {
  const [range, setRange] = useState('6m');
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/trend?range=${range}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="mx-5 mt-4 rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          營收趨勢
        </h2>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{
                background: range === r.key ? 'var(--color-accent)' : 'transparent',
                color: range === r.key ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[200px]">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>暫無資料</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2EC4B6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2EC4B6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis
              dataKey="period"
              tickFormatter={formatLabel}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatRevenue}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#2EC4B6"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
