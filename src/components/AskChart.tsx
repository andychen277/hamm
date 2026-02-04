'use client';

import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line,
  PieChart, Pie, Cell,
  CartesianGrid,
} from 'recharts';

const DEFAULT_COLORS = ['#FF6B35', '#F7C948', '#2EC4B6', '#E71D73', '#9B5DE5', '#64748b', '#818cf8', '#f472b6'];

function formatValue(value: number): string {
  if (value >= 100000000) return (value / 100000000).toFixed(1) + '億';
  if (value >= 10000) return (value / 10000).toFixed(0) + '萬';
  return value.toLocaleString();
}

interface ChartProps {
  type: string;
  data: Record<string, unknown>[];
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--color-bg-card-alt)', border: '1px solid var(--color-text-muted)' }}>
      <p style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold tabular-nums" style={{ color: p.name === 'value' ? 'var(--color-positive)' : DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}>
          {typeof p.value === 'number' ? formatValue(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AskChart({ type, data }: ChartProps) {
  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]).filter(k => k !== 'color');
  // First key = name/label, rest = numeric values
  const nameKey = keys[0];
  const valueKeys = keys.slice(1).filter(k => {
    return data.some(row => typeof row[k] === 'number');
  });

  if (valueKeys.length === 0) return null;

  if (type === 'horizontal_bar') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
          <XAxis type="number" tickFormatter={formatValue} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={nameKey} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
          <Tooltip content={<ChartTooltip />} />
          {valueKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} radius={[0, 6, 6, 0]} barSize={20}>
              {data.map((entry, j) => (
                <Cell key={j} fill={(entry.color as string) || DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
          <XAxis dataKey={nameKey} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatValue} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          {valueKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKeys[0]}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label={(props: any) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={(entry.color as string) || DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Default: table
  return (
    <div className="overflow-x-auto hide-scrollbar">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {keys.map(k => (
              <th key={k} className="text-left py-2 px-2 font-medium text-xs" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-bg-card-alt)' }}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i}>
              {keys.map(k => (
                <td key={k} className="py-1.5 px-2 tabular-nums" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                  {typeof row[k] === 'number' ? (row[k] as number).toLocaleString() : String(row[k] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 50 && (
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
          僅顯示前 50 筆，共 {data.length} 筆
        </p>
      )}
    </div>
  );
}
