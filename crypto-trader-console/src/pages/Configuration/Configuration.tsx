import { Button, ScrollArea, Table } from '@mantine/core';
import { Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useState, type FC } from 'react';
import { ROUTERS_PATH } from '../../router/constants';
import styles from './Configuration.module.scss';
import useConfiguration from './useConfiguration';

const Configuration: FC = () => {
  const { configs, deleteCoinConfigMutate, updateCoinConfigMutate } =
    useConfiguration();

  const [scrolled, setScrolled] = useState<boolean>(false);

  const rows = configs?.map((row) => (
    <Table.Tr key={row._id}>
      <Table.Td>
        <Button
          variant="outline"
          component="a"
          href={ROUTERS_PATH.coinConfigId(row.symbol)}
        >
          {row.symbol}
        </Button>
      </Table.Td>
      <Table.Td>{row.analysisConfig.candleTimeframe}</Table.Td>
      <Table.Td>x{row.strategy.capital.leverage}</Table.Td>
      <Table.Td>
        L:{row.strategy.entry.minScore.LONG} - S:
        {row.strategy.entry.minScore.SHORT}
      </Table.Td>
      <Table.Td>{dayjs(row.updatedAt || '').format('DD,MMM hh:mm')}</Table.Td>
      <Table.Td style={row.isActive ? { color: '#228be6' } : { color: 'red' }}>
        {row.isActive ? 'Active' : 'Disabled'}
      </Table.Td>
      <Table.Td>
        <Button
          variant="light"
          onClick={() =>
            updateCoinConfigMutate({ ...row, isActive: !row.isActive })
          }
        >
          {row.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </Table.Td>
      <Table.Td>
        <Button
          variant="light"
          color="red"
          onClick={() => deleteCoinConfigMutate(row.symbol)}
        >
          <Trash size={28} />
        </Button>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <div className={styles.configuration}>
      <Button
        variant="filled"
        m={12}
        component="a"
        href={ROUTERS_PATH.createConfig}
      >
        + Add new config
      </Button>

      <div className={styles.tableContainer}>
        <ScrollArea onScrollPositionChange={({ y }) => setScrolled(y !== 0)}>
          <Table miw={700}>
            <Table.Thead
              className={clsx(styles.header, {
                [styles.scrolled]: scrolled,
              })}
            >
              <Table.Tr>
                <Table.Th>Symbol</Table.Th>
                <Table.Th>Candle TF</Table.Th>
                <Table.Th>Leverage</Table.Th>
                <Table.Th>Min entry</Table.Th>
                <Table.Th>Last updated</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
};

export default Configuration;
