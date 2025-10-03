import {
  Group,
  ScrollArea,
  Select,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useState, type FC } from 'react';
import CoinIcon from '../../components/SymbolIcon';
import styles from './PositionsPage.module.scss';
import usePositionsPage from './usePositionsPage';

const PositionsPage: FC = () => {
  const [scrolled, setScrolled] = useState<boolean>(false);
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

  const rows = positions?.map((pos) => (
    <Table.Tr key={pos._id}>
      <Table.Td className={styles.wrapper__symbol_icon}>
        {' '}
        <CoinIcon symbol={pos.symbol} size={16} />
        {pos.symbol}
      </Table.Td>
      <Table.Td>
        {(() => {
          const pnl = Number(pos.finalPnl ?? 0);
          const lev = Number(pos.meta?.leverage ?? 1);

          // інтерпретуємо size як USD-ноціонал
          const notionalUSD = Number(pos.size ?? 0);

          // маржа = ноціонал / плече
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
          <span>L: {pos.analysisRef.scores.LONG}</span>
          <span>S: {pos.analysisRef.scores.SHORT}</span>
        </div>
      </Table.Td>
      <Table.Td>x{pos.meta.leverage}</Table.Td>
      <Table.Td>
        {dayjs(new Date(pos.openedAt)).format('DD,MMM HH:mm')}
      </Table.Td>
      <Table.Td>
        {dayjs(new Date(pos.closedAt)).format('DD,MMM HH:mm')}
      </Table.Td>
    </Table.Tr>
  ));

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
            $
            {positions.reduce((sum, item) => sum + item.finalPnl, 0).toFixed(3)}
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
