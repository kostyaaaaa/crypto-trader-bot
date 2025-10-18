import { model } from 'mongoose';
import { CandleSchema, type ICandle } from '../schemas/Candle.schema.js';

export const CandleModel = model<ICandle>('Candle', CandleSchema);
