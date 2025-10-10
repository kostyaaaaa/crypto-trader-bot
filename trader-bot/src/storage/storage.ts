// src/storage/storage.ts
import dotenv from 'dotenv';
import type { Model } from 'mongoose';

import type {
  IAnalysis,
  ILiquidations,
  ILiquidity,
  IPosition,
} from 'crypto-trader-db';
import {
  AnalysisModel,
  LiquidationsModel,
  LiquidityModel,
  PositionModel,
} from 'crypto-trader-db';

dotenv.config();

const DB_MAX = 1_000_000 as const;

/* ===================== Types ===================== */

type DocByCollection = {
  liquidations: ILiquidations;
  liquidity: ILiquidity;
  analysis: IAnalysis;
  positions: IPosition;
};

export type KnownCollection = keyof DocByCollection;
type DocOf<C extends KnownCollection> = DocByCollection[C];

/** дозволяємо Date або ISO-рядок у часових полях */
type MaybeDate = Date | string;
type AllowDateStrings<T> = {
  [K in keyof T]: K extends 'time' | 'createdAt' | 'updatedAt'
    ? T[K] | MaybeDate
    : T[K];
};
type DocInput<C extends KnownCollection> = AllowDateStrings<DocOf<C>>;

/* ===================== Model map ===================== */

const MODELS = {
  liquidations: LiquidationsModel, // Model<ILiquidations>
  liquidity: LiquidityModel, // Model<ILiquidity>
  analysis: AnalysisModel, // Model<IAnalysis>
  positions: PositionModel, // Model<IPosition>
} as const;

export function getModel(c: KnownCollection) {
  return MODELS[c];
}

/* ===================== SAVE ===================== */

export async function saveDoc<C extends KnownCollection>(
  collection: C,
  doc: DocInput<C>,
): Promise<void> {
  // спрощуємо внутрішні типи: працюємо як з Model<any>
  const model = getModel(collection) as unknown as Model<any>;

  await model.create(doc as any);

  const count = await model.countDocuments();
  if (count > DB_MAX) {
    const oldest = await model
      .find()
      .sort({ _id: 1 })
      .limit(count - DB_MAX);
    const ids = oldest.map((d: any) => d._id);
    await model.deleteMany({ _id: { $in: ids } });
  }
}

/* ===================== LOAD ===================== */

export async function loadDocs<C extends KnownCollection>(
  collection: C,
  symbol?: string,
  limit = 100,
): Promise<DocOf<C>[]> {
  const model = getModel(collection) as unknown as Model<any>;
  const query = symbol ? { symbol } : {};

  const docs = await model
    .find(query)
    .sort({ time: -1 })
    .limit(limit)
    .lean<DocOf<C>>()
    .exec();

  return docs as unknown as DocOf<C>[]; // або просто `return docs as DocOf<C>[]`
}

export async function loadDocsRaw<C extends KnownCollection>(
  collection: C,
): Promise<DocOf<C>[]> {
  const model = getModel(collection) as unknown as Model<any>;

  const docs = await model
    .find({})
    .lean<DocOf<C>>() // <— те саме
    .exec();

  return docs as unknown as DocOf<C>[];
}
/* ===================== UPDATE ===================== */

type UpdateOpts = { upsert?: boolean };

export async function updateDoc<C extends KnownCollection>(
  collection: C,
  query: Partial<DocOf<C>>,
  update: Partial<DocOf<C>> | Record<string, unknown>,
  opts: UpdateOpts = {},
): Promise<DocOf<C> | null> {
  const model = getModel(collection) as unknown as Model<any>;
  const res = await model
    .findOneAndUpdate(query, update, {
      new: true,
      upsert: opts.upsert === true,
    })
    .lean();

  return (res ?? null) as DocOf<C> | null;
}
