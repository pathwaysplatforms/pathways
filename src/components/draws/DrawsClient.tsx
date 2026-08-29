'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';

export interface Draw {
  id: string;
  draw_date: string;
  draw_type: string;
  cutoff_score: number;
  invitations_issued: number;
  round_number: number;
  program: string | null;
}

type YearRange = 'all' | '5y' | '2y';

const DRAW_TYPE_COLORS: Record<string, string> = {
  general:         '#1A56DB',
  cec:             '#0EA5E9',
  pnp:             '#8B5CF6',
  french_language: '#F59E0B',
  healthcare:      '#10B981',
  trades:          '#EF4444',
  fst:             '#6B7280',
  stem:            '#EC4899',
  transport:       '#14B8A6',
  agriculture:     '#84CC16',
  education:       '#F97316',
  senior_managers: '#A855F7',
  fsw:             '#06B6D4',
};

const DRAW_TYPE_LABELS: Record<string, string> = {
  general:         'General',
  cec:             'CEC',
  pnp:             'PNP',
  french_language: 'French Language',
  healthcare:      'Healthcare',
  trades:          'Trades',
  fst:             'FST',
  stem:            'STEM',
  transport:       'Transport',
  agriculture:     'Agriculture',
  education:       'Education',
  senior_managers: 'Senior Managers',
  fsw:             'FSW',
};

const DEFAULT_VISIBLE = ['general', 'cec', 'pnp', 'french_language'];

const YEAR_RANGE_OPTIONS: { label: string; value: YearRange }[] = [
  { label: 'All time',     value: 'all' },
  { label: 'Last 5 years', value: '5y'  },
  { label: 'Last 2 years', value: '2y'  },
];

/** Small non-clickable pill showing a draw type with its colour. */
export function DrawTypeBadge({ type }: { type: string }) {
  const color = DRAW_TYPE_COLORS[type] ?? '#9CA3AF';
  const label = DRAW_TYPE_LABELS[type] ?? type;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'var(--pw-font-ui)',
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

function formatDrawDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface LineTooltipItem {
  name: string;
  value: number | null | undefined;
  stroke: string;
  payload: Record<string, number>;
}

interface CustomLineTooltipProps {
  active?: boolean;
  payload?: LineTooltipItem[];
  label?: number;
}

function CustomLineTooltip({ active, payload, label }: CustomLineTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const items = payload.filter((p): p is LineTooltipItem & { value: number } => p.value != null);
  if (items.length === 0) return null;

  const dateLabel =
    label != null
      ? new Date(label).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #EAEDF0',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.07)',
        fontFamily: 'var(--pw-font-body)',
        minWidth: 200,
      }}
    >
      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{dateLabel}</p>
      {items.map((item, i) => {
        const inv = item.payload[`_inv_${item.name}`];
        const rnd = item.payload[`_rnd_${item.name}`];
        return (
          <div
            key={i}
            style={{
              borderTop: i > 0 ? '1px solid #EAEDF0' : undefined,
              paddingTop: i > 0 ? 8 : 0,
              paddingBottom: i < items.length - 1 ? 8 : 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 6,
              }}
            >
              <DrawTypeBadge type={item.name} />
              {rnd != null && (
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Round #{rnd}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Cutoff
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: item.stroke, lineHeight: 1.2 }}>
                  {item.value.toLocaleString()}
                </p>
              </div>
              {inv != null && (
                <div>
                  <p style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Invitations
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#0D0D0D', lineHeight: 1.2 }}>
                    {inv.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CustomBarTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { type: string; total: number } }>;
}

function CustomBarTooltip({ active, payload }: CustomBarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const color = DRAW_TYPE_COLORS[d.type] ?? '#9CA3AF';
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #EAEDF0',
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.07)',
        fontFamily: 'var(--pw-font-body)',
      }}
    >
      <DrawTypeBadge type={d.type} />
      <p style={{ fontSize: 18, fontWeight: 700, color, marginTop: 4 }}>
        {d.total.toLocaleString()}
      </p>
      <p style={{ fontSize: 11, color: '#9CA3AF' }}>total invitations</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ w = '100%', h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div
      className="pw-skeleton"
      style={{ width: w, height: h, borderRadius: 8 }}
    />
  );
}

function DrawsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '28px 28px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <SkeletonBlock w={120} h={11} />
        <div style={{ height: 8 }} />
        <SkeletonBlock w={280} h={36} />
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              border: '1px solid #EAEDF0',
              borderRadius: 12,
              padding: '18px 20px',
            }}
          >
            <SkeletonBlock w={80} h={10} />
            <div style={{ height: 10 }} />
            <SkeletonBlock w={60} h={32} />
          </div>
        ))}
      </div>

      {/* Main chart card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #EAEDF0',
          borderRadius: 12,
          padding: '24px 24px 20px',
          marginBottom: 20,
        }}
      >
        <SkeletonBlock w={200} h={18} />
        <div style={{ height: 16 }} />
        <SkeletonBlock w="100%" h={420} />
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              border: '1px solid #EAEDF0',
              borderRadius: 12,
              padding: '24px 24px 20px',
            }}
          >
            <SkeletonBlock w={160} h={18} />
            <div style={{ height: 16 }} />
            <SkeletonBlock w="100%" h={320} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  eyebrow: string;
  value: string | number;
  sub: React.ReactNode;
  delay?: number;
}

function KpiCard({ eyebrow, value, sub, delay = 0 }: KpiCardProps) {
  return (
    <div
      className="pw-entry is-visible"
      style={{
        background: '#fff',
        border: '1px solid #EAEDF0',
        borderRadius: 12,
        padding: '18px 20px',
        animationDelay: `${delay}ms`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--pw-font-ui)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#9CA3AF',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </p>
      <p
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: 28,
          fontWeight: 700,
          color: '#0D0D0D',
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </p>
      <div style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#6B6B6B' }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface DrawsClientProps {
  draws: Draw[];
}

/** @public All interactivity for the Express Entry draws history page. */
export function DrawsClient({ draws }: DrawsClientProps) {
  const [mounted, setMounted] = useState(false);
  const [yearRange, setYearRange] = useState<YearRange>('all');
  const [visibleTypes, setVisibleTypes] = useState<string[]>(DEFAULT_VISIBLE);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Filtered draws (by year range) ────────────────────────────────────────
  const filteredDraws = useMemo(() => {
    if (yearRange === 'all') return draws;
    const yearsBack = yearRange === '5y' ? 5 : 2;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
    cutoff.setMonth(0, 1);
    return draws.filter((d) => new Date(d.draw_date) >= cutoff);
  }, [draws, yearRange]);

  // ── KPI derivations (always from full dataset) ─────────────────────────────
  const kpis = useMemo(() => {
    if (draws.length === 0) {
      return { latest: null, lowest: null, highest: null, total: 0 };
    }

    let latest: Draw = draws[draws.length - 1]!;
    let lowest: Draw = draws[0]!;
    let highest: Draw = draws[0]!;

    for (const d of draws) {
      if (new Date(d.draw_date) > new Date(latest.draw_date)) latest = d;
      if (d.cutoff_score < lowest.cutoff_score) lowest = d;
      if (d.cutoff_score > highest.cutoff_score) highest = d;
    }

    return { latest, lowest, highest, total: draws.length };
  }, [draws]);

  // ── All draw types present in dataset ─────────────────────────────────────
  const allTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const d of draws) seen.add(d.draw_type);
    const priority = Object.keys(DRAW_TYPE_LABELS);
    return [
      ...priority.filter((t) => seen.has(t)),
      ...[...seen].filter((t) => !priority.includes(t)),
    ];
  }, [draws]);

  // ── Pivoted dataset for LineChart — one entry per unique date timestamp ───
  // Each draw_type is a key; invitations + round stored under prefixed keys
  // so the XAxis sees a single contiguous domain and years are evenly spaced.
  const chartData = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const d of filteredDraws) {
      const ts = new Date(d.draw_date).getTime();
      if (!map.has(ts)) map.set(ts, { date: ts });
      const entry = map.get(ts)!;
      entry[d.draw_type] = d.cutoff_score;
      entry[`_inv_${d.draw_type}`] = d.invitations_issued;
      entry[`_rnd_${d.draw_type}`] = d.round_number;
    }
    return [...map.values()].sort((a, b) => a.date - b.date);
  }, [filteredDraws]);

  // ── Explicit year-boundary ticks for equal visual spacing ─────────────────
  const yearTicks = useMemo(() => {
    if (filteredDraws.length === 0) return [];
    const times = filteredDraws.map((d) => new Date(d.draw_date).getTime());
    const minYear = new Date(Math.min(...times)).getFullYear();
    const maxYear = new Date(Math.max(...times)).getFullYear();
    return Array.from(
      { length: maxYear - minYear + 1 },
      (_, i) => new Date(minYear + i, 0, 1).getTime(),
    );
  }, [filteredDraws]);

  // ── Invitations by type (bar chart) ───────────────────────────────────────
  const invitationsByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of filteredDraws) {
      if (!visibleTypes.includes(d.draw_type)) continue;
      map[d.draw_type] = (map[d.draw_type] ?? 0) + d.invitations_issued;
    }
    return Object.entries(map)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDraws, visibleTypes]);

  // ── Draws per year (area chart — full dataset, not filtered) ──────────────
  const drawsPerYear = useMemo(() => {
    const map: Record<number, number> = {};
    for (const d of draws) {
      const year = new Date(d.draw_date).getFullYear();
      map[year] = (map[year] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([y, count]) => ({ year: parseInt(y, 10), count }))
      .sort((a, b) => a.year - b.year);
  }, [draws]);

  // ── Toggle draw type ───────────────────────────────────────────────────────
  function toggleType(type: string) {
    setVisibleTypes((prev) =>
      prev.includes(type)
        ? prev.length > 1
          ? prev.filter((t) => t !== type)
          : prev
        : [...prev, type],
    );
  }

  if (!mounted) return <DrawsSkeleton />;

  return (
    <div className="flex-1 overflow-y-auto pw-page-enter" style={{ padding: '28px 28px 48px' }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="pw-entry is-visible" style={{ marginBottom: 28 }}>
        <p className="pw-eyebrow" style={{ marginBottom: 8 }}>EXPRESS ENTRY</p>
        <h1
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            fontWeight: 700,
            color: 'var(--pw-ink)',
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Draws History
        </h1>
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            color: 'var(--pw-muted)',
          }}
        >
          {draws.length} rounds · 2015 – present · All data from IRCC
        </p>
      </div>

      {/* ── Section 1 — KPI strip ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          eyebrow="Latest draw"
          value={kpis.latest?.cutoff_score.toLocaleString() ?? '—'}
          delay={60}
          sub={
            kpis.latest ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>
                  Round #{kpis.latest.round_number} ·{' '}
                  {formatDrawDate(kpis.latest.draw_date)}
                </span>
                <DrawTypeBadge type={kpis.latest.draw_type} />
              </div>
            ) : (
              '—'
            )
          }
        />

        <KpiCard
          eyebrow="Lowest cutoff ever"
          value={kpis.lowest?.cutoff_score.toLocaleString() ?? '—'}
          delay={100}
          sub={
            kpis.lowest ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{formatDrawDate(kpis.lowest.draw_date)}</span>
                <DrawTypeBadge type={kpis.lowest.draw_type} />
              </div>
            ) : (
              '—'
            )
          }
        />

        <KpiCard
          eyebrow="Highest cutoff ever"
          value={kpis.highest?.cutoff_score.toLocaleString() ?? '—'}
          delay={140}
          sub={
            kpis.highest ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{formatDrawDate(kpis.highest.draw_date)}</span>
                <DrawTypeBadge type={kpis.highest.draw_type} />
              </div>
            ) : (
              '—'
            )
          }
        />

        <KpiCard
          eyebrow="Total draws"
          value={kpis.total.toLocaleString()}
          delay={180}
          sub="across 12 years of Express Entry"
        />
      </div>

      {/* ── Year range filter ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--pw-font-ui)',
            fontSize: 12,
            color: '#9CA3AF',
            flexShrink: 0,
          }}
        >
          Show:
        </p>
        <div
          style={{
            display: 'inline-flex',
            border: '1px solid #EAEDF0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {YEAR_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setYearRange(opt.value)}
              style={{
                padding: '6px 14px',
                fontFamily: 'var(--pw-font-ui)',
                fontSize: 13,
                fontWeight: yearRange === opt.value ? 500 : 400,
                color: yearRange === opt.value ? '#fff' : '#4B5563',
                background: yearRange === opt.value ? '#1A56DB' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 150ms cubic-bezier(0.16,1,0.3,1), color 150ms ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 2 — Main line chart ───────────────────────────────────── */}
      <div
        className="pw-entry is-visible"
        style={{
          background: '#fff',
          border: '1px solid #EAEDF0',
          borderRadius: 12,
          padding: '24px 24px 20px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          animationDelay: '220ms',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: 15,
                fontWeight: 700,
                color: '#0D0D0D',
              }}
            >
              Cutoff Score Over Time
            </p>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              Minimum CRS score to receive an Invitation to Apply
            </p>
          </div>

          {/* Type toggle pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allTypes.map((type) => {
              const active = visibleTypes.includes(type);
              const color = DRAW_TYPE_COLORS[type] ?? '#9CA3AF';
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 500,
                    fontFamily: 'var(--pw-font-ui)',
                    cursor: 'pointer',
                    border: `1px solid ${active ? color : '#D8DCE1'}`,
                    background: active ? color : 'transparent',
                    color: active ? '#fff' : '#6B7280',
                    transition: 'background 150ms cubic-bezier(0.16,1,0.3,1), color 150ms ease, border-color 150ms ease',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: active ? 'rgba(255,255,255,0.8)' : color,
                      flexShrink: 0,
                    }}
                  />
                  {DRAW_TYPE_LABELS[type] ?? type}
                </button>
              );
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#EAEDF0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={yearTicks}
              tickFormatter={(v: number) => new Date(v).getFullYear().toString()}
              tick={{ fontFamily: 'Urbanist', fontSize: 12, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={{ stroke: '#EAEDF0' }}
            />
            <YAxis
              domain={[0, 1000]}
              tick={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip content={<CustomLineTooltip />} />
            {visibleTypes.map((type) => (
              <Line
                key={type}
                dataKey={type}
                type="monotone"
                stroke={DRAW_TYPE_COLORS[type] ?? '#9CA3AF'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Section 3 — Two-column grid ───────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}
      >
        {/* Left — Invitations by draw type (horizontal bar) */}
        <div
          className="pw-entry is-visible"
          style={{
            background: '#fff',
            border: '1px solid #EAEDF0',
            borderRadius: 12,
            padding: '24px 24px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            animationDelay: '280ms',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: 15,
              fontWeight: 700,
              color: '#0D0D0D',
              marginBottom: 4,
            }}
          >
            Invitations by Draw Type
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 12,
              color: '#9CA3AF',
              marginBottom: 20,
            }}
          >
            Total ITAs issued · filtered by visible types
          </p>

          {invitationsByType.length === 0 ? (
            <div
              style={{
                height: 320,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9CA3AF',
                fontSize: 13,
                fontFamily: 'var(--pw-font-body)',
              }}
            >
              No draw types selected
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={invitationsByType}
                margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={{ stroke: '#EAEDF0' }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1000
                      ? `${(v / 1000).toFixed(0)}k`
                      : String(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  width={96}
                  tick={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, fill: '#4B5563' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => DRAW_TYPE_LABELS[v] ?? v}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {invitationsByType.map((entry) => (
                    <Cell
                      key={entry.type}
                      fill={DRAW_TYPE_COLORS[entry.type] ?? '#9CA3AF'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right — Draws per year (area chart) */}
        <div
          className="pw-entry is-visible"
          style={{
            background: '#fff',
            border: '1px solid #EAEDF0',
            borderRadius: 12,
            padding: '24px 24px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            animationDelay: '320ms',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: 15,
              fontWeight: 700,
              color: '#0D0D0D',
              marginBottom: 4,
            }}
          >
            Draws per Year
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 12,
              color: '#9CA3AF',
              marginBottom: 20,
            }}
          >
            All draw types · full history
          </p>

          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
              data={drawsPerYear}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="drawsPerYearFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A56DB" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#1A56DB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#EAEDF0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={{ stroke: '#EAEDF0' }}
              />
              <YAxis
                tick={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 13,
                  background: '#fff',
                  border: '1px solid #EAEDF0',
                  borderRadius: 8,
                }}
                formatter={(v) => [v, 'draws']}
                labelFormatter={(y) => String(y)}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#1A56DB"
                strokeWidth={2}
                fill="url(#drawsPerYearFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#1A56DB', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Source footnote ───────────────────────────────────────────────── */}
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 11,
          color: '#9CA3AF',
          marginTop: 24,
          textAlign: 'right',
        }}
      >
        Data sourced from IRCC · updated automatically
      </p>
    </div>
  );
}
