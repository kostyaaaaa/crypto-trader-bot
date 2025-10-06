import axiosInterceptor from '../axiosClient';

export interface IClosePositionResponse {
  success: boolean;
  message: string;
  data?: {
    symbol: string;
    side: string;
    size: number;
    finalPnl: number;
    binanceOrderId: number;
  };
  timestamp: string;
}

export const closePosition = async (
  symbol: string,
): Promise<IClosePositionResponse> => {
  const { data } = await axiosInterceptor.post(`/positions/close`, {
    symbol,
  });

  return data;
};
