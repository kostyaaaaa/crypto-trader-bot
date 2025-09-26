// src/storage/storage.js
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { LiquidationsModel, LiquidityModel } from 'crypto-trader-db';

dotenv.config();

const USE_FILES = process.env.USE_FILES === 'true';
const FILE_MAX = 1000;
const DB_MAX = 10000;

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
  if (USE_FILES) {
    let db = [];
    try {
      db = JSON.parse(fs.readFileSync(`${collection}.json`, 'utf-8'));
      if (!Array.isArray(db)) db = [];
    } catch {
      db = [];
    }

    db.push(doc);
    if (db.length > FILE_MAX) db = db.slice(-FILE_MAX);

    fs.writeFileSync(`${collection}.json`, JSON.stringify(db, null, 2));
    return;
  }

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
  if (USE_FILES) {
    let db = [];
    try {
      db = JSON.parse(fs.readFileSync(`${collection}.json`, 'utf-8'));
      if (!Array.isArray(db)) db = [];
    } catch {
      db = [];
    }

    if (symbol) db = db.filter((d) => d.symbol === symbol);
    if (limit && db.length > limit) return db.slice(-limit);
    return db;
  }

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
  if (USE_FILES) {
    try {
      const db = JSON.parse(fs.readFileSync(`${collection}.json`, 'utf-8'));
      return Array.isArray(db) ? db : [];
    } catch {
      return [];
    }
  }

  const Model = getModel(collection);

  if (Model.find && Model.create) {
    return await Model.find({}).lean();
  } else {
    return await Model.find({}).toArray();
  }
}

/* ========= UPDATE ========= */
export async function updateDoc(collection, query, update) {
  if (USE_FILES) {
    let db = [];
    try {
      db = JSON.parse(fs.readFileSync(`${collection}.json`, 'utf-8'));
      if (!Array.isArray(db)) db = [];
    } catch {
      db = [];
    }

    let updated = null;
    db = db.map((doc) => {
      const match = Object.keys(query).every((k) => doc[k] === query[k]);
      if (!match) return doc;

      // підтримка $set і $push у файловому режимі
      updated = { ...doc };
      if (update.$set) {
        updated = { ...updated, ...update.$set };
      }
      if (update.$push) {
        for (const [key, val] of Object.entries(update.$push)) {
          if (!Array.isArray(updated[key])) updated[key] = [];
          updated[key].push(val);
        }
      }
      if (update.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          updated[key] = (updated[key] || 0) + val;
        }
      }
      return updated;
    });

    fs.writeFileSync(`${collection}.json`, JSON.stringify(db, null, 2));
    return updated;
  }

  const Model = getModel(collection);

  if (Model.findOneAndUpdate) {
    // mongoose
    return await Model.findOneAndUpdate(query, update, { new: true });
  } else {
    // native
    return await Model.findOneAndUpdate(query, update, {
      returnDocument: 'after',
    });
  }
}
