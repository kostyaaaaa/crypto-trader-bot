import {
  Badge,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  Select,
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
import { getAllCoinConfigs, getAnalysisByDateRangeAndSymbol } from '../../api';
import type { IAnalysis, TCoinConfigResponse } from '../../types';
import styles from './Analysis.module.scss';

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

const timeHHMM = (iso: string, timeZone?: string) => {
  const dt = new Date(iso);
  return dt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
};

const Analysis: FC = () => {
  const [historyN, setHistoryN] = useState<number>(10);

  const { data: coinConfigs } = useQuery({
    queryKey: ['all-coin-configs'],
    queryFn: getAllCoinConfigs,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const symbols = useMemo(
    () =>
      (coinConfigs?.data ?? []).map((item: TCoinConfigResponse) => item.symbol),
    [coinConfigs],
  );

  const coinLocalStorageKey = 'anal_coin';

  const [selectedCoin, setSelectedCoin] = useState<string>('SOLUSDT');
  useEffect(() => {
    if (symbols.length) {
      const localStorageItem = localStorage.getItem(coinLocalStorageKey);
      if (localStorageItem && symbols.includes(localStorageItem)) {
        setSelectedCoin(localStorageItem);
      } else if (!symbols.includes(selectedCoin)) {
        setSelectedCoin(symbols[0]);
      }
    }
  }, [symbols.length]); // eslint-disable-line

  const symbol = selectedCoin;

  // TZ toggle (Local / UTC)
  const [tzMode] = useState<'local' | 'utc'>('local');
  const localTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const activeTz: string | undefined = tzMode === 'utc' ? 'UTC' : undefined;
  const tzBadgeLabel = tzMode === 'utc' ? 'UTC' : localTz;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch: getAnalysisRefetch,
  } = useQuery({
    queryKey: ['analysis', { symbol, historyN }],

    queryFn: async () => {
      const to = new Date();
      const minutesPerPoint = 2;
      const minutes = Math.max(historyN * minutesPerPoint, 60);
      const from = new Date(to.getTime() - minutes * 60 * 1000);
      // need here for correct refetch work
      return getAnalysisByDateRangeAndSymbol(
        from.toISOString(),
        to.toISOString(),
        symbol,
      );
    },

    refetchOnWindowFocus: false,
    refetchInterval: HALF_MINUTE,
  });

  // take the last N items (most recent)
  const rows = useMemo(
    () => (data?.data ?? []).slice(-historyN),
    [data, historyN],
  );

  const [selectedIdx, setSelectedIdx] = useState<number>(
    Math.max(0, rows.length - 1),
  );
  useEffect(() => {
    setSelectedIdx(Math.max(0, (rows.length || 1) - 1));
  }, [rows.length]);

  const selected: IAnalysis | undefined = rows[selectedIdx];

  const moduleRows = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.modules || {}).map(([key, mod]) => {
      const m = mod || {};
      return {
        key,
        signal: m.signal ?? 'NO DATA',
        strength: Number(m.strength ?? 0),
        long: Number(m.meta?.LONG ?? 0),
        short: Number(m.meta?.SHORT ?? 0),
      };
    });
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

  if (isLoading) {
    return (
      <div className={styles.loaderOverlay}>
        <Loader size="lg" />
      </div>
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

  if (!selected) {
    return (
      <Center className={styles.wrapper}>
        <Text>No analysis found for selected period.</Text>
      </Center>
    );
  }

  return (
    <Container size="lg" className={styles.wrapper}>
      {/* Header */}
      <Stack gap={6} mb="md">
        <Group justify="space-between" align="center">
          <Title order={3}>
            Analysis — {selected.symbol} [{selected.timeframe}] (last{' '}
            {rows.length})
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

        <Group justify="center" align="end" wrap="wrap" gap="xs">
          <Select
            size="xs"
            label="Pick coin"
            placeholder="Select"
            data={symbols}
            value={selectedCoin}
            onChange={(v) => {
              const newCoin = v || (symbols[0] ?? 'SOLUSDT');
              localStorage.setItem(coinLocalStorageKey, newCoin);
              setSelectedCoin(newCoin);
            }}
            searchable
            nothingFoundMessage="No coins"
            maw={200}
          />

          <Select
            size="xs"
            label="Last"
            data={[
              { value: '10', label: 'Last 10' },
              { value: '15', label: '15m' },
              { value: '30', label: '30m' },
              { value: '60', label: '1h' },
            ]}
            value={String(historyN)}
            onChange={(v) => setHistoryN(Number(v || 10))}
            maw={100}
          />

          <Button onClick={() => getAnalysisRefetch()} disabled={isLoading}>
            Refetch
          </Button>
        </Group>
      </Stack>

      {/* Scores over time (combined) */}

      {/* Per-module strength over time */}
      <Card withBorder padding="md" mb="md" w={'100%'}>
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
                    (selected.modules as unknown as ModulesMap)?.[activeModule]
                      ?.signal ?? '-',
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
      <Paper withBorder p="md" key={`table-${selectedIdx}`} w={'100%'}>
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
        <Table
          highlightOnHover
          withRowBorders={false}
          verticalSpacing="xs"
          style={{ width: '100%' }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Module</Table.Th>
              <Table.Th>Signal</Table.Th>
              <Table.Th style={{ width: 120 }}>Strength</Table.Th>
              <Table.Th style={{ width: 260 }}>LONG / SHORT</Table.Th>
              <Table.Th style={{ width: 80 }} ta="right">
                L
              </Table.Th>
              <Table.Th style={{ width: 80 }} ta="right">
                S
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {moduleRows.map((r) => (
              <Table.Tr key={r.key}>
                <Table.Td>{r.key}</Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      r.signal === 'LONG'
                        ? 'green'
                        : r.signal === 'SHORT'
                          ? 'red'
                          : 'gray'
                    }
                  >
                    {r.signal}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ta="right">
                    {fmt(r.strength, 3)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Progress
                      value={Math.max(0, Math.min(100, r.long))}
                      color="green"
                      style={{ flex: 1 }}
                    />
                    <Progress
                      value={Math.max(0, Math.min(100, r.short))}
                      color="red"
                      style={{ flex: 1 }}
                    />
                  </Group>
                </Table.Td>
                <Table.Td ta="right">{fmt(r.long, 3)}</Table.Td>
                <Table.Td ta="right">{fmt(r.short, 3)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
};

export default Analysis;
