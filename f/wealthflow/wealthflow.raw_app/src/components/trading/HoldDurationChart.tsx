import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { HoldDuration } from '../../types';
import { formatPnl } from '../../lib/format';

interface HoldDurationChartProps {
  data: HoldDuration[];
}

const formatDurationAxis = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(0)}h`;
  return `${(minutes / 1440).toFixed(0)}d`;
};

const formatDurationFull = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hours`;
  return `${(minutes / 1440).toFixed(1)} days`;
};

export const HoldDurationChart: React.FC<HoldDurationChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-72 text-[var(--text-muted)] text-sm">
        Need matched buy/sell pairs to analyze hold durations.
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    x: d.durationMinutes,
    y: d.pnl,
    symbol: d.symbol,
    fill: d.pnl >= 0 ? '#10b981' : '#ef4444',
    key: i,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="x"
            type="number"
            name="Duration"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickFormatter={formatDurationAxis}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="P&L"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => `$${(v as number).toLocaleString()}`}
          />
          <ReferenceLine y={0} stroke="var(--border-default)" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as (typeof chartData)[0] | undefined;
              if (!point) return null;
              return (
                <div
                  className="rounded-lg p-3 shadow-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <p className="font-medium">{point.symbol}</p>
                  <p className="text-sm">Duration: {formatDurationFull(point.x)}</p>
                  <p className="text-sm" style={{ color: point.fill }}>
                    P&L: {formatPnl(point.y)}
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={chartData} fill="#6366f1">
            {chartData.map((entry) => (
              <circle key={entry.key} r={5} fill={entry.fill} fillOpacity={0.7} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
