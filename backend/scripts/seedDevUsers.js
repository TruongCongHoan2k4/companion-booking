/**
 * Seed cố định 2 tài khoản dev (CUSTOMER + COMPANION), mật khẩu: 123456.
 * Chạy: npm run seed:dev (từ thư mục backend, cần MONGO_URI trong .env)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/user.model.js';
import Companion from '../src/models/companion.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SALT_ROUNDS = 12;
const PASSWORD = '123456';

const CUSTOMER = {
  username: 'demo_user',
  email: 'demo_user@seed.local',
  fullName: 'Khách hàng demo',
  role: 'CUSTOMER',
};

const COMPANION_USER = {
  username: 'demo_companion',
  email: 'demo_companion@seed.local',
  fullName: 'Companion demo',
  role: 'COMPANION',
};

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Thiếu MONGO_URI trong backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const hashed = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  const customer = await User.findOneAndUpdate(
    { username: CUSTOMER.username },
    {
      $set: {
        password: hashed,
        email: CUSTOMER.email.toLowerCase(),
        fullName: CUSTOMER.fullName,
        role: CUSTOMER.role,
        locked: false,
        moderationFlag: 'NONE',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const companionUser = await User.findOneAndUpdate(
    { username: COMPANION_USER.username },
    {
      $set: {
        password: hashed,
        email: COMPANION_USER.email.toLowerCase(),
        fullName: COMPANION_USER.fullName,
        role: COMPANION_USER.role,
        locked: false,
        moderationFlag: 'NONE',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  await Companion.findOneAndUpdate(
    { user: companionUser._id },
    {
      $set: {
        bio: 'Hồ sơ seed — dùng cho dev/test.',
        area: 'TP. Hồ Chí Minh',
        serviceType: 'Ăn uống & trò chuyện',
        gender: 'Khác',
        status: 'APPROVED',
        onlineStatus: false,
        pricePerHour: mongoose.Types.Decimal128.fromString('200000'),
      },
      $setOnInsert: { user: companionUser._id },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  console.log('Seed xong.');
  console.log(`  CUSTOMER   → username: ${CUSTOMER.username}  |  password: ${PASSWORD}`);
  console.log(`  COMPANION  → username: ${COMPANION_USER.username}  |  password: ${PASSWORD}`);
  console.log(`  User IDs: customer=${customer._id} companionUser=${companionUser._id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
