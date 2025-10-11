import React from 'react';

// ================= Helpers & Types =================

// type EventType = 'earnings' | 'dividends' | 'splits' | 'ipo' | 'econ' | 'news';

// type CalendarEvent = {
//   id: string;
//   type: EventType;
//   date: string; // YYYY-MM-DD
//   symbol?: string;
//   title: string;
//   subtitle?: string;
//   url?: string;
//   meta?: Record<string, unknown>;
// };

// const API_BASE = 'https://financialmodelingprep.com/stable';
// const API_KEY = (import.meta as any).env?.VITE_FMP_API_KEY as
//   | string
//   | undefined; // <-- додай у .env: VITE_FMP_API_KEY=...

// const ymd = (d: Date) => d.toISOString().slice(0, 10);
// const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
// const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
// const addDays = (d: Date, n: number) => {
//   const x = new Date(d);
//   x.setDate(x.getDate() + n);
//   return x;
// };
// const startOfWeekMon = (d: Date) => {
//   const x = new Date(d);
//   const wd = x.getDay(); // 0..6 (Sun..Sat)
//   const shift = wd === 0 ? -6 : 1 - wd; // make Monday first
//   return addDays(x, shift);
// };

// const TYPE_LABEL: Record<EventType, string> = {
//   earnings: 'Earnings',
//   dividends: 'Dividends',
//   splits: 'Splits',
//   ipo: 'IPOs',
//   econ: 'Economics',
//   news: 'News',
// };

// const TYPE_COLOR: Record<EventType, string> = {
//   earnings: '#2563eb', // blue-600
//   dividends: '#059669', // emerald-600
//   splits: '#7c3aed', // violet-600
//   ipo: '#b45309', // amber-700
//   econ: '#334155', // slate-700
//   news: '#be123c', // rose-700
// };

// // ================= FMP client (client-side) =================

// async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
//   const res = await fetch(url, {
//     headers: { accept: 'application/json' },
//     signal,
//   });
//   if (!res.ok) throw new Error(`${url} -> ${res.status}`);
//   return res.json();
// }

// function q(params: Record<string, string | number | undefined>) {
//   const u = new URLSearchParams();
//   for (const [k, v] of Object.entries(params))
//     if (v != null && v !== '') u.set(k, String(v));
//   return u.toString();
// }

// // Try multiple endpoint variants (stable / v3). If none work, return [] so that
// // the whole calendar still renders with partial data.
// async function getCalendarAny(
//   paths: string[],
//   mk: (
//     p: string,
//     extra?: Record<string, string | number | undefined>,
//   ) => string,
//   extra: Record<string, string | number | undefined> = {},
//   signal?: AbortSignal,
// ): Promise<any[]> {
//   for (const p of paths) {
//     try {
//       return await getJSON<any[]>(mk(p, extra), signal);
//     } catch (_) {
//       // try next variant (some endpoints are Premium in /stable but free in /v3, or vice versa)
//     }
//   }
//   return [];
// }

// async function fetchEvents(
//   from: string,
//   to: string,
//   types: EventType[],
//   tickersCSV: string,
//   signal?: AbortSignal,
// ): Promise<CalendarEvent[]> {
//   if (!API_KEY) throw new Error('VITE_FMP_API_KEY is not set');

//   const urls: Promise<CalendarEvent[]>[] = [];

//   const mk = (
//     path: string,
//     extra: Record<string, string | number | undefined> = {},
//   ) => `${API_BASE}${path}?${q({ from, to, apikey: API_KEY, ...extra })}`;

//   if (types.includes('earnings')) {
//     urls.push(
//       getCalendarAny(
//         ['/earnings-calendar', '/v3/earning_calendar'],
//         mk,
//         {},
//         signal,
//       )
//         .then((a) =>
//           a.map((x) => ({
//             id: `earn-${x.symbol}-${x.date}`,
//             type: 'earnings' as const,
//             date: x.date,
//             symbol: x.symbol,
//             title: `${x.symbol} Earnings`,
//             subtitle:
//               x.epsEstimated || x.epsActual
//                 ? `EPS est ${x.epsEstimated ?? '-'} / act ${x.epsActual ?? '-'}`
//                 : undefined,
//             meta: x,
//           })),
//         )
//         .catch(() => []),
//     );
//   }
//   if (types.includes('dividends')) {
//     urls.push(
//       getCalendarAny(
//         ['/dividends-calendar', '/v3/stock_dividend_calendar'],
//         mk,
//         {},
//         signal,
//       )
//         .then((a) =>
//           a.map((x) => ({
//             id: `div-${x.symbol}-${x.date}`,
//             type: 'dividends' as const,
//             date: x.date,
//             symbol: x.symbol,
//             title: `${x.symbol} Dividend`,
//             subtitle: x.dividend ? `Dividend: ${x.dividend}` : undefined,
//             meta: x,
//           })),
//         )
//         .catch(() => []),
//     );
//   }
//   if (types.includes('splits')) {
//     urls.push(
//       getCalendarAny(
//         ['/splits-calendar', '/v3/stock_split_calendar'],
//         mk,
//         {},
//         signal,
//       )
//         .then((a) =>
//           a.map((x) => ({
//             id: `split-${x.symbol}-${x.date}`,
//             type: 'splits' as const,
//             date: x.date,
//             symbol: x.symbol,
//             title: `${x.symbol} Split`,
//             subtitle:
//               x.numerator && x.denominator
//                 ? `${x.numerator}:${x.denominator}`
//                 : undefined,
//             meta: x,
//           })),
//         )
//         .catch(() => []),
//     );
//   }
//   if (types.includes('ipo')) {
//     urls.push(
//       getCalendarAny(['/ipos-calendar', '/v3/ipo_calendar'], mk, {}, signal)
//         .then((a) =>
//           a.map((x) => ({
//             id: `ipo-${x.symbol || x.company || x.date}`,
//             type: 'ipo' as const,
//             date: x.date,
//             symbol: x.symbol,
//             title: `${x.company || x.symbol || 'IPO'}`,
//             subtitle:
//               [x.exchange, x.priceRange].filter(Boolean).join(' • ') ||
//               undefined,
//             meta: x,
//           })),
//         )
//         .catch(() => []),
//     );
//   }
//   if (types.includes('econ')) {
//     urls.push(
//       getCalendarAny(
//         ['/economics-calendar', '/v3/economic_calendar'],
//         mk,
//         {},
//         signal,
//       )
//         .then((a) =>
//           a.map((x) => ({
//             id: `eco-${x.event || x.country}-${x.date}`,
//             type: 'econ' as const,
//             date: x.date,
//             title: `${x.event} (${x.country})`,
//             subtitle:
//               [x.actual, x.previous, x.consensus]
//                 .map((v, i) =>
//                   v != null && v !== ''
//                     ? ['act', 'prev', 'cons'][i] + ': ' + v
//                     : '',
//                 )
//                 .filter(Boolean)
//                 .join(' • ') || undefined,
//             meta: x,
//           })),
//         )
//         .catch(() => []),
//     );
//   }
//   if (types.includes('news') && tickersCSV.trim()) {
//     const urlStable = `${API_BASE}/stock-news?${q({ tickers: tickersCSV.replace(/\s+/g, ''), limit: 100, apikey: API_KEY })}`;
//     const urlV3 = `${API_BASE}/v3/stock_news?${q({ tickers: tickersCSV.replace(/\s+/g, ''), limit: 100, apikey: API_KEY })}`;
//     urls.push(
//       (async () => {
//         let a: any[] = [];
//         try {
//           a = await getJSON<any[]>(urlStable, signal);
//         } catch {
//           try {
//             a = await getJSON<any[]>(urlV3, signal);
//           } catch {
//             a = [];
//           }
//         }
//         return a
//           .map((x) => ({
//             id: `news-${x.symbol}-${x.publishedDate}-${x.title}`,
//             type: 'news' as const,
//             date: String(x.publishedDate || '').slice(0, 10),
//             symbol: x.symbol,
//             title: x.title,
//             subtitle: x.site,
//             url: x.url,
//             meta: x,
//           }))
//           .filter((e) => e.date >= from && e.date <= to);
//       })().catch(() => []),
//     );
//   }

//   const chunks = await Promise.all(urls);
//   return chunks.flat().sort((a, b) => a.date.localeCompare(b.date));
// }

// // ================= UI =================

// const cellStyle: React.CSSProperties = {
//   border: '1px solid #e5e7eb',
//   minHeight: 120,
//   padding: 8,
// };

// const badgeStyle = (t: EventType): React.CSSProperties => ({
//   display: 'inline-block',
//   padding: '2px 6px',
//   margin: '2px 0',
//   borderRadius: 8,
//   fontSize: 11,
//   color: 'white',
//   backgroundColor: TYPE_COLOR[t],
//   textDecoration: 'none',
// });

const FMPevents: React.FC = () => {
  //   const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  //   const [types, setTypes] = useState<Set<EventType>>(
  //     new Set(['earnings', 'dividends', 'splits', 'ipo', 'econ']),
  //   );
  //   const [tickers, setTickers] = useState<string>(''); // для новин
  //   const [events, setEvents] = useState<CalendarEvent[]>([]);
  //   const [selectedDate, setSelectedDate] = useState<string | null>(null);
  //   const [loading, setLoading] = useState(false);
  //   const [error, setError] = useState<string | null>(null);

  //   const from = ymd(startOfMonth(month));
  //   const to = ymd(endOfMonth(month));

  //   const days = useMemo(() => {
  //     const start = startOfWeekMon(startOfMonth(month));
  //     const end = addDays(startOfWeekMon(addDays(endOfMonth(month), 7)), -1);
  //     const arr: Date[] = [];
  //     for (let d = new Date(start); d <= end; d = addDays(d, 1))
  //       arr.push(new Date(d));
  //     return arr;
  //   }, [month]);

  //   useEffect(() => {
  //     const controller = new AbortController();
  //     setLoading(true);
  //     setError(null);
  //     fetchEvents(from, to, Array.from(types), tickers, controller.signal)
  //       .then(setEvents)
  //       .catch((e) => setError(String(e?.message || e)))
  //       .finally(() => setLoading(false));
  //     return () => controller.abort();
  //   }, [from, to, types, tickers]);

  //   const byDay = useMemo(() => {
  //     const m = new Map<string, CalendarEvent[]>();
  //     for (const e of events) {
  //       const list = m.get(e.date) || [];
  //       list.push(e);
  //       m.set(e.date, list);
  //     }
  //     for (const v of m.values()) v.sort((a, b) => a.type.localeCompare(b.type));
  //     return m;
  //   }, [events]);

  //   const dayList = selectedDate ? byDay.get(selectedDate) || [] : [];
  //   const monthLabel = month.toLocaleString(undefined, {
  //     month: 'long',
  //     year: 'numeric',
  //   });

  return <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}></div>;
};

export default FMPevents;
