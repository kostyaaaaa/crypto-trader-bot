import axiosInterceptor from '../../axiosClient';

export const getPositionsByTimeAndSymbol = async (
  dateFrom: string,
  dateTo: string,
  symbol?: string | null,
): Promise<{
  count: number;
  data: IPositionProps[];
  message: string;
  success: boolean;
  timestamp: string;
}> => {
  const queryParams = new URLSearchParams();

  if (symbol) queryParams.append('symbol', symbol);
  queryParams.append('dateFrom', dateFrom);
  queryParams.append('dateTo', dateTo);

  const search_query = `?${queryParams.toString()}`;

  const { data } = await axiosInterceptor.get(`/positions${search_query}`);

  return data;
};

interface IPositionProps {
  closedAt: string;
  closedBy: string;
  openedAt: string;
  entryPrice: number;
  finalPnl: number;
  initialStopPrice: number | null;
  side: string;
  size: number;
  status: string;
  stopPrice: number;
  symbol: string;
  _id: string;
  analysisRef: {
    scores: {
      LONG: number;
      SHORT: number;
    };
  };
  meta: {
    leverage: number;
    openedBy: string;
    riskPct: number;
    strategyName: string | null;
  };
}
