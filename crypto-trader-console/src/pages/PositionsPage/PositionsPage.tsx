import {
  Badge,
  Divider,
  Group,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import clsx from 'clsx';
import type {
  IAnalysis,
  ICorrelationMeta,
  IFundingMeta,
  IHigherMAMeta,
  ILiquidityMeta,
  ILongShortMeta,
  IModuleBase,
  IOpenInterestMeta,
  IRsiVolTrendMeta,
  ITrendMeta,
  ITrendRegimeMeta,
  IVolatilityMeta,
} from 'crypto-trader-db';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState, type FC } from 'react';
import type {
  Adjustment,
  Position,
  SLUpdateAdjustment,
  TakeProfit,
  TakeProfitFill,
  TPUpdateAdjustment,
} from '../../api/positions/getPositionsByTimeAndSymbol';
import CoinIcon from '../../components/SymbolIcon';
import styles from './PositionsPage.module.scss';
import usePositionsPage from './usePositionsPage';

// Union type for all meta interfaces that have LONG/SHORT properties
type ModuleMetaWithScores =
  | ITrendMeta
  | IVolatilityMeta
  | ITrendRegimeMeta
  | ILiquidityMeta
  | IFundingMeta
  | IOpenInterestMeta
  | ICorrelationMeta
  | ILongShortMeta
  | IHigherMAMeta
  | IRsiVolTrendMeta;

// Type for modules with scores
type ModuleWithScores = IModuleBase & { meta: ModuleMetaWithScores };

// Helper function for formatting numbers
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
          color: '#ffffff', // White color
          pointerEvents: 'none', // Allow clicks to pass through
        }}
      >
        <span>{fmt(long, 1)}</span>
        <span>{fmt(short, 1)}</span>
      </div>
    </div>
  );
};

const PositionsPage: FC = () => {
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [analysisExpanded, setAnalysisExpanded] = useState<
    Record<string, boolean>
  >({});
  const {
    period,
    setPeriod,
    setSelectedCoin,
    selectedCoin,
    symbols,
    positions,
    handleSort,
    sortField,
    sortDirection,
  } = usePositionsPage();

  // --- URL <-> expanded row sync ---
  const setUrlParam = useCallback((key: string, value: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (!value) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
      window.history.replaceState({}, '', url.toString());
    } catch {
      console.log('error');
    }
  }, []);

  const getUrlParam = useCallback((key: string): string | null => {
    try {
      return new URL(window.location.href).searchParams.get(key);
    } catch {
      return null;
    }
  }, []);

  const toggleExpand = useCallback(
    (rowId: string) => {
      setExpanded((prev) => {
        const willOpen = !prev[rowId];
        const next = willOpen ? { [rowId]: true } : {};
        setUrlParam('pos', willOpen ? rowId : null);
        if (willOpen) {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-pos-id="${rowId}"]`);
            if (el instanceof HTMLElement) {
              el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
          });
        }
        return next;
      });
    },
    [setUrlParam],
  );

  const toggleAnalysisExpand = useCallback((rowId: string) => {
    setAnalysisExpanded((prev) => {
      const willOpen = !prev[rowId];
      const next = willOpen ? { [rowId]: true } : {};
      if (willOpen) {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-analysis-id="${rowId}"]`);
          if (el instanceof HTMLElement) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        });
      }
      return next;
    });
  }, []);

  // Open row from URL on first load / when positions fetched
  useEffect(() => {
    const qsId = getUrlParam('pos');
    if (!qsId || !positions?.length) return;
    const has = positions.some((p) => String(p._id) === qsId);
    if (has) {
      setExpanded({ [qsId]: true });
      // Scroll to the row once it is rendered
      setTimeout(() => {
        const el = document.querySelector(
          `[data-pos-id="${qsId}"]`,
        ) as HTMLElement | null;
        if (el) el.scrollIntoView({ block: 'center' });
      }, 0);
    }
  }, [positions, getUrlParam]);

  // Helper: choose badge color by event semantics
  const eventBadgeColor = useCallback((label: string, desc?: string) => {
    const L = (label || '').toUpperCase();
    const D = (desc || '').toUpperCase();
    const T = `${L} ${D}`;

    // Any take-profit related
    if (T.includes('TP') || T.includes('TAKE_PROFIT')) return 'green';

    // SL updates: trail/move/breakeven should look neutral (blue)
    if (L.includes('SL_UPDATE')) {
      if (D.includes('FILLED')) return 'red'; // actual stop execution
      // trail/move/open/breakeven → blue
      if (D.includes('TRAIL') || D.includes('OPEN') || D.includes('BREAKEVEN'))
        return 'blue';
      return 'blue';
    }

    // Closed by SL (or any explicit stop close)
    if (L.includes('CLOSED') && (T.includes(' SL') || T.includes('STOP')))
      return 'red';

    // Fallback: any generic stop keyword → red
    if (T.includes(' SL') || T.includes('STOP')) return 'red';

    return 'blue';
  }, []);

  const rows = positions?.flatMap((pos: Position) => {
    const id = String(pos._id);
    const isOpen = !!expanded[id];

    // build a simple timeline from position data
    type Ev = { t: number; label: string; desc: string };
    const events: Ev[] = [];
    const toTs = (v: unknown): number => {
      if (!v) return 0;
      try {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return new Date(v).getTime();
        if (typeof v === 'object' && v !== null && '$date' in v) {
          return new Date((v as { $date: string }).$date).getTime();
        }
        return 0;
      } catch {
        return 0;
      }
    };

    // OPEN
    events.push({
      t: toTs(pos.openedAt),
      label: 'OPEN',
      desc: `${pos.side} ${Number(pos.size).toFixed(4)} @ ${Number(pos.entryPrice).toFixed(6)} x${pos?.meta?.leverage ?? 1}`,
    });

    // TP fills
    if (Array.isArray(pos.takeProfits)) {
      pos.takeProfits.forEach((tp, i) => {
        if (Array.isArray(tp.fills)) {
          tp.fills.forEach((f: TakeProfitFill) => {
            events.push({
              t: toTs(f.time),
              label: `TP${i + 1} FILL`,
              desc: `qty ${Number(f.qty).toFixed(4)} @ ${Number(f.price).toFixed(6)}${f.fee ? ` (fee ${Number(f.fee)} ${f.feeAsset || ''})` : ''}`,
            });
          });
        }
      });
    }

    // Adjustments
    if (Array.isArray(pos.adjustments)) {
      const isSL = (x: Adjustment): x is SLUpdateAdjustment =>
        x?.type === 'SL_UPDATE';
      const isTPU = (x: Adjustment): x is TPUpdateAdjustment =>
        x?.type === 'TP_UPDATE';

      pos.adjustments.forEach((a: Adjustment) => {
        if (isSL(a)) {
          const desc =
            `${String(a.reason ?? '')}${a.price != null ? ` → ${Number(a.price).toFixed(6)}` : ''}`.trim();
          events.push({
            t: toTs(a.ts),
            label: 'SL_UPDATE',
            desc,
          });
        } else if (isTPU(a)) {
          events.push({
            t: toTs(a.ts),
            label: String(a.reason ?? 'TP_UPDATE'),
            desc: 'TPs updated',
          });
        } else {
          const label = a.type || 'ADJ';
          const reason = (a as { reason?: unknown }).reason;
          events.push({ t: toTs(a.ts), label, desc: String(reason ?? '') });
        }
      });
    }

    // CLOSED
    if (pos.status === 'CLOSED') {
      events.push({
        t: toTs(pos.closedAt),
        label: `CLOSED → ${pos.closedBy || ''}`.trim(),
        desc: `finalPnL ${Number(pos.finalPnl ?? 0).toFixed(4)}`,
      });
    }

    events.sort((a, b) => a.t - b.t);

    // main row
    const main = (
      <Table.Tr key={id} data-pos-id={id}>
        <Table.Td className={styles.wrapper__symbol_icon}>
          <CoinIcon symbol={pos.symbol} size={16} />
          {pos.symbol}
        </Table.Td>
        <Table.Td>
          {(() => {
            const pnl = Number(pos.finalPnl ?? 0);
            const lev = Number(pos.meta?.leverage ?? 1);
            const notionalUSD = Number(pos.size ?? 0);
            const margin = lev ? notionalUSD / lev : 0;
            const pct = margin > 0 ? (pnl / margin) * 100 : null;
            const pctStr =
              pct === null ? '' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
            return (
              <span
                className={
                  styles[
                    pnl >= 0 ? 'wrapper__pnlPositive' : 'wrapper__pnlNegative'
                  ]
                }
              >
                ${pnl.toFixed(3)}
                {pctStr}
              </span>
            );
          })()}
        </Table.Td>
        <Table.Td>{pos.side}</Table.Td>
        <Table.Td>{pos.closedBy || 'Manually'}</Table.Td>
        <Table.Td>{pos.size.toFixed(3)}</Table.Td>
        <Table.Td>
          <div className={styles.wrapper__scores}>
            <span>L: {pos.analysis?.scores?.LONG || 0}</span>
            <span>S: {pos.analysis?.scores?.SHORT || 0}</span>
          </div>
        </Table.Td>
        <Table.Td>x{pos.meta.leverage}</Table.Td>
        <Table.Td>
          {dayjs(new Date(pos.openedAt)).format('DD,MMM HH:mm')}
        </Table.Td>
        <Table.Td>
          {dayjs(new Date(pos.closedAt)).format('DD,MMM HH:mm')}
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <UnstyledButton
              onClick={() => toggleExpand(id)}
              className={styles.wrapper__actionButton}
            >
              {isOpen ? 'Hide' : 'History'}
            </UnstyledButton>
            <UnstyledButton
              onClick={() => toggleAnalysisExpand(id)}
              className={styles.wrapper__actionButton}
            >
              {analysisExpanded[id] ? 'Hide' : 'Analysis'}
            </UnstyledButton>
          </Group>
        </Table.Td>
      </Table.Tr>
    );

    // details row
    const details = !isOpen ? null : (
      <Table.Tr key={`${id}-details`}>
        <Table.Td colSpan={10}>
          <Paper withBorder p="sm">
            <Stack gap={8}>
              {/* TP summary */}
              <Group gap={8} wrap="wrap">
                {Array.isArray(pos.takeProfits) &&
                  pos.takeProfits.map((tp: TakeProfit, i: number) => (
                    <Badge key={`tp-badge-${id}-${i}`} color="green">
                      TP{i + 1}: {tp.sizePct}% @{' '}
                      {Number(tp.price ?? 0).toFixed(6)}{' '}
                      {tp.cum != null ? `(cum ${Number(tp.cum)})` : ''}
                    </Badge>
                  ))}
              </Group>

              <Divider my={4} />

              {/* Timeline */}
              <Text fw={600}>Events timeline</Text>
              <Table withRowBorders={false} verticalSpacing="xs" miw={600}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 180 }}>Time</Table.Th>
                    <Table.Th style={{ width: 160 }}>Event</Table.Th>
                    <Table.Th>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {events.map((e, idx) => (
                    <Table.Tr key={`ev-${id}-${idx}`}>
                      <Table.Td>
                        {e.t ? dayjs(e.t).format('DD,MMM HH:mm:ss') : '-'}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={eventBadgeColor(e.label, e.desc)}
                        >
                          {e.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{e.desc}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Paper>
        </Table.Td>
      </Table.Tr>
    );

    // Analysis details row
    const analysisDetails = !analysisExpanded[id] ? null : (
      <Table.Tr key={`${id}-analysis`} data-analysis-id={id}>
        <Table.Td colSpan={10}>
          <Paper withBorder p="sm">
            <Stack gap={8}>
              <Text fw={600}>Analysis Breakdown</Text>
              {pos.analysis &&
              typeof pos.analysis === 'object' &&
              'modules' in pos.analysis ? (
                <Table withRowBorders={false} verticalSpacing="xs" miw={600}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Module</Table.Th>
                      <Table.Th>Signal</Table.Th>
                      <Table.Th style={{ width: 200 }}>LONG / SHORT</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {Object.entries(
                      (pos.analysis as IAnalysis).modules || {},
                    ).map(([key, mod]) => {
                      // All modules extend IModuleBase with signal and meta containing LONG/SHORT
                      const module = mod as ModuleWithScores;
                      const signal = module?.signal || 'NO DATA';
                      const meta = module?.meta || { LONG: 0, SHORT: 0 };
                      const long = Number(meta.LONG ?? 0);
                      const short = Number(meta.SHORT ?? 0);

                      return (
                        <Table.Tr key={key}>
                          <Table.Td>{key}</Table.Td>
                          <Table.Td>
                            <Badge
                              color={
                                signal === 'LONG'
                                  ? 'green'
                                  : signal === 'SHORT'
                                    ? 'red'
                                    : 'gray'
                              }
                            >
                              {signal}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <LongShortBar long={long} short={short} />
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text c="dimmed">No analysis data available</Text>
              )}
            </Stack>
          </Paper>
        </Table.Td>
      </Table.Tr>
    );

    return [main, details, analysisDetails].filter(Boolean);
  });

  return (
    <div className={styles.wrapper}>
      <Group>
        <Select
          label="Pick coin"
          placeholder="Pick value"
          data={symbols ?? []}
          value={selectedCoin}
          onChange={(value) => setSelectedCoin(value)}
        />

        <DatePickerInput
          type="range"
          value={period}
          onChange={setPeriod}
          label="Pick date"
          placeholder="Pick date"
        />
      </Group>

      <div className={styles.wrapper__general}>
        <h4>General info</h4>
        <Text inline>
          Win positions counter:{' '}
          {positions.filter((item) => item.finalPnl > 0).length}
        </Text>

        <Text inline>
          Lose positions counter:{' '}
          {positions.filter((item) => item.finalPnl < 0).length}
        </Text>

        <Text inline>
          Total PnL:
          <span
            className={
              styles[
                positions.reduce((sum, item) => sum + item.finalPnl, 0) >= 0
                  ? 'wrapper__pnlPositive'
                  : 'wrapper__pnlNegative'
              ]
            }
          >
            {` $${positions.reduce((sum, item) => sum + item.finalPnl, 0).toFixed(3)}`}
          </span>
        </Text>

        <Text inline>
          Closed by SL:{' '}
          {positions.filter((item) => item.closedBy === 'SL').length}
        </Text>

        <Text inline>
          Closed by TP:{' '}
          {positions.filter((item) => item.closedBy === 'TP').length}
        </Text>
      </div>

      {!!positions?.length && (
        <div className={styles.wrapper__tableContainer}>
          <ScrollArea onScrollPositionChange={({ y }) => setScrolled(y !== 0)}>
            <Table miw={1200} className={styles.wrapper__table}>
              <Table.Thead
                className={clsx(styles.wrapper__header, {
                  [styles.wrapper__scrolled]: scrolled,
                })}
              >
                <Table.Tr>
                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('symbol')}>
                      <Text inline>
                        Symbol{' '}
                        {sortField === 'symbol'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('finalPnl')}>
                      <Text inline>
                        Final Pnl{' '}
                        {sortField === 'finalPnl'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('side')}>
                      <Text inline>
                        Side{' '}
                        {sortField === 'side'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('closedBy')}>
                      <Text inline>
                        Closed By{' '}
                        {sortField === 'closedBy'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>

                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('size')}>
                      <Text inline>
                        Size{' '}
                        {sortField === 'size'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>
                  <Table.Th>Scores</Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('leverage')}>
                      <Text inline>
                        Leverage{' '}
                        {sortField === 'leverage'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>

                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('openedAt')}>
                      <Text inline>
                        Opened At{' '}
                        {sortField === 'openedAt'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>

                  <Table.Th>
                    <UnstyledButton onClick={() => handleSort('closedAt')}>
                      <Text inline>
                        Closed At{' '}
                        {sortField === 'closedAt'
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </Text>
                    </UnstyledButton>
                  </Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default PositionsPage;
