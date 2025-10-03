import type { DatesRangeValue } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  QueryKeys,
  getAllCoinConfigs,
  getPositionsByTimeAndSymbol,
} from '../../api';
import {
  dateStringToTimezoneISO,
  formatDateForPicker,
} from '../../utils/date-time';

const today = new Date();
const yesterday = new Date();
today.setDate(today.getDate() + 1);
yesterday.setDate(today.getDate() - 1);

const defaultPeriod: DatesRangeValue<string> = [
  formatDateForPicker(yesterday),
  formatDateForPicker(today),
];

type SortField =
  | 'side'
  | 'closedBy'
  | 'finalPnl'
  | 'size'
  | 'leverage'
  | 'openedAt'
  | 'closedAt'
  | 'symbol';
type SortDirection = 'asc' | 'desc';

const usePositionsPage = () => {
  const [period, setPeriod] = useState<DatesRangeValue<string>>(defaultPeriod);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('closedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data: positionsData } = useQuery({
    queryKey: [QueryKeys.GetPositions, period, selectedCoin],
    queryFn: async () => {
      if (period[0] && period[1]) {
        const data = await getPositionsByTimeAndSymbol(
          dateStringToTimezoneISO(period[0]),
          dateStringToTimezoneISO(period[1]),
          selectedCoin,
        );

        return data;
      }
    },
    enabled: !!period.every((item) => !!item),
    refetchOnWindowFocus: false,
  });

  const { data } = useQuery({
    queryKey: [QueryKeys.AllCoinConfigs],
    queryFn: getAllCoinConfigs,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const positions = useMemo(() => {
    if (!positionsData?.data) return [];
    return [...positionsData.data].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'openedAt':
          aValue = new Date(a.openedAt).getTime();
          bValue = new Date(b.openedAt).getTime();
          break;
        case 'closedAt':
          aValue = new Date(a.closedAt).getTime();
          bValue = new Date(b.closedAt).getTime();
          break;
        case 'leverage':
          aValue = a.meta.leverage;
          bValue = b.meta.leverage;
          break;
        case 'finalPnl':
        case 'size':
          aValue = a[sortField];
          bValue = b[sortField];
          break;
        case 'side':
        case 'closedBy':
        case 'symbol':
          aValue = a[sortField];
          bValue = b[sortField];
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [positionsData, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return {
    period,
    setPeriod,
    setSelectedCoin,
    selectedCoin,
    symbols: data?.data.map((item) => item.symbol),
    positions,
    handleSort,
    sortField,
    sortDirection,
  };
};

export default usePositionsPage;
