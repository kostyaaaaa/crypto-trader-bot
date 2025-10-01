import { Button, ScrollArea, Table } from '@mantine/core';
import { Star, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useState, type FC } from 'react';
import CoinIcon from '../../components/SymbolIcon';
import { ROUTERS_PATH } from '../../router/constants';
import styles from './Configuration.module.scss';
import useConfiguration from './useConfiguration';

// --- helpers to store favorites in cookies ---
const COOKIE_KEY = 'favSymbols';

function readFavsFromCookie(): string[] {
  if (typeof document === 'undefined') return [];
  const raw = document.cookie
    .split('; ')
    .find((r) => r.startsWith(`${COOKIE_KEY}=`));
  if (!raw) return [];
  try {
    const value = decodeURIComponent(raw.split('=')[1]);
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

function writeFavsToCookie(list: string[]) {
  if (typeof document === 'undefined') return;
  const expires = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000,
  ).toUTCString();
  const value = encodeURIComponent(JSON.stringify(Array.from(new Set(list))));
  document.cookie = `${COOKIE_KEY}=${value}; expires=${expires}; path=/`;
}

const Configuration: FC = () => {
  const { configs, deleteCoinConfigMutate, updateCoinConfigMutate } =
    useConfiguration();

  const [favs, setFavs] = useState<string[]>(() => readFavsFromCookie());

  const toggleFav = (symbol: string) => {
    setFavs((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      writeFavsToCookie(next);
      return next;
    });
  };

  const [scrolled, setScrolled] = useState<boolean>(false);

  const favSet = new Set(favs);
  const sorted = (configs ?? []).slice().sort((a, b) => {
    const diff = Number(favSet.has(b.symbol)) - Number(favSet.has(a.symbol));
    if (diff !== 0) return diff;
    return a.symbol.localeCompare(b.symbol);
  });

  const rows = sorted.map((row) => (
    <Table.Tr key={row._id}>
      <Table.Td width={42}>
        <Button
          variant="subtle"
          onClick={() => toggleFav(row.symbol)}
          title={
            favSet.has(row.symbol)
              ? 'Remove from favorites'
              : 'Add to favorites'
          }
          style={{ padding: 4, minWidth: 28, height: 28 }}
        >
          <Star
            size={18}
            weight={favSet.has(row.symbol) ? 'fill' : 'regular'}
            color={
              favSet.has(row.symbol) ? '#f5c518' : 'var(--mantine-color-dimmed)'
            }
          />
        </Button>
      </Table.Td>
      <Table.Td>
        <Button
          variant="outline"
          component="a"
          href={ROUTERS_PATH.coinConfigId(row.symbol)}
        >
          <div className={styles.symbolIcon}>
            {' '}
            <CoinIcon symbol={row.symbol} size={16} /> <div>{row.symbol}</div>
          </div>
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
                <Table.Th>★</Table.Th>
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
