import mongoose from 'mongoose';

import User from '../src/models/user.model.js';
import Companion from '../src/models/companion.model.js';
import Booking from '../src/models/booking.model.js';
import Category from '../src/models/category.model.js';
import ServicePrice from '../src/models/servicePrice.model.js';
import WalletTransaction from '../src/models/walletTransaction.model.js';
import Transaction from '../src/models/transaction.model.js';
import Review from '../src/models/review.model.js';
import PlatformSettings from '../src/models/platformSettings.model.js';
import Favorite from '../src/models/favorite.model.js';
import Consultation from '../src/models/consultation.model.js';
import Notification from '../src/models/notification.model.js';
import Report from '../src/models/report.model.js';
import Withdrawal from '../src/models/withdrawal.model.js';
import ChatMessage from '../src/models/chatMessage.model.js';
import PasswordResetOtp from '../src/models/passwordResetOtp.model.js';
import CompanionAvailability from '../src/models/companionAvailability.model.js';

import { createBooking, workflowBooking, checkInBooking, checkOutBooking } from '../src/services/booking.service.js';
import { withDb, mulberry32, pick, int, slugifyAscii, hashPassword, vnd, nowPlusHours } from './seed/utils.js';

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || '123456';

function backdateWithinLastMonths(rand, maxMonthsBack = 11) {
  const now = new Date();
  const monthsBack = int(rand, 0, Math.max(0, Math.floor(maxMonthsBack)));
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  d.setDate(int(rand, 1, 28));
  d.setHours(int(rand, 0, 23), int(rand, 0, 59), int(rand, 0, 59), 0);
  return d;
}

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

  const models = [
    ChatMessage,
    Notification,
    Report,
    Review,
    Transaction,
    WalletTransaction,
    Withdrawal,
    Consultation,
    Favorite,
    Booking,
    ServicePrice,
    CompanionAvailability,
    Companion,
    PasswordResetOtp,
    User,
    Category,
    PlatformSettings,
  ];

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
    balanceVnd: 5000000,
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

  const hasDeposit = await WalletTransaction.exists({ user: customer._id, type: 'DEPOSIT' });
  if (!hasDeposit) {
    await WalletTransaction.create({
      user: customer._id,
      amount: vnd(5000000),
      type: 'DEPOSIT',
      provider: 'SEED',
      description: 'Seed: nạp ví ban đầu',
    });
  }

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
    const balance = int(rand, 1500000, 8000000);
    const user = await upsertUser({
      username,
      email,
      role: 'CUSTOMER',
      fullName,
      phoneNumber: `08${String(20000000 + i).slice(0, 8)}`,
      balanceVnd: balance,
    });

    const hasDeposit = await WalletTransaction.exists({ user: user._id, type: 'DEPOSIT' });
    if (!hasDeposit) {
      await WalletTransaction.create({
        user: user._id,
        amount: vnd(balance),
        type: 'DEPOSIT',
        provider: 'SEED',
        description: 'Seed: nạp ví ban đầu',
      });
    }
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

async function seedBookings(rand, companions, customers, bookingCount) {
  const approved = companions.filter((c) => c.companion.status === 'APPROVED');
  if (approved.length === 0) return;

  const venues = ['Quận 1', 'Quận 3', 'Thủ Đức', 'Cầu Giấy', 'Hai Bà Trưng', 'Hải Châu'];
  const rentalVenues = ['Quán cafe', 'TTTM', 'Rạp phim', 'Công viên'];
  const notes = ['Đi đúng giờ giúp mình nhé', 'Mình hơi ngại, nói chuyện nhẹ nhàng', 'Ưu tiên chỗ đông người', 'Có thể đổi địa điểm nếu cần'];

  for (let i = 0; i < bookingCount; i++) {
    const c = pick(rand, approved);
    const u = pick(rand, customers);

    const duration = pick(rand, [60, 90, 120, 180]);
    const price = c.pricePerHour;
    const hold = Math.ceil((duration * price) / 60);
    if (u.balance < hold + 200000) {
      const topup = hold + 1000000;
      await User.updateOne({ _id: u.user._id }, { $set: { balance: vnd(topup) } });
      await WalletTransaction.create({
        user: u.user._id,
        amount: vnd(topup),
        type: 'DEPOSIT',
        provider: 'SEED',
        description: 'Seed: tự nạp thêm để đủ đặt lịch',
      });
      u.balance = topup;
    }

    const bookingTime = nowPlusHours(rand, 2, 72);
    const payload = {
      companionId: c.companion._id.toString(),
      bookingTime,
      duration,
      location: pick(rand, venues),
      rentalVenue: pick(rand, rentalVenues),
      serviceName: pick(rand, ['Chơi game', 'Tâm sự', 'Đi chơi', 'Cafe']),
      servicePricePerHour: price,
      note: rand() > 0.5 ? pick(rand, notes) : undefined,
    };

    let created;
    try {
      created = await createBooking(u.user._id.toString(), payload);
    } catch (e) {
      // Fallback cho MongoDB không bật replica set (transaction sẽ fail).
      // Tạo booking trực tiếp để UI/admin có dữ liệu để hiển thị.
      try {
        const holdAmount = vnd(hold);
        const createdAt = backdateWithinLastMonths(rand, 11);
        const [doc] = await Booking.create([
          {
            customer: u.user._id,
            companion: c.companion._id,
            bookingTime: new Date(bookingTime),
            duration,
            location: payload.location || undefined,
            rentalVenue: payload.rentalVenue || undefined,
            serviceName: payload.serviceName || undefined,
            servicePricePerHour: vnd(price),
            note: payload.note || undefined,
            holdAmount,
            status: 'PENDING',
            createdAt,
          },
        ]);
        created = { ...doc.toObject(), _id: doc._id.toString() };
      } catch (_fallbackErr) {
        continue;
      }
    }

    const actionRoll = rand();
    if (actionRoll < 0.15) {
      try {
        await workflowBooking(c.companion._id.toString(), created._id, 'REJECT');
      } catch (_) {
        await Booking.updateOne({ _id: created._id }, { $set: { status: 'REJECTED' } });
      }
    } else {
      try {
        await workflowBooking(c.companion._id.toString(), created._id, 'ACCEPT');
      } catch (_) {
        await Booking.updateOne({ _id: created._id }, { $set: { status: 'ACCEPTED', acceptedAt: new Date() } });
      }
      if (actionRoll > 0.55) {
        try {
          await checkInBooking(u.user._id.toString(), 'CUSTOMER', created._id);
        } catch (_) {
          await Booking.updateOne({ _id: created._id }, { $set: { status: 'IN_PROGRESS', startedAt: new Date() } });
        }
        if (actionRoll > 0.8) {
          try {
            await checkOutBooking(u.user._id.toString(), 'CUSTOMER', created._id);
          } catch (_) {
            await Booking.updateOne(
              { _id: created._id },
              { $set: { status: 'COMPLETED', completedAt: new Date() } }
            );
          }

          if (rand() > 0.5) {
            const rating = pick(rand, [3, 4, 5]);
            await Review.updateOne(
              { booking: new mongoose.Types.ObjectId(created._id) },
              {
                $setOnInsert: {
                  booking: new mongoose.Types.ObjectId(created._id),
                  rating,
                  comment: pick(rand, ['Rất vui!', 'Ổn áp', 'Nói chuyện dễ chịu', 'Sẽ đặt lại']),
                  hidden: false,
                },
              },
              { upsert: true }
            );
          }
        }
      }
    }
  }
}

async function seedAdminEvents(rand, { companions, customers }) {
  const approvedCompanions = companions.filter((c) => c.companion.status === 'APPROVED');
  if (!approvedCompanions.length || !customers.length) return;

  // 1) Profit widget trên dashboard đọc WalletTransaction type=CHARGE
  // Hiện service checkout chưa tạo CHARGE, nên seed tạo một số CHARGE "giả lập phí nền tảng" để dashboard có dữ liệu.
  const completedBookings = await Booking.find({ status: 'COMPLETED' }).sort({ createdAt: -1 }).limit(40).lean();
  if (completedBookings.length) {
    for (const b of completedBookings.slice(0, 18)) {
      const exists = await WalletTransaction.exists({ booking: b._id, type: 'CHARGE' });
      if (exists) continue;
      const createdAt = backdateWithinLastMonths(rand, 11);
      await WalletTransaction.create({
        user: b.customer,
        booking: b._id,
        amount: b.holdAmount || vnd(0),
        type: 'CHARGE',
        provider: 'SEED',
        description: 'Seed: tính phí nền tảng cho booking hoàn tất',
        createdAt,
      });
      await Transaction.updateOne(
        { booking: b._id },
        { $setOnInsert: { booking: b._id, amount: b.holdAmount || vnd(0), status: 'COMPLETED', createdAt } },
        { upsert: true }
      );
    }
  } else {
    // Nếu không có booking (ví dụ DB không hỗ trợ transaction và seed booking bị skip),
    // vẫn tạo CHARGE rải theo tháng để dashboard có số liệu.
    const customerUsers = customers.map((x) => x.user).filter(Boolean);
    const chargeCount = int(rand, 8, 18);
    for (let i = 0; i < chargeCount; i++) {
      const u = pick(rand, customerUsers);
      const createdAt = backdateWithinLastMonths(rand, 11);
      await WalletTransaction.create({
        user: u._id,
        amount: vnd(int(rand, 30000, 180000)),
        type: 'CHARGE',
        provider: 'SEED',
        description: 'Seed: phí nền tảng',
        createdAt,
      });
    }
  }

  // 2) Withdrawal chart + pending list
  const withdrawalCount = Math.min(10, approvedCompanions.length);
  for (let i = 0; i < withdrawalCount; i++) {
    const c = approvedCompanions[i];
    const createdAt = backdateWithinLastMonths(rand, 11);
    const amount = vnd(int(rand, 200000, 2500000));
    await Withdrawal.create({
      companion: c.companion._id,
      amount,
      bankName: pick(rand, ['Vietcombank', 'Techcombank', 'MB Bank', 'ACB']),
      bankAccountNumber: String(1000000000 + int(rand, 0, 899999999)).slice(0, 10),
      accountHolderName: c.user.fullName || c.user.username,
      status: rand() > 0.65 ? 'APPROVED' : 'PENDING',
      createdAt,
    });
  }

  // 3) Disputes chart (Report)
  const reportCount = int(rand, 4, 12);
  for (let i = 0; i < reportCount; i++) {
    const reporter = pick(rand, customers).user;
    const reported = pick(rand, approvedCompanions).user;
    if (!reporter?._id || !reported?._id) continue;
    if (String(reporter._id) === String(reported._id)) continue;
    const createdAt = backdateWithinLastMonths(rand, 11);
    await Report.create({
      reporter: reporter._id,
      reportedUser: reported._id,
      reason: pick(rand, [
        'Không đúng giờ hẹn',
        'Thái độ không phù hợp',
        'Yêu cầu ngoài phạm vi dịch vụ',
        'Hủy kèo sát giờ',
      ]),
      category: pick(rand, ['Hành vi', 'Thái độ', 'Thanh toán', 'Khác']),
      emergency: rand() > 0.85,
      status: rand() > 0.55 ? 'RESOLVED' : 'PENDING',
      resolutionAction: rand() > 0.55 ? pick(rand, ['REFUND', 'PAYOUT', 'CLOSE']) : undefined,
      resolutionNote: rand() > 0.55 ? 'Seed: xử lý tranh chấp theo quy trình.' : undefined,
      lastActionAt: createdAt,
      createdAt,
    });
  }

  // 4) Reviews chart: đảm bảo có review rải đều (trang admin đọc Review.createdAt)
  const existingReviews = await Review.countDocuments();
  if (existingReviews < 12) {
    const bookings = await Booking.find({ status: 'COMPLETED' }).sort({ createdAt: -1 }).limit(30).lean();
    for (const b of bookings.slice(0, 12 - existingReviews)) {
      const createdAt = backdateWithinLastMonths(rand, 11);
      await Review.updateOne(
        { booking: new mongoose.Types.ObjectId(b._id) },
        {
          $setOnInsert: {
            booking: new mongoose.Types.ObjectId(b._id),
            rating: pick(rand, [3, 4, 5]),
            comment: pick(rand, ['Rất ổn.', 'Vui vẻ, đúng giờ.', 'Nói chuyện dễ chịu.', 'Sẽ đặt lại.']),
            hidden: false,
            createdAt,
          },
        },
        { upsert: true }
      );
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
    await seedBookings(rand, companionRows, customerRows, bookingCount);
    await seedAdminEvents(rand, { companions: companionRows, customers: customerRows });

    console.log('Seed OK (realistic).');
    console.log(`Tạo thêm ${companionRows.length} companion, ${customerRows.length} customer, bookings ~${bookingCount}.`);
  }

  console.log('Tài khoản seed (password mặc định):', DEFAULT_PASSWORD);
  console.log('- ADMIN:', base.admin.username);
  console.log('- CUSTOMER:', base.customer.username);
  console.log('- COMPANION:', base.companionUser.username);
  console.log('Companion docId:', base.companion._id.toString());
}

await withDb(run);

