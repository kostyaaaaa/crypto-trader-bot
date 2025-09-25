// core/historyStore.js
import { saveDoc, loadDocs } from '../../storage/storage.js';

const COLLECTION = 'positions';

/**
 * Відкрити нову позицію
 */
export async function openPosition(symbol, { side, entryPrice, size }) {
  const db = await loadDocs(COLLECTION, symbol);
  const pos = db.find((p) => p.symbol === symbol && p.status === 'OPEN');
  if (pos) return pos; // вже є

  const newPos = {
    symbol,
    side,
    entryPrice,
    size,
    openedAt: Date.now(),
    status: 'OPEN',
    adds: [],
    adjustments: [],
  };

  await saveDoc(COLLECTION, newPos, 500);
  return newPos;
}

/**
 * Долив
 */
export async function addToPosition(symbol, { qty, price }) {
  const db = await loadDocs(COLLECTION, symbol);
  const pos = db.find((p) => p.symbol === symbol && p.status === 'OPEN');
  if (!pos) return null;

  pos.size += qty;
  pos.adds.push({ qty, price, ts: Date.now() });

  await saveDoc(COLLECTION, pos, 500);
  return pos;
}

/**
 * Оновлення стопів/тейків
 */
export async function adjustPosition(symbol, { type, price, size }) {
  const db = await loadDocs(COLLECTION, symbol);
  const pos = db.find((p) => p.symbol === symbol && p.status === 'OPEN');
  if (!pos) return null;

  pos.adjustments.push({ type, price, size, ts: Date.now() });

  await saveDoc(COLLECTION, pos, 500);
  return pos;
}

/**
 * Закриття
 */
export async function closePositionHistory(symbol, { finalPnl }) {
  const db = await loadDocs(COLLECTION, symbol);
  const pos = db.find((p) => p.symbol === symbol && p.status === 'OPEN');
  if (!pos) return null;

  pos.status = 'CLOSED';
  pos.closedAt = Date.now();
  pos.finalPnl = finalPnl;

  await saveDoc(COLLECTION, pos, 500);
  return pos;
}

export async function getHistory(symbol, limit = 50) {
  return await loadDocs(COLLECTION, symbol, limit);
}
