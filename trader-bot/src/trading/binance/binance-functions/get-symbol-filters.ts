// ============ Exchange info / filters ============
import logger from '../../../utils/db-logger.ts';
import { getExchangeInfoCached } from './state.ts';
import type { SymbolFilter, SymbolInfo } from './types.ts';

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
