// src/storage/storage.js
import { LiquidationsModel, LiquidityModel } from 'crypto-trader-db';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const DB_MAX = 1000000;

function getModel(collection) {
  switch (collection) {
    case 'liquidations':
      return LiquidationsModel;
    case 'liquidity':
      return LiquidityModel;
    default:
      return mongoose.connection.collection(collection); // native
  }
}

/* ========= SAVE ========= */
export async function saveDoc(collection, doc) {
  const Model = getModel(collection);
  const maxDocs = DB_MAX;

  if (Model.create) {
    // mongoose
    await Model.create(doc);
    const count = await Model.countDocuments();
    if (count > maxDocs) {
      const oldest = await Model.find()
        .sort({ _id: 1 })
        .limit(count - maxDocs);
      const ids = oldest.map((d) => d._id);
      await Model.deleteMany({ _id: { $in: ids } });
    }
  } else {
    // native
    await Model.insertOne(doc);
    const count = await Model.countDocuments();
    if (count > maxDocs) {
      const toDelete = count - maxDocs;
      const oldest = await Model.find()
        .sort({ _id: 1 })
        .limit(toDelete)
        .toArray();
      const ids = oldest.map((d) => d._id);
      await Model.deleteMany({ _id: { $in: ids } });
    }
  }
}

/* ========= LOAD ========= */
export async function loadDocs(collection, symbol, limit = 100) {
  const Model = getModel(collection);
  const query = symbol ? { symbol } : {};

  if (Model.find && Model.create) {
    return await Model.find(query).sort({ time: -1 }).limit(limit).lean();
  } else {
    return await Model.find(query).sort({ time: -1 }).limit(limit).toArray();
  }
}

/* ========= RAW ========= */
export async function loadDocsRaw(collection) {
  const Model = getModel(collection);

  if (Model.find && Model.create) {
    return await Model.find({}).lean();
  } else {
    return await Model.find({}).toArray();
  }
}

/* ========= UPDATE ========= */
export async function updateDoc(collection, query, update, opts = {}) {
  const Model = getModel(collection);

  if (Model.findOneAndUpdate) {
    // mongoose
    return await Model.findOneAndUpdate(query, update, {
      new: true,
      upsert: opts.upsert === true,
    });
  } else {
    // native
    return await Model.findOneAndUpdate(query, update, {
      returnDocument: 'after',
      upsert: opts.upsert === true,
    });
  }
}
