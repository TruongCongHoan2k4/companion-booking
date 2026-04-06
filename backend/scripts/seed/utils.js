import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import connectDB from '../../src/config/db.js';
import { bigIntToDecimal128 } from '../../src/utils/money.util.js';

export function loadEnv() {
  dotenv.config();
  if (!process.env.MONGO_URI) {
    throw new Error('Thiếu MONGO_URI trong env (backend/.env).');
  }
  if (!process.env.ACCESS_TOKEN_SECRET) {
    // Seed không cần JWT, nhưng app cần để login; cảnh báo sớm để dev khỏi mất thời gian.
    console.warn('Cảnh báo: thiếu ACCESS_TOKEN_SECRET trong env (login sẽ lỗi).');
  }
}

export async function withDb(fn) {
  loadEnv();
  await connectDB();
  try {
    return await fn();
  } finally {
    await mongoose.connection.close();
  }
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

export function int(rand, min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(rand() * (hi - lo + 1)) + lo;
}

export function slugifyAscii(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();
}

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 12);
}

export function vnd(amount) {
  return bigIntToDecimal128(BigInt(Math.floor(Number(amount))));
}

export function nowPlusHours(rand, minHours, maxHours) {
  const h = int(rand, minHours, maxHours);
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

