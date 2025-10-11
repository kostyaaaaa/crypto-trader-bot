// ============ Exchange info / filters ============
import type { SymbolFilter, SymbolInfo } from '../../../types';
import logger from '../../../utils/db-logger';
import { getExchangeInfoCached } from './state';

export async function getSymbolFilters(
  symbol: string,
): Promise<SymbolFilter[]> {
  try {
    const { symbols } = await getExchangeInfoCached();
    const sym = symbols.find((s) => s.symbol === symbol);
    return Array.isArray(sym?.filters) ? (sym!.filters as SymbolFilter[]) : [];
  } catch (err: any) {
    logger.error(
      `❌ getSymbolFilters failed for ${symbol}:`,
      err?.message || err,
    );
    return [];
  }
}

// (додатково зручно мати і це поруч)
export async function getSymbolInfo(
  symbol: string,
): Promise<SymbolInfo | null> {
  try {
    const { symbols } = await getExchangeInfoCached();
    return symbols.find((s) => s.symbol === symbol) ?? null;
  } catch (err: any) {
    logger.error(`❌ getSymbolInfo failed for ${symbol}:`, err?.message || err);
    return null;
  }
}
