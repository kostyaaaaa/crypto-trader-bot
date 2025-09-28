import { Group, Select, Table, Text, UnstyledButton } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { type FC } from 'react';
import styles from './PositionsPage.module.scss';
import usePositionsPage from './usePositionsPage';

const formatDateWithTime = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}:${h}-${min}`;
};

const PositionsPage: FC = () => {
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
    <Table.Tr
      key={pos._id}
      className={styles[pos.finalPnl < 0 ? 'wrapper__red' : 'wrapper__green']}
    >
      <Table.Td>{pos.symbol}</Table.Td>
      <Table.Td
        className={
          styles[pos.side === 'LONG' ? 'wrapper__long' : 'wrapper__short']
        }
      >
        {pos.side}
      </Table.Td>
      <Table.Td>{pos.closedBy}</Table.Td>
      <Table.Td>${pos.finalPnl.toFixed(3)}</Table.Td>
      <Table.Td>{pos.size}</Table.Td>
      <Table.Td>
        <p>Long: {pos.analysisRef.scores.LONG}</p>
        <p>
          Short:
          {pos.analysisRef.scores.SHORT}
        </p>
      </Table.Td>
      <Table.Td>x{pos.meta.leverage}</Table.Td>
      <Table.Td>{formatDateWithTime(new Date(pos.openedAt))}</Table.Td>
      <Table.Td>{formatDateWithTime(new Date(pos.closedAt))}</Table.Td>
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
          Total PnL: $
          {positions.reduce((sum, item) => sum + item.finalPnl, 0).toFixed(3)}
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
        <>
          <Table className={styles.wrapper__table}>
            <Table.Thead>
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
                <Table.Th>Anal scores</Table.Th>
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
        </>
      )}
    </div>
  );
};

export default PositionsPage;
