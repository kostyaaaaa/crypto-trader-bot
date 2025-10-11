import React, { useEffect, useMemo, useState } from 'react';

// ================= Helpers & Types =================

type EventType = 'earnings' | 'dividends' | 'splits' | 'econ' | 'news';

type CalendarEvent = {
  id: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  symbol?: string;
  title: string;
  subtitle?: string;
  url?: string;
  meta?: Record<string, unknown>;
};

const API_BASE = 'https://financialmodelingprep.com/stable';
const API_KEY = (import.meta as any).env?.VITE_FMP_API_KEY as
  | string
  | undefined; // опційно: VITE_FMP_API_KEY=...

// Free US macro (FRED) fallback
const FRED_BASE = 'https://api.stlouisfed.org/fred';
const FRED_KEY = (import.meta as any).env?.VITE_FRED_KEY as string | undefined; // опційно: VITE_FRED_KEY=...

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeekMon = (d: Date) => {
  const x = new Date(d);
  const wd = x.getDay(); // 0..6 (Sun..Sat)
  const shift = wd === 0 ? -6 : 1 - wd; // make Monday first
  return addDays(x, shift);
};

const TYPE_LABEL: Record<EventType, string> = {
  earnings: 'Earnings',
  dividends: 'Dividends',
  splits: 'Splits',
  econ: 'Economics',
  news: 'News',
};

const TYPE_COLOR: Record<EventType, string> = {
  earnings: '#2563eb', // blue-600
  dividends: '#059669', // emerald-600
  splits: '#7c3aed', // violet-600
  econ: '#334155', // slate-700
  news: '#be123c', // rose-700
};

// ================= HTTP helpers =================

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal,
    });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
  } catch {
    // free mode: приглушуємо 402/404/CORS — повертаємо порожній результат
    return [] as unknown as T;
  }
}

function q(params: Record<string, string | number | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v != null && v !== '') u.set(k, String(v));
  return u.toString();
}

// --- FRED helpers: ключові US macro релізи (future+past дати, без forecast/actual)
const FRED_TARGETS = [
  'Consumer Price Index',
  'Employment Situation',
  'Gross Domestic Product',
  'Personal Income and Outlays',
  'Federal Open Market Committee',
  'FOMC',
];

async function fredGetJSON<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  if (!FRED_KEY) return [] as unknown as T;
  const baseUrl = `${FRED_BASE}${path}?${q({ api_key: FRED_KEY, file_type: 'json', ...params })}`;
  try {
    // Preferred: direct call
    const res = await fetch(baseUrl, {
      headers: { accept: 'application/json' },
    });
    if (res.ok) return (await res.json()) as T;
  } catch {}
  // Fallback: public CORS proxy (read-only). For production, use a small serverless proxy.
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(baseUrl)}`;
  try {
    const res2 = await fetch(proxied, {
      headers: { accept: 'application/json' },
    });
    if (res2.ok) return (await res2.json()) as T;
  } catch {}
  return [] as unknown as T;
}

async function fetchFredEcon(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  if (!FRED_KEY) return [];
  try {
    // 1) Повний список релізів → фільтруємо по назвах
    const all = await fredGetJSON<{
      releases: Array<{ id: number; name: string }>;
    }>('/releases', {});
    const wanted = (all?.releases || []).filter((r) =>
      FRED_TARGETS.some((t) => r.name.toLowerCase().includes(t.toLowerCase())),
    );

    // 2) Для кожного релізу — дати в діапазоні
    const items: CalendarEvent[] = [];
    for (const r of wanted) {
      try {
        const dates = await fredGetJSON<{
          release_dates: Array<{ date: string }>;
        }>('/release/dates', { release_id: r.id });
        for (const d of dates?.release_dates || []) {
          const day = String(d.date).slice(0, 10);
          if (day >= from && day <= to) {
            items.push({
              id: `fred-${r.id}-${day}`,
              type: 'econ',
              date: day,
              title: `${r.name} (US)`,
              subtitle: 'FRED release date',
              meta: { releaseId: r.id, provider: 'FRED' },
            });
          }
        }
      } catch {
        // ігноруємо помилку одного релізу
      }
    }
    return items.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// ================= Data fetch =================

async function fetchEvents(
  from: string,
  to: string,
  types: EventType[],
  tickersCSV: string,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const urls: Promise<CalendarEvent[]>[] = [];
  const mk = (
    path: string,
    extra: Record<string, string | number | undefined> = {},
  ) => `${API_BASE}${path}?${q({ from, to, apikey: API_KEY, ...extra })}`;

  // FMP: earnings / тільки якщо є ключ
  if (types.includes('earnings') && API_KEY) {
    urls.push(
      getJSON<any[]>(mk('/earnings-calendar'), signal).then((a) =>
        (a || []).map((x) => ({
          id: `earn-${x.symbol}-${x.date}`,
          type: 'earnings' as const,
          date: x.date,
          symbol: x.symbol,
          title: `${x.symbol} Earnings`,
          subtitle:
            x.epsEstimated || x.epsActual
              ? `EPS est ${x.epsEstimated ?? '-'} / act ${x.epsActual ?? '-'}`
              : undefined,
          meta: x,
        })),
      ),
    );
  }

  // FMP: dividends / тільки якщо є ключ
  if (types.includes('dividends') && API_KEY) {
    urls.push(
      getJSON<any[]>(mk('/dividends-calendar'), signal).then((a) =>
        (a || []).map((x) => ({
          id: `div-${x.symbol}-${x.date}`,
          type: 'dividends' as const,
          date: x.date,
          symbol: x.symbol,
          title: `${x.symbol} Dividend`,
          subtitle: x.dividend ? `Dividend: ${x.dividend}` : undefined,
          meta: x,
        })),
      ),
    );
  }

  // FMP: splits / тільки якщо є ключ
  if (types.includes('splits') && API_KEY) {
    urls.push(
      getJSON<any[]>(mk('/splits-calendar'), signal).then((a) =>
        (a || []).map((x) => ({
          id: `split-${x.symbol}-${x.date}`,
          type: 'splits' as const,
          date: x.date,
          symbol: x.symbol,
          title: `${x.symbol} Split`,
          subtitle:
            x.numerator && x.denominator
              ? `${x.numerator}:${x.denominator}`
              : undefined,
          meta: x,
        })),
      ),
    );
  }

  // ECON: тільки FRED (free)
  if (types.includes('econ')) {
    const econPromise = (async (): Promise<CalendarEvent[]> => {
      if (!FRED_KEY) return [];
      return await fetchFredEcon(from, to, signal);
    })();
    urls.push(econPromise);
  }

  // FMP: news / тільки якщо є ключ і задані тікери
  if (types.includes('news') && API_KEY && tickersCSV.trim()) {
    const url = `${API_BASE}/stock-news?${q({
      tickers: tickersCSV.replace(/\s+/g, ''),
      limit: 100,
      apikey: API_KEY,
    })}`;
    urls.push(
      getJSON<any[]>(url, signal).then((a) =>
        (a || [])
          .map((x) => ({
            id: `news-${x.symbol}-${x.publishedDate}-${x.title}`,
            type: 'news' as const,
            date: String(x.publishedDate || '').slice(0, 10),
            symbol: x.symbol,
            title: x.title,
            subtitle: x.site,
            url: x.url,
            meta: x,
          }))
          .filter((e) => e.date >= from && e.date <= to),
      ),
    );
  }

  const chunks = await Promise.all(urls);
  return chunks.flat().sort((a, b) => a.date.localeCompare(b.date));
}

// ================= UI =================

const cellStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  minHeight: 120,
  padding: 8,
};

const badgeStyle = (t: EventType): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 6px',
  margin: '2px 0',
  borderRadius: 8,
  fontSize: 11,
  color: 'white',
  backgroundColor: TYPE_COLOR[t],
  textDecoration: 'none',
});

const FMPevents: React.FC = () => {
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [types, setTypes] = useState<Set<EventType>>(
    new Set(['earnings', 'dividends', 'splits', 'econ', 'news']),
  );
  const [tickers, setTickers] = useState<string>(''); // для новин
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = ymd(startOfMonth(month));
  const to = ymd(endOfMonth(month));

  const days = useMemo(() => {
    const start = startOfWeekMon(startOfMonth(month));
    const end = addDays(startOfWeekMon(addDays(endOfMonth(month), 7)), -1);
    const arr: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1))
      arr.push(new Date(d));
    return arr;
  }, [month]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchEvents(from, to, Array.from(types), tickers, controller.signal)
      .then(setEvents)
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [from, to, types, tickers]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.date) || [];
      list.push(e);
      m.set(e.date, list);
    }
    for (const v of m.values()) v.sort((a, b) => a.type.localeCompare(b.type));
    return m;
  }, [events]);

  const dayList = selectedDate ? byDay.get(selectedDate) || [] : [];
  const monthLabel = month.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Market Events (Free: FMP + FRED)
      </h1>

      {!API_KEY && (
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <strong>Безкоштовний режим:</strong> можна додати ключі у{' '}
          <code>.env</code> — <code>VITE_FMP_API_KEY</code>{' '}
          (earnings/dividends/splits) та <code>VITE_FRED_KEY</code> (економічні
          дати США). Якщо ключів немає, відповідні події будуть пропущені без
          помилок.
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <button
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ◀ Prev
        </button>
        <div style={{ fontWeight: 600 }}>{monthLabel}</div>
        <button
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          Next ▶
        </button>
        <button
          onClick={() => setMonth(startOfMonth(new Date()))}
          style={{ marginLeft: 8 }}
        >
          Today
        </button>
        <div
          style={{
            marginLeft: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {(
            ['earnings', 'dividends', 'splits', 'econ', 'news'] as EventType[]
          ).map((t) => (
            <label
              key={t}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <input
                type="checkbox"
                checked={types.has(t)}
                onChange={() =>
                  setTypes((s) => {
                    const n = new Set(s);
                    n.has(t) ? n.delete(t) : n.add(t);
                    return n;
                  })
                }
              />
              <span>{TYPE_LABEL[t]}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            placeholder="Tickers for news: AAPL,MSFT"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            style={{ padding: 6, border: '1px solid #cbd5e1', borderRadius: 6 }}
          />
        </div>
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
          <div
            key={w}
            style={{
              ...cellStyle,
              background: '#f8fafc',
              minHeight: 40,
              fontWeight: 600,
            }}
          >
            {w}
          </div>
        ))}
        {days.map((d) => {
          const k = ymd(d);
          const evs = byDay.get(k) || [];
          const isOther = d.getMonth() !== month.getMonth();
          return (
            <div
              key={k}
              style={{
                ...cellStyle,
                opacity: isOther ? 0.4 : 1,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedDate(k)}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                {d.getDate()}
              </div>
              <div style={{ marginTop: 4 }}>
                {evs.slice(0, 3).map((e) => (
                  <a
                    key={e.id}
                    href={e.url || '#'}
                    target={e.url ? '_blank' : undefined}
                    rel="noreferrer"
                    style={badgeStyle(e.type)}
                    title={
                      (e.symbol ? e.symbol + ' • ' : '') + (e.subtitle || '')
                    }
                  >
                    {e.symbol ? `${e.symbol} • ${e.title}` : e.title}
                  </a>
                ))}
                {evs.length > 3 && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    +{evs.length - 3} more…
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div style={{ marginTop: 8, color: '#64748b' }}>Loading events…</div>
      )}
      {error && (
        <div style={{ marginTop: 8, color: '#b91c1c' }}>Error: {error}</div>
      )}

      {/* Drawer for selected day */}
      {selectedDate && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              Events on {selectedDate}
            </h2>
            <button
              onClick={() => setSelectedDate(null)}
              style={{ padding: '4px 8px' }}
            >
              Close
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            {dayList.map((e) => (
              <div
                key={e.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ ...badgeStyle(e.type) }}>
                      {TYPE_LABEL[e.type]}
                    </span>
                    <strong>
                      {e.symbol ? `${e.symbol} • ${e.title}` : e.title}
                    </strong>
                  </div>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13 }}
                    >
                      Open
                    </a>
                  )}
                </div>
                {e.subtitle && (
                  <div style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>
                    {e.subtitle}
                  </div>
                )}
              </div>
            ))}
            {dayList.length === 0 && (
              <div style={{ color: '#64748b' }}>No events for this day.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FMPevents;
