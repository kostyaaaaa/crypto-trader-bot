import { Button, ScrollArea, Table } from '@mantine/core';
import clsx from 'clsx';
import { useState, type FC } from 'react';
import { CardWrapper } from '../../components';
import styles from './Dashboard.module.scss';
import useDashboard from './useDashboard';

function calcCommission(notional: number): number {
  const feeRate = 0.0004;
  let commission = Math.abs(notional) * feeRate;
  commission *= 2; // вход + выход
  return commission;
}

const Dashboard: FC = () => {
  const {
    spotUSDBalance,
    futuresUSDBalance,
    accountPnlData,
    futuresPositions,
    refetchFuturesPositions,
    isLoadingFuturesPositions,
  } = useDashboard();
  const currentPnl = accountPnlData?.realizedPnL ?? 0;
  const isPlusPnl = currentPnl >= 0;

  const [scrolled, setScrolled] = useState<boolean>(false);

  const rows = futuresPositions?.map((row) => {
    const isLong = parseFloat(row.positionAmt) > 0;
    return (
      <Table.Tr
        key={row.symbol}
        className={styles[+row.unrealizedProfit > 0 ? 'long' : 'short']}
      >
        <Table.Td>{row.symbol}</Table.Td>
        <Table.Td className={styles[isLong ? 'green' : 'red']}>
          {isLong ? 'LONG' : 'SHORT'}
        </Table.Td>
        <Table.Td>{parseFloat(row.entryPrice)}</Table.Td>
        <Table.Td>${parseFloat(row.positionInitialMargin).toFixed(2)}</Table.Td>
        <Table.Td>
          x{row.leverage}, total = ($
          {(+row.positionInitialMargin * +row.leverage).toFixed(2)})
        </Table.Td>
        <Table.Td>${(+row.unrealizedProfit).toFixed(2)}</Table.Td>
        <Table.Td>
          ${calcCommission(Math.abs(+row.notional)).toFixed(2)}
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <div className={styles.dashboard}>
      <div className={styles['dashboard-info']}>
        <CardWrapper>
          <p>
            Орієнтовний баланс спота: $
            {parseFloat((spotUSDBalance ?? 0).toFixed(6))}
          </p>
        </CardWrapper>
        <CardWrapper>
          <p>Орієнтовний баланс futures: ${futuresUSDBalance}</p>
        </CardWrapper>

        <CardWrapper>
          PNL за сьогодні{' '}
          <span className={styles[isPlusPnl ? 'green' : 'red']}>
            {currentPnl}$
          </span>
        </CardWrapper>
      </div>

      <div>
        <h5 className={styles.openFutures}>
          Відкриті фьючерс угоди:
          <Button
            disabled={isLoadingFuturesPositions}
            variant="light"
            onClick={() => refetchFuturesPositions()}
          >
            Refresh
          </Button>
        </h5>

        {!!futuresPositions?.length && (
          <div className={styles.tableContainer}>
            <ScrollArea
              onScrollPositionChange={({ y }) => setScrolled(y !== 0)}
            >
              <Table miw={700}>
                <Table.Thead
                  className={clsx(styles.header, {
                    [styles.scrolled]: scrolled,
                  })}
                >
                  <Table.Tr>
                    <Table.Th>Symbol</Table.Th>
                    <Table.Th>Position</Table.Th>
                    <Table.Th>Entry Coin Price</Table.Th>
                    <Table.Th>Initial Margin</Table.Th>
                    <Table.Th>Leverage</Table.Th>
                    <Table.Th>Unrealized Profit</Table.Th>
                    <Table.Th>Tax fee</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* <CustomChart />

      <div className="dashboard-list">
        {coinList.map((coin) => (
          <Checkbox
            key={coin.id}
            label={coin.label}
            checked={coin.isAvailable}
            handleChange={handleChangeCoinList(coin.id)}
          />
        ))}
      </div> */}
    </div>
  );
};

export default Dashboard;
