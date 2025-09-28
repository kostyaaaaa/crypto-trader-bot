import { Button, ScrollArea, Table } from '@mantine/core';
import clsx from 'clsx';
import { useState, type FC } from 'react';
import { ROUTERS_PATH } from '../../router/constants';
import { formatDate } from '../../utils/formatDate';
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
          m={12}
          component="a"
          href={ROUTERS_PATH.coinConfigId(row.symbol)}
        >
          {row.symbol}
        </Button>
      </Table.Td>
      <Table.Td>{row.strategy.capital.account}</Table.Td>
      <Table.Td>{formatDate(row.updatedAt)}</Table.Td>
      <Table.Td>{row.isActive ? 'Active' : 'Disable'}</Table.Td>
      <Table.Td className={styles.actions}>
        <Button
          variant="light"
          onClick={() => deleteCoinConfigMutate(row.symbol)}
        >
          Delete
        </Button>
        <Button
          variant="light"
          onClick={() =>
            updateCoinConfigMutate({ ...row, isActive: !row.isActive })
          }
        >
          {row.isActive ? 'Deactivate' : 'Activate'}
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
                <Table.Th>strategy capital account</Table.Th>
                <Table.Th>Last updated</Table.Th>
                <Table.Th>Status</Table.Th>
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
