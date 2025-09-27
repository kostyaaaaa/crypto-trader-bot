import { useQuery } from '@tanstack/react-query';
import {
  QueryKeys,
  binanceCoinsConfig,
  type IBinanceCoinsConfigResponse,
} from '../../api';
import { useState } from 'react';

const useCoinConfigTemplate = () => {
  const [symbolList, setSymbolList] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('anal_config');

  useQuery<IBinanceCoinsConfigResponse, Error>({
    queryKey: [QueryKeys.SpotBalance],
    queryFn: async () => {
      const data = await binanceCoinsConfig();
      const updateSymbolList = data.symbols.map((s) => s.symbol);
      setSymbolList(updateSymbolList);
      return data;
    },
    refetchOnWindowFocus: false,
  });

  return { symbolList, activeTab, setActiveTab };
};

export default useCoinConfigTemplate;
