import React, { useState } from 'react';
import type { CurrencyCode } from '../types/finance';
import { formatMoney } from '../utils/currency';
import type { ForecastDayPoint } from '../utils/forecast';
import type { NetWorthHistoryPoint } from '../utils/wealth';
import type { WealthProjectionPoint } from '../utils/portfolio';
import { useI18n } from '../i18n/useI18n';

export interface CashflowBarPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

export const CashflowChart: React.FC<{
  data: CashflowBarPoint[];
  currency: CurrencyCode;
  privacyMode: boolean;
}> = ({ data, currency, privacyMode }) => {
  const { t } = useI18n();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expense]), 100);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            {t('charts.income')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
            {t('charts.expenses')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {t('charts.net')}
            </span>
            {t('charts.netCashflowTop')}
          </span>
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800">
            <span className="font-semibold">{data[hoveredIdx].label}:</span>{' '}
            <span className="text-emerald-600 dark:text-emerald-400">
              +{formatMoney(data[hoveredIdx].income, currency, privacyMode)}
            </span>{' '}
            /{' '}
            <span className="text-rose-600 dark:text-rose-400">
              -{formatMoney(data[hoveredIdx].expense, currency, privacyMode)}
            </span>{' '}
            ({t('charts.net')}{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {formatMoney(data[hoveredIdx].net, currency, privacyMode)}
            </span>
            )
          </div>
        )}
      </div>

      <div
        className="grid h-56 items-end gap-2 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={t('charts.cashflowAria')}
      >
        {data.map((point, idx) => {
          const incPct = Math.round((point.income / maxVal) * 100);
          const expPct = Math.round((point.expense / maxVal) * 100);
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={point.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`group flex h-full flex-col items-center justify-end rounded-xl p-1.5 transition ${
                isHovered ? 'bg-slate-100/80 dark:bg-slate-800/70' : ''
              }`}
            >
              <div className="mb-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                {formatMoney(point.net, currency, privacyMode, true)}
              </div>
              <div className="flex h-40 w-full items-end justify-center gap-1.5">
                <div
                  className="w-3.5 rounded-t-md bg-emerald-500/90 transition-all duration-300 group-hover:bg-emerald-500 sm:w-5"
                  style={{ height: `${Math.max(incPct, 4)}%` }}
                  title={`${t('charts.income')}: ${formatMoney(point.income, currency, privacyMode)}`}
                />
                <div
                  className="w-3.5 rounded-t-md bg-rose-500/90 transition-all duration-300 group-hover:bg-rose-500 sm:w-5"
                  style={{ height: `${Math.max(expPct, 4)}%` }}
                  title={`${t('charts.expenses')}: ${formatMoney(point.expense, currency, privacyMode)}`}
                />
              </div>
              <span className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  icon?: string;
}

export const CategoryDonutChart: React.FC<{
  slices: DonutSlice[];
  currency: CurrencyCode;
  privacyMode: boolean;
  centerLabel?: string;
}> = ({ slices, currency, privacyMode, centerLabel }) => {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<string | null>(null);
  const resolvedCenter = centerLabel ?? t('charts.totalSpend');
  const nonZero = slices.filter((s) => s.value > 0);
  const total = nonZero.reduce((sum, s) => sum + s.value, 0);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  const activeSlice = nonZero.find((s) => s.id === activeId);

  return (
    <div className="flex flex-col items-center gap-4 xl:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth="18"
          />
          {nonZero.map((slice) => {
            const fraction = total > 0 ? slice.value / total : 0;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const offset = -cumulativeOffset;
            cumulativeOffset += dash;
            const isActive = activeId === slice.id;

            return (
              <circle
                key={slice.id}
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isActive ? 22 : 18}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setActiveId(slice.id)}
                onMouseLeave={() => setActiveId(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {activeSlice ? activeSlice.label : resolvedCenter}
          </span>
          <span className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
            {formatMoney(activeSlice ? activeSlice.value : total, currency, privacyMode, true)}
          </span>
          {activeSlice && total > 0 && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              {Math.round((activeSlice.value / total) * 100)}%
            </span>
          )}
        </div>
      </div>

      <div className="w-full min-w-0 flex-1 space-y-2">
        {nonZero.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('charts.noExpenses')}
          </p>
        ) : (
          nonZero.slice(0, 6).map((slice) => {
            const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            return (
              <div
                key={slice.id}
                onMouseEnter={() => setActiveId(slice.id)}
                onMouseLeave={() => setActiveId(null)}
                className="flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {slice.icon ? `${slice.icon} ` : ''}
                    {slice.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatMoney(slice.value, currency, privacyMode, true)}
                  </span>
                  <span className="w-7 text-right text-slate-500 dark:text-slate-400">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const CashflowForecastChart: React.FC<{
  points: ForecastDayPoint[];
  currency: CurrencyCode;
  privacyMode: boolean;
  lowThreshold?: number;
}> = ({ points, currency, privacyMode, lowThreshold = 1000 }) => {
  const { t } = useI18n();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length === 0) return null;

  const balances = points.map((p) => p.balance);
  const minVal = Math.min(...balances, lowThreshold, 0);
  const maxVal = Math.max(...balances, lowThreshold + 500, 100);
  const span = maxVal - minVal || 1;

  const width = 640;
  const height = 180;
  const padX = 12;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toX = (idx: number) =>
    padX + (points.length > 1 ? (idx / (points.length - 1)) * innerW : 0);
  const toY = (val: number) =>
    padY + innerH - ((val - minVal) / span) * innerH;

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(1)} ${toY(pt.balance).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${toX(points.length - 1).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  const thresholdY = toY(lowThreshold);
  const activePoint = hoverIdx !== null ? points[hoverIdx] : null;
  const eventIndices = points
    .map((p, i) => (p.events.length > 0 ? i : -1))
    .filter((i) => i >= 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <span>{points[0].label}</span>
          <span>→</span>
          <span>{points[Math.floor(points.length / 2)].label}</span>
          <span>→</span>
          <span>{points[points.length - 1].label}</span>
        </div>
        {activePoint ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
            {activePoint.label}: {formatMoney(activePoint.balance, currency, privacyMode)}
            {activePoint.events.length > 0 && (
              <span className="ml-1.5 font-normal">
                ({activePoint.events.map((e) => e.title).join(', ')})
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">
            {t('charts.hoverForecast')}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full overflow-visible"
        role="img"
        aria-label={t('charts.forecastAria')}
      >
        <defs>
          <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {thresholdY >= padY && thresholdY <= padY + innerH && (
          <g>
            <line
              x1={padX}
              y1={thresholdY}
              x2={width - padX}
              y2={thresholdY}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />
            <text
              x={padX + 4}
              y={Math.max(12, thresholdY - 4)}
              fontSize="10"
              fill="#d97706"
              fontWeight="600"
            >
              {t('charts.buffer', { amt: formatMoney(lowThreshold, currency, privacyMode, true) })}
            </text>
          </g>
        )}

        <path d={areaPath} fill="url(#forecastArea)" />
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />

        {eventIndices.map((idx) => {
          const pt = points[idx];
          const cx = toX(idx);
          const cy = toY(pt.balance);
          const isPositive = pt.delta >= 0;
          const isWarn = pt.balance < lowThreshold;
          return (
            <circle
              key={pt.date}
              cx={cx}
              cy={cy}
              r={hoverIdx === idx ? 5.5 : 3.8}
              fill={isWarn ? '#ef4444' : isPositive ? '#10b981' : '#f97316'}
              stroke="#ffffff"
              strokeWidth="1.5"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}
      </svg>
    </div>
  );
};

export const NetWorthHistoryChart: React.FC<{
  points: NetWorthHistoryPoint[];
  currency: CurrencyCode;
  privacyMode: boolean;
}> = ({ points, currency, privacyMode }) => {
  const { t } = useI18n();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (points.length === 0) return null;

  const vals = points.flatMap((p) => [p.assets, p.netWorth, p.liabilities]);
  const minVal = Math.min(...vals, 0);
  const maxVal = Math.max(...vals, 100);
  const span = maxVal - minVal || 1;

  const width = 560;
  const height = 180;
  const padX = 18;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toX = (idx: number) =>
    padX + (points.length > 1 ? (idx / (points.length - 1)) * innerW : 0);
  const toY = (val: number) =>
    padY + innerH - ((val - minVal) / span) * innerH;

  const buildPath = (getter: (p: NetWorthHistoryPoint) => number) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(getter(p)).toFixed(1)}`)
      .join(' ');

  const netPath = buildPath((p) => p.netWorth);
  const assetsPath = buildPath((p) => p.assets);
  const netArea = `${netPath} L ${toX(points.length - 1).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  const active = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
            {t('charts.netWorth')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-emerald-500" />
            {t('charts.assets')}
          </span>
        </div>
        {active && (
          <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">
            {active.label}:{' '}
            <span className="text-violet-600 dark:text-violet-400">
              {formatMoney(active.netWorth, currency, privacyMode)}
            </span>{' '}
            <span className="text-slate-500">
              ({t('charts.assets')} {formatMoney(active.assets, currency, privacyMode, true)})
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full overflow-visible"
        role="img"
        aria-label={t('charts.netWorthAria')}
      >
        <defs>
          <linearGradient id="netWorthArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={netArea} fill="url(#netWorthArea)" />
        <path
          d={assetsPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.6"
          strokeDasharray="4 4"
        />
        <path d={netPath} fill="none" stroke="#7c3aed" strokeWidth="2.8" strokeLinejoin="round" />

        {points.map((pt, idx) => (
          <g key={pt.month}>
            <circle
              cx={toX(idx)}
              cy={toY(pt.netWorth)}
              r={hoverIdx === idx ? 5.5 : 4}
              fill="#7c3aed"
              stroke="#ffffff"
              strokeWidth="1.5"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
            />
            <text
              x={toX(idx)}
              y={height - 2}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
              fontWeight="600"
            >
              {pt.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export const WealthProjectionChart: React.FC<{
  points: WealthProjectionPoint[];
  currency: CurrencyCode;
  privacyMode: boolean;
}> = ({ points, currency, privacyMode }) => {
  const { t } = useI18n();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length === 0) return null;

  const maxVal = Math.max(...points.map((p) => p.projectedValue), 100);
  const minVal = 0;
  const span = maxVal - minVal || 1;

  const width = 620;
  const height = 190;
  const padX = 20;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toX = (idx: number) =>
    padX + (points.length > 1 ? (idx / (points.length - 1)) * innerW : 0);
  const toY = (val: number) => padY + innerH - ((val - minVal) / span) * innerH;

  const buildPath = (getter: (p: WealthProjectionPoint) => number) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(getter(p)).toFixed(1)}`)
      .join(' ');

  const totalPath = buildPath((p) => p.projectedValue);
  const contribPath = buildPath((p) => p.contributedCapital);
  const totalArea = `${totalPath} L ${toX(points.length - 1).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  const active = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            {t('charts.projectedWealth')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-slate-400" />
            {t('charts.investedCapital')}
          </span>
        </div>
        {active && (
          <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">
            {active.label}:{' '}
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatMoney(active.projectedValue, currency, privacyMode)}
            </span>{' '}
            <span className="text-slate-500">
              ({t('charts.investedCapital')}{' '}
              {formatMoney(active.contributedCapital, currency, privacyMode, true)})
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full overflow-visible"
        role="img"
        aria-label={t('charts.wealthProjAria')}
      >
        <defs>
          <linearGradient id="wealthProjArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={totalArea} fill="url(#wealthProjArea)" />
        <path
          d={contribPath}
          fill="none"
          stroke="#64748b"
          strokeWidth="1.8"
          strokeDasharray="4 4"
        />
        <path d={totalPath} fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinejoin="round" />

        {points.map((pt, idx) => {
          const showLabel =
            points.length <= 11 || idx === 0 || idx === points.length - 1 || idx % 2 === 0;
          return (
            <g key={pt.year}>
              <circle
                cx={toX(idx)}
                cy={toY(pt.projectedValue)}
                r={hoverIdx === idx ? 5.5 : 3.5}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
              />
              {showLabel && (
                <text
                  x={toX(idx)}
                  y={height - 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748b"
                  fontWeight="600"
                >
                  {pt.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
