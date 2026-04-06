import mongoose from 'mongoose';

import User from '../src/models/user.model.js';
import Companion from '../src/models/companion.model.js';
import Booking from '../src/models/booking.model.js';
import Category from '../src/models/category.model.js';
import ServicePrice from '../src/models/servicePrice.model.js';
import WalletTransaction from '../src/models/walletTransaction.model.js';
import Review from '../src/models/review.model.js';
import Report from '../src/models/report.model.js';
import Withdrawal from '../src/models/withdrawal.model.js';
import PlatformSettings from '../src/models/platformSettings.model.js';
import { withDb, mulberry32, pick, int, slugifyAscii, hashPassword, vnd } from './seed/utils.js';

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || '123456';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k) => {
    const idx = args.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`));
    if (idx === -1) return undefined;
    const a = args[idx];
    if (a.includes('=')) return a.split('=').slice(1).join('=');
    return args[idx + 1];
  };
  const has = (k) => args.includes(`--${k}`);

  const reset = has('reset') || process.env.SEED_RESET === '1';
  const profile = (get('profile') || process.env.SEED_PROFILE || 'realistic').toLowerCase();
  const seed = Number(get('seed') || process.env.SEED || 20260406);
  const companions = Number(get('companions') || process.env.SEED_COMPANIONS || 10);
  const customers = Number(get('customers') || process.env.SEED_CUSTOMERS || 20);
  const bookings = Number(get('bookings') || process.env.SEED_BOOKINGS || 25);

  return { reset, profile, seed, companions, customers, bookings };
}

async function hardReset() {
  // cố gắng dropDatabase trước (nhanh, sạch); nếu không được thì fallback deleteMany theo model
  try {
    await mongoose.connection.db.dropDatabase();
    return;
  } catch (e) {
    // ignore
  }

  const models = [Withdrawal, Report, Review, WalletTransaction, Booking, ServicePrice, Companion, User, Category, PlatformSettings];

  for (const m of models) {
    try {
      await m.deleteMany({});
    } catch (e) {
      // ignore
    }
  }
}

async function ensurePlatformSettings() {
  await PlatformSettings.updateOne({}, { $setOnInsert: { commissionRate: 0.15 } }, { upsert: true });
}

function monthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dateInMonth(rand, baseDate) {
  const d = new Date(baseDate);
  d.setDate(int(rand, 1, 28));
  d.setHours(int(rand, 0, 23), int(rand, 0, 59), int(rand, 0, 59), 0);
  return d;
}

async function upsertUser({ username, email, role, fullName, phoneNumber, balanceVnd }) {
  const emailLower = String(email).toLowerCase();
  const existing = await User.findOne({ $or: [{ username }, { email: emailLower }] }).select('+password');
  const hashed = await hashPassword(DEFAULT_PASSWORD);

  if (existing) {
    existing.username = username;
    existing.email = emailLower;
    existing.role = role;
    existing.fullName = fullName || undefined;
    existing.phoneNumber = phoneNumber || undefined;
    existing.locked = false;
    existing.moderationFlag = 'NONE';
    existing.password = hashed;
    if (balanceVnd != null) existing.balance = vnd(balanceVnd);
    await existing.save();
    return existing;
  }

  return User.create({
    username,
    password: hashed,
    email: emailLower,
    role,
    fullName: fullName || undefined,
    phoneNumber: phoneNumber || undefined,
    balance: vnd(balanceVnd || 0),
    locked: false,
    moderationFlag: 'NONE',
  });
}

async function seedCategories() {
  const rows = [
    { name: 'Chơi game', type: 'SERVICE' },
    { name: 'Tâm sự', type: 'SERVICE' },
    { name: 'Đi chơi', type: 'SERVICE' },
    { name: 'Cafe', type: 'VENUE' },
    { name: 'Trung tâm thương mại', type: 'VENUE' },
    { name: 'Xem phim', type: 'VENUE' },
  ];
  for (const r of rows) {
    await Category.updateOne({ name: r.name, type: r.type }, { $setOnInsert: r }, { upsert: true });
  }
}

async function seedBaseAccounts() {
  const admin = await upsertUser({
    username: 'admin',
    email: 'admin@seed.local',
    role: 'ADMIN',
    fullName: 'Admin',
    phoneNumber: '0900000000',
    balanceVnd: 0,
  });

  const customer = await upsertUser({
    username: 'customer1',
    email: 'customer1@seed.local',
    role: 'CUSTOMER',
    fullName: 'Nguyễn Minh Anh',
    phoneNumber: '0900000001',
    balanceVnd: 0,
  });

  const companionUser = await upsertUser({
    username: 'companion1',
    email: 'companion1@seed.local',
    role: 'COMPANION',
    fullName: 'Trần Thu Trang',
    phoneNumber: '0900000002',
    balanceVnd: 0,
  });

  const companion = await Companion.findOneAndUpdate(
    { user: companionUser._id },
    {
      $set: {
        user: companionUser._id,
        bio: 'Seed: hồ sơ companion mẫu để test nhanh.',
        hobbies: 'Game, cafe, du lịch',
        appearance: 'Gọn gàng, lịch sự',
        availability: 'Tối 18:00-23:00',
        serviceType: 'Đi chơi, tâm sự, chơi game',
        area: 'TP.HCM',
        rentalVenues: 'Quán cafe, trung tâm thương mại',
        gender: 'Nữ',
        gameRank: 'Diamond',
        onlineStatus: true,
        pricePerHour: vnd(250000),
        avatarUrl: 'https://picsum.photos/seed/companion1/400/400',
        status: 'APPROVED',
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return { admin, customer, companionUser, companion };
}

async function seedUsersAndCompanions(rand, companionCount, customerCount) {
  const familyNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng', 'Bùi'];
  const givenNames = ['An', 'Bình', 'Châu', 'Duy', 'Giang', 'Hà', 'Hân', 'Khoa', 'Linh', 'Mai', 'Minh', 'Nam', 'Ngọc', 'Phong', 'Quân', 'Trang', 'Tú', 'Vy'];
  const areas = ['TP.HCM', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng'];
  const genders = ['Nữ', 'Nam'];
  const ranks = ['Silver', 'Gold', 'Platinum', 'Diamond', 'Master'];

  const companions = [];
  for (let i = 0; i < companionCount; i++) {
    const fullName = `${pick(rand, familyNames)} ${pick(rand, givenNames)}`;
    const username = `comp_${slugifyAscii(fullName)}_${i + 1}`;
    const email = `${username}@seed.local`;
    const user = await upsertUser({
      username,
      email,
      role: 'COMPANION',
      fullName,
      phoneNumber: `09${String(10000000 + i).slice(0, 8)}`,
      balanceVnd: 0,
    });

    const price = int(rand, 150000, 450000);

    const companion = await Companion.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          user: user._id,
          bio: `Mình là ${fullName}, sẵn sàng đồng hành và tạo trải nghiệm vui vẻ.`,
          hobbies: pick(rand, ['Game, cafe', 'Du lịch, chụp ảnh', 'Xem phim, âm nhạc', 'Ăn uống, dạo phố']),
          appearance: pick(rand, ['Lịch sự, gọn gàng', 'Năng động', 'Dễ gần', 'Chỉn chu']),
          availability: pick(rand, ['Sáng 8:00-12:00', 'Chiều 13:00-17:00', 'Tối 18:00-23:00', 'Cuối tuần linh hoạt']),
          serviceType: pick(rand, ['Chơi game', 'Tâm sự', 'Đi chơi', 'Cafe', 'Xem phim']),
          area: pick(rand, areas),
          rentalVenues: pick(rand, ['Quán cafe', 'TTTM', 'Công viên', 'Rạp phim']),
          gender: pick(rand, genders),
          gameRank: pick(rand, ranks),
          onlineStatus: rand() > 0.4,
          pricePerHour: vnd(price),
          avatarUrl: `https://picsum.photos/seed/companion_${i + 1}/400/400`,
          introVideoUrl: rand() > 0.7 ? `https://example.invalid/intro_${i + 1}.mp4` : undefined,
          status: rand() > 0.15 ? 'APPROVED' : 'PENDING',
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    companions.push({ user, companion, pricePerHour: price });
  }

  const customers = [];
  for (let i = 0; i < customerCount; i++) {
    const fullName = `${pick(rand, familyNames)} ${pick(rand, givenNames)}`;
    const username = `cus_${slugifyAscii(fullName)}_${i + 1}`;
    const email = `${username}@seed.local`;
    const balance = 0;
    const user = await upsertUser({
      username,
      email,
      role: 'CUSTOMER',
      fullName,
      phoneNumber: `08${String(20000000 + i).slice(0, 8)}`,
      balanceVnd: balance,
    });
    customers.push({ user, balance });
  }

  return { companions, customers };
}

async function seedServicePrices(rand, companions) {
  const serviceNames = ['Chơi game', 'Tâm sự', 'Đi chơi', 'Cafe', 'Xem phim'];
  for (const c of companions) {
    const count = int(rand, 2, 4);
    const used = new Set();
    for (let i = 0; i < count; i++) {
      const name = pick(rand, serviceNames);
      if (used.has(name)) continue;
      used.add(name);
      const price = Math.max(120000, c.pricePerHour + int(rand, -50000, 120000));
      await ServicePrice.updateOne(
        { companion: c.companion._id, serviceName: name },
        {
          $set: {
            companion: c.companion._id,
            serviceName: name,
            pricePerHour: vnd(price),
            description: pick(rand, ['Gói cơ bản', 'Gói nâng cao', 'Trải nghiệm vui vẻ, an toàn']),
          },
        },
        { upsert: true }
      );
    }
  }
}

async function seedDashboardEvents(rand, { companions, customers }) {
  const approved = companions.filter((c) => c.companion?.status === 'APPROVED');
  if (!approved.length || !customers.length) return;

  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    months.push(monthStart(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }

  // 1) Rải booking + CHARGE theo tháng để adminStats có revenue + totalTransactions tăng.
  // Không phụ thuộc replica set: tạo trực tiếp Booking + WalletTransaction.
  for (const m of months) {
    const nBookings = int(rand, 1, 4);
    for (let i = 0; i < nBookings; i++) {
      const c = pick(rand, approved);
      const u = pick(rand, customers);
      const duration = pick(rand, [60, 90, 120, 180]);
      const price = Number(c.pricePerHour || 200000);
      const hold = Math.max(10000, Math.ceil((duration * price) / 60));
      const createdAt = dateInMonth(rand, m);

      const booking = await Booking.create({
        customer: u.user._id,
        companion: c.companion._id,
        bookingTime: createdAt,
        duration,
        location: pick(rand, ['Quận 1', 'Quận 3', 'Cầu Giấy', 'Hải Châu']),
        rentalVenue: pick(rand, ['Quán cafe', 'TTTM', 'Rạp phim']),
        serviceName: pick(rand, ['Chơi game', 'Tâm sự', 'Đi chơi', 'Cafe']),
        servicePricePerHour: vnd(price),
        holdAmount: vnd(hold),
        status: pick(rand, ['COMPLETED', 'COMPLETED', 'REJECTED', 'CANCELLED']),
        acceptedAt: createdAt,
        startedAt: createdAt,
        completedAt: createdAt,
        createdAt,
      });

      // Tính "lợi nhuận nền tảng" dùng WalletTransaction type CHARGE
      if (booking.status === 'COMPLETED') {
        await WalletTransaction.create({
          user: u.user._id,
          booking: booking._id,
          amount: vnd(int(rand, 30000, 250000)),
          type: 'CHARGE',
          provider: 'SYSTEM',
          description: 'Phí nền tảng',
          createdAt,
        });
      }

      // 2) Review mới theo tháng (gắn booking COMPLETED)
      if (booking.status === 'COMPLETED' && rand() > 0.35) {
        await Review.updateOne(
          { booking: booking._id },
          {
            $setOnInsert: {
              booking: booking._id,
              rating: pick(rand, [3, 4, 5]),
              comment: pick(rand, ['Ổn áp', 'Rất vui', 'Dễ thương', 'Đúng giờ, nói chuyện tốt']),
              hidden: false,
              createdAt,
            },
          },
          { upsert: true }
        );
      }

      // 3) Tranh chấp/report theo tháng
      if (rand() > 0.85) {
        const reporter = u.user;
        const reported = c.user;
        if (String(reporter._id) !== String(reported._id)) {
          await Report.create({
            reporter: reporter._id,
            reportedUser: reported._id,
            reason: pick(rand, ['Không đúng giờ', 'Thái độ không phù hợp', 'Hủy sát giờ', 'Khác']),
            category: pick(rand, ['Thanh toán', 'Thái độ', 'Hành vi', 'Khác']),
            emergency: rand() > 0.9,
            relatedBookingId: booking._id,
            status: rand() > 0.6 ? 'RESOLVED' : 'PENDING',
            resolutionAction: rand() > 0.6 ? pick(rand, ['REFUND', 'PAYOUT', 'CLOSE']) : undefined,
            resolutionNote: rand() > 0.6 ? 'Biên bản xử lý theo quy trình.' : undefined,
            lastActionAt: createdAt,
            createdAt,
          });
        }
      }
    }

    // 4) Lệnh rút tiền theo tháng
    if (rand() > 0.4) {
      const c = pick(rand, approved);
      const createdAt = dateInMonth(rand, m);
      await Withdrawal.create({
        companion: c.companion._id,
        amount: vnd(int(rand, 150000, 3000000)),
        bankName: pick(rand, ['Vietcombank', 'Techcombank', 'MB Bank', 'ACB']),
        bankAccountNumber: String(1000000000 + int(rand, 0, 899999999)).slice(0, 10),
        accountHolderName: c.user?.fullName || c.user?.username || 'Companion',
        status: pick(rand, ['PENDING', 'APPROVED', 'REJECTED', 'PAID']),
        createdAt,
      });
    }
  }
}

async function run() {
  const { reset, profile, seed, companions, customers, bookings } = parseArgs();
  const rand = mulberry32(seed);

  if (reset) {
    console.log('Seed: reset bật, đang xóa dữ liệu...');
    await hardReset();
  }

  await ensurePlatformSettings();
  await seedCategories();

  const base = await seedBaseAccounts();

  if (profile === 'dev' || profile === 'minimal') {
    console.log('Seed OK (minimal).');
  } else {
    const companionCount = profile === 'e2e' ? Math.max(6, companions) : companions;
    const customerCount = profile === 'e2e' ? Math.max(10, customers) : customers;
    const bookingCount = profile === 'e2e' ? Math.max(15, bookings) : bookings;

    const { companions: companionRows, customers: customerRows } = await seedUsersAndCompanions(
      rand,
      companionCount,
      customerCount
    );
    await seedServicePrices(rand, companionRows);
    await seedDashboardEvents(rand, { companions: companionRows, customers: customerRows });

    console.log('Seed OK.');
    console.log(`Tạo ${companionRows.length} companion, ${customerRows.length} customer.`);
  }

  console.log('Tài khoản seed (password mặc định):', DEFAULT_PASSWORD);
  console.log('- ADMIN:', base.admin.username);
  console.log('- CUSTOMER:', base.customer.username);
  console.log('- COMPANION:', base.companionUser.username);
  console.log('Companion docId:', base.companion._id.toString());
}

await withDb(run);

