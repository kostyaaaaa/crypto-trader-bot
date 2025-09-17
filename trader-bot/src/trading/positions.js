// trading/positions.js
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = './'; // якщо файли лежать у корені

async function loadFile(collection) {
  try {
    const raw = await fs.readFile(
      path.join(DATA_DIR, `${collection}.json`),
      'utf-8',
    );
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveFile(collection, data) {
  await fs.writeFile(
    path.join(DATA_DIR, `${collection}.json`),
    JSON.stringify(data, null, 2),
  );
}

/** Отримати всі відкриті позиції */
export async function getActivePositions(symbol = null) {
  const all = await loadFile('positions');
  return all.filter(
    (p) => p.status === 'OPEN' && (!symbol || p.symbol === symbol),
  );
}

/** Отримати позицію за id */
export async function getPositionById(id) {
  const all = await loadFile('positions');
  return all.find((p) => p.id === id) || null;
}

/** Додати нову позицію */
export async function addPosition(position) {
  const all = await loadFile('positions');
  all.push(position);
  await saveFile('positions', all);
  return position;
}

/** Оновити існуючу позицію (перезапис у файлі) */
export async function updatePosition(id, updates) {
  const all = await loadFile('positions');
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const curr = all[idx];
  const next = { ...curr, ...updates };
  all[idx] = next;

  await saveFile('positions', all);
  return next;
}

/** Закрити позицію */
export async function closePosition(id, reason, price) {
  const curr = await getPositionById(id);
  if (!curr) return null;

  const now = new Date().toISOString();
  const next = {
    ...curr,
    status: 'CLOSED',
    closedAt: now,
    exitPrice: price,
    exitReason: reason,
    updates: [...(curr.updates || []), { time: now, action: reason, price }],
  };

  const all = await loadFile('positions');
  const idx = all.findIndex((p) => p.id === id);
  if (idx !== -1) {
    all[idx] = next;
    await saveFile('positions', all);
  }

  // історію можна апендити окремо
  const hist = await loadFile('history');
  hist.push(next);
  await saveFile('history', hist);

  return next;
}

/** Часткова фіксація */
export async function partialClose(id, sizePct, reason, price) {
  const curr = await getPositionById(id);
  if (!curr) return null;

  const cut = (curr.size * sizePct) / 100;
  const newSize = Math.max(0, curr.size - cut);

  let newTPs = curr.takeProfits || [];
  if (newTPs.length) {
    newTPs = newTPs.filter((tp) => {
      const hitLong = curr.side === 'LONG' && price >= tp.price;
      const hitShort = curr.side === 'SHORT' && price <= tp.price;
      return !(hitLong || hitShort);
    });
  }

  const now = new Date().toISOString();
  let next = {
    ...curr,
    size: newSize,
    takeProfits: newTPs,
    lastPartialAt: now,
    updates: [
      ...(curr.updates || []),
      { time: now, action: 'TP', sizePct, price },
    ],
  };

  if (newSize <= 0) {
    next = {
      ...next,
      status: 'CLOSED',
      closedAt: now,
      exitPrice: price,
      exitReason: reason,
    };
    const hist = await loadFile('history');
    hist.push(next);
    await saveFile('history', hist);
  }

  const all = await loadFile('positions');
  const idx = all.findIndex((p) => p.id === id);
  if (idx !== -1) all[idx] = next;
  await saveFile('positions', all);

  return next;
}

/** Flip */
export async function flipPosition(id, newSide, price) {
  return await closePosition(id, 'FLIP', price);
}

/** Долив (DCA) */
export async function applyAddToPosition(pos, price, sizing, exits) {
  const addSize = Math.min(
    sizing.baseSizeUsd * (sizing.addMultiplier || 1),
    (sizing.maxPositionUsd ?? Infinity) - pos.size,
  );
  if (addSize <= 0) return pos;

  const totalCost = pos.entryPrice * pos.size + price * addSize;
  const newSize = pos.size + addSize;
  const newEntry = totalCost / newSize;

  let newStop = pos.stopPrice ?? null;
  if (exits?.sl?.type === 'hard') {
    const movePct = (exits.sl.hardPct || 0) / 100;
    newStop =
      pos.side === 'LONG' ? newEntry * (1 - movePct) : newEntry * (1 + movePct);
  }

  let newTps = pos.takeProfits || [];
  if (exits?.tp?.use && exits.tp.tpGridPct?.length) {
    newTps = exits.tp.tpGridPct.map((pct, i) => {
      const tpPrice =
        pos.side === 'LONG'
          ? newEntry * (1 + pct / 100)
          : newEntry * (1 - pct / 100);
      return { price: tpPrice, sizePct: exits.tp.tpGridSizePct[i] || 0 };
    });
  }

  const now = new Date().toISOString();
  const next = {
    ...pos,
    size: newSize,
    entryPrice: newEntry,
    stopPrice: newStop,
    takeProfits: newTps,
    lastAddAt: now,
    adds: (pos.adds || 0) + 1,
    updates: [
      ...(pos.updates || []),
      { time: now, action: 'ADD', addSize, price, newSize, newEntry },
    ],
  };

  const all = await loadFile('positions');
  const idx = all.findIndex((p) => p.id === pos.id);
  if (idx !== -1) all[idx] = next;
  await saveFile('positions', all);

  console.log(
    `➕ Added ${addSize}$ to ${pos.symbol} @ ${price}. New entry=${newEntry}, size=${newSize}`,
  );

  return next;
}
