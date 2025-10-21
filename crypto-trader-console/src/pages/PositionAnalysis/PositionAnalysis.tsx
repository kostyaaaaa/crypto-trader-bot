import {
  Badge,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { ApexOptions } from 'apexcharts';
import { useEffect, useMemo, useState, type FC } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useParams } from 'react-router-dom';
import {
  getAnalysisByDateRangeAndSymbol,
  getPositionById,
  type Position,
} from '../../api';
import type { IAnalysis } from '../../types';
import styles from './PositionAnalysis.module.scss';

const HALF_MINUTE = 30 * 1000;

type AxisSeries = Array<{ name: string; data: { x: number; y: number }[] }>;

type ModuleMeta = { LONG?: number; SHORT?: number };
type ModuleShape = { signal?: string; strength?: number; meta?: ModuleMeta };
type ModulesMap = Record<string, ModuleShape>;

type AnyMeta = Record<string, unknown>;
const fmtAny = (v: unknown, d = 3) => {
  if (v == null) return '-';
  if (typeof v === 'number')
    return Number.isFinite(v) ? Number(v).toFixed(d) : String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
};

const OVERALL_TAB = 'overall';

const fmt = (n: number, d = 2) =>
  Number.isFinite(n) ? Number(n).toFixed(d) : '-';

// Component for displaying LONG/SHORT values with colored bars and numbers
const LongShortBar: FC<{ long: number; short: number }> = ({ long, short }) => {
  const total = long + short;
  const longPercentage = total > 0 ? (long / total) * 100 : 0;
  const shortPercentage = total > 0 ? (short / total) * 100 : 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '24px' }}>
      {/* Progress bar */}
      <Progress.Root size="xl" style={{ height: '100%' }} radius="lg" bg="gray">
        <Progress.Section value={longPercentage} color="green" />
        <Progress.Section value={shortPercentage} color="red" />
      </Progress.Root>

      {/* Numbers overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#ffffff',
          pointerEvents: 'none',
        }}
      >
        <span>{fmt(long, 1)}</span>
        <span>{fmt(short, 1)}</span>
      </div>
    </div>
  );
};

const timeHHMM = (iso: string, timeZone?: string) => {
  const dt = new Date(iso);
  return dt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
};

const PositionAnalysis: FC = () => {
  // 1) Read position id from router
  const { posId } = useParams<{ posId: string }>();

  // 2) Load position by id
  const {
    data: posResp,
    isLoading: isPosLoading,
    isError: isPosError,
    error: posError,
  } = useQuery({
    queryKey: ['position', posId],
    queryFn: async () => {
      if (!posId) throw new Error('Missing position id');
      return getPositionById(posId);
    },
    enabled: !!posId,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const position: Position | undefined = useMemo(() => {
    const data = (posResp as unknown as { data?: Position })?.data;
    return data;
  }, [posResp]);

  // 3) Derive symbol and time range from the position
  const symbol = position?.symbol;
  const fromISO = position?.openedAt
    ? new Date(position.openedAt as unknown as string).toISOString()
    : undefined;
  const toISO = position?.closedAt
    ? new Date(position.closedAt as unknown as string).toISOString()
    : new Date().toISOString();

  // TZ toggle (Local / UTC)
  const [tzMode] = useState<'local' | 'utc'>('local');
  const localTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const activeTz: string | undefined = tzMode === 'utc' ? 'UTC' : undefined;
  const tzBadgeLabel = tzMode === 'utc' ? 'UTC' : localTz;

  // 4) Load analysis for that position window
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analysis-by-position', { symbol, fromISO, toISO }],
    queryFn: async () => {
      if (!symbol || !fromISO || !toISO) return { data: [] as IAnalysis[] };
      return getAnalysisByDateRangeAndSymbol(fromISO, toISO, symbol);
    },
    enabled: Boolean(symbol && fromISO && toISO),
    refetchOnWindowFocus: false,
    refetchInterval: HALF_MINUTE,
  });

  // take all rows (already sorted by controller when using date range)
  const rows = useMemo(() => (data?.data ?? []) as IAnalysis[], [data]);

  const [selectedIdx, setSelectedIdx] = useState<number>(
    Math.max(0, rows.length - 1),
  );
  useEffect(() => {
    setSelectedIdx(Math.max(0, (rows.length || 1) - 1));
  }, [rows.length]);

  // Keyboard navigation for time intervals
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedIdx((prev) => Math.max(0, prev - 1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedIdx((prev) => Math.min(rows.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rows.length]);

  const selected: IAnalysis | undefined = rows[selectedIdx];

  type HistoryItem = {
    ts: number;
    when: string;
    event: string;
    price?: number;
    qty?: number;
    size?: number;
    pnl?: number;
    note?: string;
  };

  const historyItems = useMemo<HistoryItem[]>(() => {
    if (!position) return [];
    const execs = Array.isArray((position as any).executions)
      ? ((position as any).executions as any[])
      : [];
    const adjs = Array.isArray((position as any).adjustments)
      ? ((position as any).adjustments as any[])
      : [];

    const eItems = execs.map((e) => ({
      ts: Number(e?.ts ?? 0),
      when: new Date(Number(e?.ts ?? 0)).toISOString(),
      event: e?.kind
        ? String(e.kind)
        : e?.side
          ? `TRADE ${String(e.side)}`
          : 'EXEC',
      price: typeof e?.price === 'number' ? e.price : Number(e?.price),
      qty: typeof e?.qty === 'number' ? e.qty : Number(e?.qty),
      pnl: typeof e?.pnl === 'number' ? e.pnl : Number(e?.pnl),
      note: e?.orderId ? `order ${e.orderId}` : undefined,
    }));

    const aItems = adjs.map((a) => ({
      ts: Number(a?.ts ?? 0),
      when: new Date(Number(a?.ts ?? 0)).toISOString(),
      event: a?.type ? String(a.type) : 'ADJUST',
      price: typeof a?.price === 'number' ? a.price : Number(a?.price),
      size: typeof a?.size === 'number' ? a.size : Number(a?.size),
      note: a?.reason ? String(a.reason) : undefined,
    }));

    return [...eItems, ...aItems]
      .filter((i) => Number.isFinite(i.ts) && i.ts > 0)
      .sort((a, b) => a.ts - b.ts);
  }, [position]);

  const moduleRows = useMemo(() => {
    if (!selected) return { validation: [], scoring: [] };
    const validation: Array<{ key: string; signal: string }> = [];
    const scoring: Array<{ key: string; long: number; short: number }> = [];

    Object.entries(selected.modules || {}).forEach(([key, mod]) => {
      const m =
        (mod as {
          type?: string;
          signal?: string;
          meta?: { LONG?: number; SHORT?: number };
        }) || {};
      const moduleType = m.type;

      if (moduleType === 'validation') {
        validation.push({
          key,
          signal: m.signal ?? 'NO DATA',
        });
      } else {
        // scoring or unknown (backward compatibility)
        scoring.push({
          key,
          long: Number(m.meta?.LONG ?? 0),
          short: Number(m.meta?.SHORT ?? 0),
        });
      }
    });

    return { validation, scoring };
  }, [selected]);

  const apexSeries = useMemo<AxisSeries>(
    () => [
      {
        name: 'LONG',
        data: rows.map((r) => ({
          x: new Date(r.time).getTime(),
          y: Number(r.scores.LONG || 0),
        })),
      },
      {
        name: 'SHORT',
        data: rows.map((r) => ({
          x: new Date(r.time).getTime(),
          y: Number(r.scores.SHORT || 0),
        })),
      },
    ],
    [rows],
  );

  const apexOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'analysis-scores',
        type: 'line',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 400 },
        events: {
          dataPointSelection: (_e, _ctx, cfg) => {
            if (typeof cfg?.dataPointIndex === 'number') {
              setSelectedIdx(cfg.dataPointIndex);
            }
          },
        },
      },
      stroke: { width: 2, curve: 'smooth' },
      colors: ['#22c55e', '#ef4444'], // green for LONG, red for SHORT
      xaxis: {
        type: 'datetime',
        labels: { datetimeUTC: tzMode === 'utc' },
      },
      yaxis: {
        min: 0,
        max: 100,
        tickAmount: 5,
        labels: { formatter: (v) => `${Math.round(v)}` },
      },
      grid: { strokeDashArray: 3 },
      markers: { size: 0, hover: { sizeOffset: 3 } },
      legend: { position: 'top', horizontalAlign: 'left' },
      tooltip: {
        shared: true,
        intersect: false,
        x: { format: 'dd MMM HH:mm' },
        y: {
          formatter: (val: number) =>
            Number.isFinite(val) ? val.toFixed(1) : '-',
        },
      },
    }),
    [tzMode],
  );

  // Collect all module keys across fetched rows
  const allModuleKeys = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const mods = (r.modules ?? {}) as unknown as ModulesMap;
      Object.keys(mods).forEach((k) => s.add(k));
    });
    return Array.from(s).sort();
  }, [rows]);

  // Active module tab
  const [activeModule, setActiveModule] = useState<string>(OVERALL_TAB);
  useEffect(() => {
    if (allModuleKeys.length) {
      setActiveModule((prev) =>
        prev && (prev === OVERALL_TAB || allModuleKeys.includes(prev))
          ? prev
          : OVERALL_TAB,
      );
    } else {
      setActiveModule(OVERALL_TAB);
    }
  }, [allModuleKeys.length]);

  const moduleOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        id: `module-${activeModule}`,
        type: 'line',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 400 },
        events: {
          dataPointSelection: (_e, _ctx, cfg) => {
            if (typeof cfg?.dataPointIndex === 'number') {
              setSelectedIdx(cfg.dataPointIndex);
            }
          },
        },
      },
      stroke: { width: 2, curve: 'smooth' },
      colors: ['#22c55e', '#ef4444'],
      xaxis: {
        type: 'datetime',
        labels: { datetimeUTC: tzMode === 'utc' },
      },
      yaxis: {
        min: 0,
        max: 100,
        tickAmount: 5,
        labels: { formatter: (v) => `${Math.round(v)}` },
      },
      grid: { strokeDashArray: 3 },
      markers: { size: 0, hover: { sizeOffset: 3 } },
      legend: { position: 'top', horizontalAlign: 'left' },
      tooltip: {
        shared: true,
        intersect: false,
        x: { format: 'dd MMM HH:mm' },
        y: {
          formatter: (val: number) =>
            Number.isFinite(val) ? val.toFixed(3) : '-',
        },
      },
    }),
    [activeModule, tzMode],
  );

  // Active module instance & its meta entries (for the floating panel)
  const selectedModule = useMemo(() => {
    if (!selected) return null;
    const mods = (selected.modules as unknown as ModulesMap) || {};
    return activeModule && activeModule !== OVERALL_TAB
      ? mods[activeModule] || null
      : null;
  }, [selected, activeModule]);

  const metaEntries = useMemo(() => {
    if (!selectedModule?.meta) return [] as Array<{ k: string; v: unknown }>;
    const meta = selectedModule.meta as unknown as AnyMeta;
    const entries = Object.entries(meta);
    // LONG/SHORT first, others alphabetical
    entries.sort((a, b) => {
      const order = (s: string) => (s === 'LONG' ? 0 : s === 'SHORT' ? 1 : 2);
      const oa = order(a[0]);
      const ob = order(b[0]);
      return oa !== ob ? oa - ob : a[0].localeCompare(b[0]);
    });
    return entries.map(([k, v]) => ({ k, v }));
  }, [selectedModule]);

  // -------- Render states --------
  if (isPosLoading || isLoading) {
    return (
      <div className={styles.loaderOverlay}>
        <Loader size="lg" />
      </div>
    );
  }

  if (isPosError) {
    return (
      <Center className={styles.wrapper}>
        <Text c="red">
          {(posError as { message: string })?.message ||
            'Failed to load position'}
        </Text>
      </Center>
    );
  }

  if (isError) {
    return (
      <Center className={styles.wrapper}>
        <Text c="red">
          {(error as { message: string })?.message || 'Failed to load analysis'}
        </Text>
      </Center>
    );
  }

  if (!position) {
    return (
      <Center className={styles.wrapper}>
        <Text>No position found.</Text>
      </Center>
    );
  }

  if (!selected) {
    return (
      <Center className={styles.wrapper}>
        <Text>No analysis found for this position time window.</Text>
      </Center>
    );
  }

  return (
    <Container size="lg" className={styles.wrapper}>
      {/* Header */}
      <Stack gap={6} mb="md">
        <Group justify="space-between" align="center">
          <Title order={3}>
            Analysis — {selected.symbol} [{selected.timeframe}] (
            {new Date(position.openedAt as unknown as string).toLocaleString()}{' '}
            →
            {position.closedAt
              ? ` ${new Date(position.closedAt as unknown as string).toLocaleString()}`
              : ' now'}
            )
          </Title>
          <Group gap="xs" key={`summary-${selectedIdx}`}>
            <Badge
              color={
                selected.bias === 'LONG'
                  ? 'green'
                  : selected.bias === 'SHORT'
                    ? 'red'
                    : 'gray'
              }
            >
              {selected.bias}
            </Badge>
            <Badge variant="light">{selected.decision}</Badge>
            <Badge variant="outline">coverage {selected.coverage}</Badge>
          </Group>
        </Group>

        {/* Position summary + history */}
        <Card withBorder padding="md" mb="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            {/* Left: position summary */}
            <Stack gap={6} style={{ minWidth: 260 }}>
              <Text fw={600}>Position</Text>
              <Text size="sm">
                <b>Symbol:</b> {position.symbol} &nbsp;|&nbsp; <b>Side:</b>{' '}
                {position.side} &nbsp;|&nbsp; <b>Status:</b> {position.status}
              </Text>
              <Text size="sm">
                <b>Entry:</b> {fmt(Number(position.entryPrice))} &nbsp;|&nbsp;{' '}
                <b>Size:</b> {Number(position.size).toFixed(4)}
              </Text>
              <Text size="sm">
                <b>Leverage:</b> {position.meta?.leverage ?? '—'}x &nbsp;|&nbsp;{' '}
                <b>Risk:</b> {position.meta?.riskPct ?? '—'}%
              </Text>
              <Text size="sm">
                <b>SL:</b> {fmt(position.stopPrice ?? NaN)} &nbsp;|&nbsp;{' '}
                <b>Init SL:</b> {fmt(position.initialStopPrice ?? NaN)}
              </Text>
              <Text size="sm">
                <b>TPs:</b>{' '}
                {Array.isArray(position.takeProfits) &&
                position.takeProfits.length
                  ? position.takeProfits
                      .map(
                        (tp, i) =>
                          `TP${i + 1}: ${fmt(Number(tp.price))} (${tp.sizePct}%)`,
                      )
                      .join(' · ')
                  : '—'}
              </Text>
              <Text size="sm">
                <b>Opened:</b>{' '}
                {new Date(
                  position.openedAt as unknown as string,
                ).toLocaleString()}
                {position.closedAt
                  ? `  |  Closed: ${new Date(position.closedAt as unknown as string).toLocaleString()}`
                  : ''}
              </Text>
              <Text size="sm">
                <b>PNL:</b>{' '}
                {position.finalPnl != null
                  ? `${Number(position.finalPnl).toFixed(4)}`
                  : position.realizedPnl != null
                    ? `${Number(position.realizedPnl).toFixed(4)}`
                    : '—'}{' '}
                &nbsp;|&nbsp; <b>Fees:</b>{' '}
                {Number(position.fees ?? 0).toFixed(4)}
              </Text>
            </Stack>

            {/* Right: history table */}
            <Stack gap={6} style={{ flex: 1, minWidth: 420 }}>
              <Text fw={600}>History</Text>
              <Table
                highlightOnHover
                withRowBorders={false}
                verticalSpacing="xs"
                style={{ width: '100%' }}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 180 }}>Time</Table.Th>
                    <Table.Th style={{ width: 160 }}>Event</Table.Th>
                    <Table.Th>Price</Table.Th>
                    <Table.Th>Qty/Size</Table.Th>
                    <Table.Th>PNL</Table.Th>
                    <Table.Th>Note</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {historyItems.length ? (
                    historyItems.map((h, idx) => (
                      <Table.Tr key={`${h.ts}-${idx}`}>
                        <Table.Td>
                          {new Date(h.ts).toLocaleString('en-GB', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                          })}
                        </Table.Td>
                        <Table.Td>{h.event}</Table.Td>
                        <Table.Td>
                          {h.price != null ? fmt(Number(h.price)) : '—'}
                        </Table.Td>
                        <Table.Td>
                          {h.qty != null
                            ? Number(h.qty).toFixed(4)
                            : h.size != null
                              ? Number(h.size).toFixed(4)
                              : '—'}
                        </Table.Td>
                        <Table.Td>
                          {h.pnl != null ? Number(h.pnl).toFixed(4) : '—'}
                        </Table.Td>
                        <Table.Td>{h.note ?? '—'}</Table.Td>
                      </Table.Tr>
                    ))
                  ) : (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text c="dimmed" size="sm">
                          No history yet.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          </Group>
        </Card>
      </Stack>

      {/* Charts and Table side by side */}
      <Group align="flex-start" gap="md" wrap="nowrap">
        {/* Per-module strength over time */}
        <Card withBorder padding="md" style={{ flex: 1 }}>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Scores &amp; Modules — LONG vs SHORT</Text>
            {activeModule === OVERALL_TAB ? (
              <Group gap={12} key={`overall-head-${selectedIdx}`}>
                <Text c="dimmed" size="sm">
                  Selected L: {fmt(selected.scores.LONG, 1)}
                </Text>
                <Text c="dimmed" size="sm">
                  Selected S: {fmt(selected.scores.SHORT, 1)}
                </Text>
              </Group>
            ) : (
              activeModule && (
                <Group gap={12} key={`mod-head-${selectedIdx}-${activeModule}`}>
                  <Badge variant="light">{activeModule}</Badge>
                  <Text c="dimmed" size="sm">
                    Selected L:{' '}
                    {fmt(
                      Number(
                        (selected.modules as unknown as ModulesMap)?.[
                          activeModule
                        ]?.meta?.LONG ?? 0,
                      ),
                      3,
                    )}
                  </Text>
                  <Text c="dimmed" size="sm">
                    Selected S:{' '}
                    {fmt(
                      Number(
                        (selected.modules as unknown as ModulesMap)?.[
                          activeModule
                        ]?.meta?.SHORT ?? 0,
                      ),
                      3,
                    )}
                  </Text>
                  <Text c="dimmed" size="sm">
                    Signal:{' '}
                    {String(
                      (selected.modules as unknown as ModulesMap)?.[
                        activeModule
                      ]?.signal ?? '-',
                    )}
                  </Text>
                </Group>
              )
            )}
          </Group>
          <Group align="flex-start" gap="md" wrap="nowrap">
            {/* Left: tabs + chart + time badges */}
            <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
              <Tabs
                value={activeModule}
                onChange={(v) => setActiveModule(v || '')}
              >
                <Tabs.List>
                  <Tabs.Tab key={OVERALL_TAB} value={OVERALL_TAB}>
                    overall
                  </Tabs.Tab>
                  {allModuleKeys.map((m) => (
                    <Tabs.Tab key={m} value={m}>
                      {m}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>

                <Tabs.Panel value={OVERALL_TAB} pt="sm">
                  <ReactApexChart
                    options={apexOptions}
                    series={apexSeries}
                    type="line"
                    height={200}
                  />
                </Tabs.Panel>

                {allModuleKeys.map((m) => (
                  <Tabs.Panel key={`panel-${m}`} value={m} pt="sm">
                    <ReactApexChart
                      options={moduleOptions}
                      series={[
                        {
                          name: 'LONG',
                          data: rows.map((r) => ({
                            x: new Date(r.time).getTime(),
                            y: Number(
                              ((r.modules as unknown as ModulesMap) ?? {})[m]
                                ?.meta?.LONG ?? 0,
                            ),
                          })),
                        },
                        {
                          name: 'SHORT',
                          data: rows.map((r) => ({
                            x: new Date(r.time).getTime(),
                            y: Number(
                              ((r.modules as unknown as ModulesMap) ?? {})[m]
                                ?.meta?.SHORT ?? 0,
                            ),
                          })),
                        },
                      ]}
                      type="line"
                      height={220}
                    />
                  </Tabs.Panel>
                ))}
              </Tabs>

              {/* time badges */}
              <Group gap={6} mt="xs" key={`times-${selectedIdx}`} wrap="wrap">
                {rows.map((r, i) => (
                  <Badge
                    key={r.time.toString()}
                    size="xs"
                    variant={i === selectedIdx ? 'filled' : 'outline'}
                    color={i === selectedIdx ? 'blue' : 'gray'}
                    onClick={() => setSelectedIdx(i)}
                    style={{ cursor: 'pointer' }}
                    title={
                      new Date(r.time).toLocaleString('en-GB', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                        timeZone: activeTz,
                      }) + ` ${tzBadgeLabel}`
                    }
                  >
                    {timeHHMM(r.time.toString(), activeTz)}
                  </Badge>
                ))}
              </Group>
            </Stack>

            {/* Right: meta key-value list for active module */}
            {selectedModule && metaEntries.length > 0 && (
              <Paper shadow="sm" withBorder p="xs" style={{ width: 320 }}>
                <Stack gap={6}>
                  <Group gap={6} justify="space-between" align="center">
                    <Badge variant="light">{activeModule}</Badge>
                    <Group gap={8}>
                      <Badge color="green" variant="outline">
                        L: {fmt(Number(selectedModule.meta?.LONG ?? 0), 3)}
                      </Badge>
                      <Badge color="red" variant="outline">
                        S: {fmt(Number(selectedModule.meta?.SHORT ?? 0), 3)}
                      </Badge>
                    </Group>
                  </Group>
                  <Table
                    withRowBorders={false}
                    verticalSpacing="xs"
                    highlightOnHover
                  >
                    <Table.Tbody>
                      {metaEntries.map((e) => (
                        <Table.Tr key={`meta-${String(e.k)}`}>
                          <Table.Td style={{ width: 140 }}>
                            <Text size="xs" c="dimmed">
                              {e.k}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{fmtAny(e.v)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Paper>
            )}
          </Group>
        </Card>

        {/* Module scoreboard */}
        <Paper
          withBorder
          p="md"
          key={`table-${selectedIdx}`}
          style={{ width: '35%', minWidth: '300px' }}
        >
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Latest module breakdown</Text>
            <Text c="dimmed" size="sm">
              {new Date(selected.time).toLocaleString('en-GB', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: activeTz,
              })}{' '}
              {tzBadgeLabel}
            </Text>
          </Group>

          {/* Validation Modules Section */}
          {moduleRows.validation.length > 0 && (
            <>
              <Text size="sm" fw={500} mb="xs" c="blue">
                Validation Modules
              </Text>
              <Table
                highlightOnHover
                withRowBorders={false}
                verticalSpacing="xs"
                style={{ width: '100%', tableLayout: 'fixed' }}
                mb="md"
              >
                <colgroup>
                  <col style={{ width: '150px' }} />
                  <col />
                </colgroup>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Module</Table.Th>
                    <Table.Th>Signal</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {moduleRows.validation.map((m) => (
                    <Table.Tr key={m.key}>
                      <Table.Td>{m.key}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            m.signal === 'ACTIVE'
                              ? 'green'
                              : m.signal === 'INACTIVE'
                                ? 'red'
                                : 'gray'
                          }
                        >
                          {m.signal}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}

          {/* Scoring Modules Section */}
          {moduleRows.scoring.length > 0 && (
            <>
              <Text size="sm" fw={500} mb="xs" c="grape">
                Scoring Modules
              </Text>
              <Table
                highlightOnHover
                withRowBorders={false}
                verticalSpacing="xs"
                style={{ width: '100%', tableLayout: 'fixed' }}
              >
                <colgroup>
                  <col style={{ width: '150px' }} />
                  <col />
                </colgroup>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Module</Table.Th>
                    <Table.Th>LONG / SHORT</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {moduleRows.scoring.map((m) => (
                    <Table.Tr key={m.key}>
                      <Table.Td>{m.key}</Table.Td>
                      <Table.Td>
                        <LongShortBar long={m.long} short={m.short} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </Paper>
      </Group>
    </Container>
  );
};

export default PositionAnalysis;
