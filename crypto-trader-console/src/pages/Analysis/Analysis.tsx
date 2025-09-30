import {
  Badge,
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
import { type FC, useEffect, useMemo, useState } from 'react';
import { getAllCoinConfigs, getAnalysisByDateRangeAndSymbol } from '../../api';
import type { IAnalysis, TCoinConfigResponse } from '../../types';
import styles from './Analysis.module.scss';

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

function ScoreSparkline({
  series,
  color = 'var(--mantine-color-blue-6)',
}: {
  series: number[];
  color?: string;
}) {
  const w = 240;
  const h = 56;
  const max = 100;
  const min = 0;
  const n = Math.max(series.length, 2);
  const step = w / (n - 1);
  const pts = series.map((v, i) => {
    const x = i * step;
    const y = h - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const Analysis: FC = () => {
  // how many last points to show
  const [historyN, setHistoryN] = useState<number>(10);

  // Effective fetch window derived from desired historyN
  // Heuristic: ~5 minutes per point (keeps payload small even for 1m data)
  const rangeDates = useMemo(() => {
    const to = new Date();
    const minutesPerPoint = 5; // hardcoded "smaller timeframe" window
    const minutes = Math.max(historyN * minutesPerPoint, 60); // at least 60m
    const from = new Date(to.getTime() - minutes * 60 * 1000);
    return { from, to };
  }, [historyN]);

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

  // Selected symbol (fallback to SOLUSDT until configs arrive)
  const [selectedCoin, setSelectedCoin] = useState<string>('SOLUSDT');
  useEffect(() => {
    if (symbols.length && !symbols.includes(selectedCoin)) {
      setSelectedCoin(symbols[0]);
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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analysis', { ...rangeDates, symbol, historyN }],
    queryFn: async () =>
      getAnalysisByDateRangeAndSymbol(
        rangeDates.from.toISOString(),
        rangeDates.to.toISOString(),
        symbol,
      ),
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

  const longSeries = rows.map((r) => r.scores.LONG);
  const shortSeries = rows.map((r) => r.scores.SHORT);

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
            onChange={(v) => setSelectedCoin(v || (symbols[0] ?? 'SOLUSDT'))}
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
        </Group>
      </Stack>

      {/* Scores over time */}
      <Group align="stretch" wrap="wrap" gap="md" mb="md">
        <Card withBorder padding="md" style={{ flex: 1 }}>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Scores — LONG</Text>
            <Text c="dimmed" size="sm">
              Selected: {fmt(selected.scores.LONG, 1)}
            </Text>
          </Group>
          <ScoreSparkline
            series={longSeries}
            color="var(--mantine-color-green-6)"
          />
          <Group gap={6} mt="xs" key={`long-times-${selectedIdx}`}>
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

        <Card withBorder padding="md" style={{ flex: 1 }}>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Scores — SHORT</Text>
            <Text c="dimmed" size="sm">
              selected: {fmt(selected.scores.SHORT, 1)}
            </Text>
          </Group>
          <ScoreSparkline
            series={shortSeries}
            color="var(--mantine-color-red-6)"
          />
          <Group gap={6} mt="xs" key={`short-times-${selectedIdx}`}>
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
      </Group>

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
