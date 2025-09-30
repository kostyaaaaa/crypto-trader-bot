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
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
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

type AxisSeries = Array<{ name: string; data: { x: number; y: number }[] }>;

// ---- Light typings to keep TS happy ----

const fmt = (n: number, d = 2) =>
  Number.isFinite(n) ? Number(n).toFixed(d) : '-';

// формат часу з урахуванням обраної TZ (undefined => Local)
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

  // Active coins from backend configs
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
  // Selected symbol (fallback to SOLUSDT until configs arrive)
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
  }, [symbols.length]);

  const symbol = selectedCoin;

  // TZ toggle (Local / UTC)
  const [tzMode, setTzMode] = useState<'local' | 'utc'>('local');
  const localTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const activeTz: string | undefined = tzMode === 'utc' ? 'UTC' : undefined; // undefined => Local
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
      const minutesPerPoint = 5;
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
    // whenever rows length changes, snap selection to the latest item
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

        <Group justify="center" align="center" wrap="wrap" gap="xs">
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
              { value: '10', label: '10' },
              { value: '20', label: '20' },
              { value: '30', label: '30' },
              { value: '50', label: '50' },
            ]}
            value={String(historyN)}
            onChange={(v) => setHistoryN(Number(v || 10))}
            maw={100}
          />

          <SegmentedControl
            size="xs"
            value={tzMode}
            onChange={(v) => setTzMode(v as 'local' | 'utc')}
            data={[
              { label: 'Local', value: 'local' },
              { label: 'UTC', value: 'utc' },
            ]}
          />

          <Button onClick={() => getAnalysisRefetch()} disabled={isLoading}>
            Refetch
          </Button>
        </Group>
      </Stack>

      {/* Scores over time (combined) */}
      <Card withBorder padding="md" mb="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Scores — LONG vs SHORT</Text>
          <Group gap={12}>
            <Text c="dimmed" size="sm">
              Selected L: {fmt(selected.scores.LONG, 1)}
            </Text>
            <Text c="dimmed" size="sm">
              Selected S: {fmt(selected.scores.SHORT, 1)}
            </Text>
          </Group>
        </Group>
        <ReactApexChart
          options={apexOptions}
          series={apexSeries}
          type="line"
          height={260}
        />
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
      </Card>

      {/* Module scoreboard */}
      <Paper withBorder p="md" key={`table-${selectedIdx}`}>
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
        <ScrollArea h={420} offsetScrollbars>
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
        </ScrollArea>
      </Paper>
    </Container>
  );
};

export default Analysis;
