import type { IAnalysis } from '../../types';
import axiosInterceptor from '../axiosClient';

export interface AnalysisListResponse {
  success: boolean;
  message: string;
  data: IAnalysis[];
  count: number;
  timestamp: string;
}

export const getAnalysisByDateRangeAndSymbol = async (
  dateFrom: string,
  dateTo: string,
  symbol: string,
): Promise<AnalysisListResponse> => {
  const params = new URLSearchParams();
  params.append('symbol', symbol);
  params.append('dateFrom', dateFrom);
  params.append('dateTo', dateTo);

  const { data } = await axiosInterceptor.get(
    `/analytics?${params.toString()}`,
  );
  return data;
};
