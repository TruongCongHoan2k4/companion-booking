import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/user.model.js';
import Companion from '../src/models/companion.model.js';
import Booking from '../src/models/booking.model.js';
import WalletTransaction from '../src/models/walletTransaction.model.js';
import Transaction from '../src/models/transaction.model.js';
import Report from '../src/models/report.model.js';
import Notification from '../src/models/notification.model.js';
import ChatMessage from '../src/models/chatMessage.model.js';
import Category from '../src/models/category.model.js';
import Favorite from '../src/models/favorite.model.js';
import Consultation from '../src/models/consultation.model.js';
import CompanionAvailability from '../src/models/companionAvailability.model.js';
import ServicePrice from '../src/models/servicePrice.model.js';
import Withdrawal from '../src/models/withdrawal.model.js';
import PlatformSettings from '../src/models/platformSettings.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PASSWORD = '123456';
const SALT_ROUNDS = 12;

const d128 = (n) => mongoose.Types.Decimal128.fromString(String(Math.trunc(Number(n))));
const money = (n) => Number(n).toLocaleString('vi-VN');

function monthsAgo(count) {
  const d = new Date();
  d.setMonth(d.getMonth() - count);
  return d;
}

async function upsertUser({ username, email, fullName, role, phoneNumber, passwordHash, balance }) {
  return User.findOneAndUpdate(
    { username },
    {
      $set: {
        email: String(email).toLowerCase(),
        fullName,
        role,
        phoneNumber,
        password: passwordHash,
        locked: false,
        moderationFlag: 'NONE',
        balance: d128(balance ?? 0),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Thiếu MONGO_URI trong backend/.env');
  }

  await mongoose.connect(uri);
  const hashed = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  const admin = await upsertUser({
    username: 'seed_admin',
    email: 'seed_admin@seed.local',
    fullName: 'Admin Vận Hành',
    role: 'ADMIN',
    phoneNumber: '0900000001',
    passwordHash: hashed,
    balance: 0,
  });

  const customers = await Promise.all([
    upsertUser({
      username: 'seed_customer_anh',
      email: 'seed_customer_anh@seed.local',
      fullName: 'Nguyen Minh Anh',
      role: 'CUSTOMER',
      phoneNumber: '0901234567',
      passwordHash: hashed,
      balance: 5200000,
    }),
    upsertUser({
      username: 'seed_customer_linh',
      email: 'seed_customer_linh@seed.local',
      fullName: 'Tran Bao Linh',
      role: 'CUSTOMER',
      phoneNumber: '0912233445',
      passwordHash: hashed,
      balance: 2100000,
    }),
    upsertUser({
      username: 'seed_customer_huy',
      email: 'seed_customer_huy@seed.local',
      fullName: 'Le Quang Huy',
      role: 'CUSTOMER',
      phoneNumber: '0933344556',
      passwordHash: hashed,
      balance: 980000,
    }),
  ]);

  const companionUsers = await Promise.all([
    upsertUser({
      username: 'seed_companion_trang',
      email: 'seed_companion_trang@seed.local',
      fullName: 'Do Phuong Trang',
      role: 'COMPANION',
      phoneNumber: '0977111222',
      passwordHash: hashed,
      balance: 1300000,
    }),
    upsertUser({
      username: 'seed_companion_kiet',
      email: 'seed_companion_kiet@seed.local',
      fullName: 'Pham Quoc Kiet',
      role: 'COMPANION',
      phoneNumber: '0988222333',
      passwordHash: hashed,
      balance: 550000,
    }),
    upsertUser({
      username: 'seed_companion_hana',
      email: 'seed_companion_hana@seed.local',
      fullName: 'Vo Ngoc Hana',
      role: 'COMPANION',
      phoneNumber: '0966333444',
      passwordHash: hashed,
      balance: 300000,
    }),
  ]);

  const companionProfilesInput = [
    {
      user: companionUsers[0],
      status: 'APPROVED',
      area: 'TP. Ho Chi Minh',
      serviceType: 'Cafe & tro chuyen',
      rentalVenues: 'Thu Duc, Quan 1, Quan 3',
      bio: 'Than thien, noi chuyen de chiu, phu hop gap mat cuoi tuan.',
      hobbies: 'Doc sach, coffee hopping, board game',
      appearance: 'Nang dong, lich su',
      availability: 'Toi T2-T6, full T7-CN',
      gender: 'Nu',
      gameRank: 'Valorant Gold',
      pricePerHour: 320000,
      avatarUrl: 'https://picsum.photos/seed/companion-trang/400/400',
      introVideoUrl: 'https://example.com/videos/intro-trang.mp4',
      skills: 'Giao tiep, Ho tro su kien, Board game',
      payoutBankName: 'Vietcombank',
      payoutBankAccountNumber: '001100223344',
      payoutAccountHolderName: 'DO PHUONG TRANG',
    },
    {
      user: companionUsers[1],
      status: 'APPROVED',
      area: 'Ha Noi',
      serviceType: 'An uong & city tour',
      rentalVenues: 'Ba Dinh, Hoan Kiem, Tay Ho',
      bio: 'Ranh duong pho, huong dan dia diem an uong theo ngan sach.',
      hobbies: 'Food tour, photography, running',
      appearance: 'Don gian, than thien',
      availability: 'Sau 18h moi ngay',
      gender: 'Nam',
      gameRank: 'LMHT Emerald',
      pricePerHour: 280000,
      avatarUrl: 'https://picsum.photos/seed/companion-kiet/400/400',
      introVideoUrl: 'https://example.com/videos/intro-kiet.mp4',
      skills: 'Food guide, Photography spots, Ice-breaking',
      payoutBankName: 'Techcombank',
      payoutBankAccountNumber: '19001234567890',
      payoutAccountHolderName: 'PHAM QUOC KIET',
    },
    {
      user: companionUsers[2],
      status: 'PENDING',
      area: 'Da Nang',
      serviceType: 'Su kien nho',
      rentalVenues: 'Hai Chau, Son Tra',
      bio: 'Dang cho duyet, ho tro tiep khach su kien nho.',
      hobbies: 'MC workshop, am nhac',
      appearance: 'Chuyen nghiep',
      availability: 'Cuoi tuan',
      gender: 'Nu',
      gameRank: 'N/A',
      pricePerHour: 350000,
      avatarUrl: 'https://picsum.photos/seed/companion-hana/400/400',
      introVideoUrl: 'https://example.com/videos/intro-hana.mp4',
      skills: 'MC co ban, ho tro tiep tan',
      payoutBankName: 'BIDV',
      payoutBankAccountNumber: '115544332211',
      payoutAccountHolderName: 'VO NGOC HANA',
    },
  ];

  const companions = [];
  for (const item of companionProfilesInput) {
    const doc = await Companion.findOneAndUpdate(
      { user: item.user._id },
      {
        $set: {
          bio: item.bio,
          hobbies: item.hobbies,
          appearance: item.appearance,
          availability: item.availability,
          serviceType: item.serviceType,
          area: item.area,
          rentalVenues: item.rentalVenues,
          gender: item.gender,
          gameRank: item.gameRank,
          onlineStatus: false,
          pricePerHour: d128(item.pricePerHour),
          avatarUrl: item.avatarUrl,
          introVideoUrl: item.introVideoUrl,
          skills: item.skills,
          payoutBankName: item.payoutBankName,
          payoutBankAccountNumber: item.payoutBankAccountNumber,
          payoutAccountHolderName: item.payoutAccountHolderName,
          status: item.status,
        },
        $setOnInsert: { user: item.user._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    companions.push(doc);
  }

  const seedUserIds = [admin._id, ...customers.map((u) => u._id), ...companionUsers.map((u) => u._id)];
  const seedCompanionIds = companions.map((c) => c._id);

  await Promise.all([
    Booking.deleteMany({ $or: [{ customer: { $in: seedUserIds } }, { companion: { $in: seedCompanionIds } }] }),
    WalletTransaction.deleteMany({ user: { $in: seedUserIds } }),
    Report.deleteMany({ $or: [{ reporter: { $in: seedUserIds } }, { reportedUser: { $in: seedUserIds } }] }),
    Notification.deleteMany({ user: { $in: seedUserIds } }),
    ChatMessage.deleteMany({ sender: { $in: seedUserIds } }),
    Favorite.deleteMany({ $or: [{ customer: { $in: seedUserIds } }, { companion: { $in: seedCompanionIds } }] }),
    Consultation.deleteMany({ $or: [{ customer: { $in: seedUserIds } }, { companion: { $in: seedCompanionIds } }] }),
    CompanionAvailability.deleteMany({ companion: { $in: seedCompanionIds } }),
    ServicePrice.deleteMany({ companion: { $in: seedCompanionIds } }),
    Withdrawal.deleteMany({ companion: { $in: seedCompanionIds } }),
  ]);
  await Transaction.deleteMany({});

  await Category.deleteMany({ type: { $in: ['SERVICE', 'REPORT_REASON'] }, name: /^Seed:/i });
  await Category.insertMany([
    { name: 'Seed: Cafe tro chuyen', type: 'SERVICE' },
    { name: 'Seed: Food tour', type: 'SERVICE' },
    { name: 'Seed: Ho tro su kien', type: 'SERVICE' },
    { name: 'Seed: Den tre', type: 'REPORT_REASON' },
    { name: 'Seed: Thai do khong phu hop', type: 'REPORT_REASON' },
  ]);

  await PlatformSettings.findOneAndUpdate({}, { $set: { commissionRate: 0.15 } }, { upsert: true, new: true });

  const [companionTrang, companionKiet, companionHana] = companions;
  const [customerAnh, customerLinh, customerHuy] = customers;

  await ServicePrice.insertMany([
    {
      companion: companionTrang._id,
      serviceName: 'Coffee companion',
      pricePerHour: d128(320000),
      description: 'Gap mat cafe, tro chuyen, di dao nhe.',
    },
    {
      companion: companionTrang._id,
      serviceName: 'Board game buddy',
      pricePerHour: d128(360000),
      description: 'Choi board game nhe tai quan cafe.',
    },
    {
      companion: companionKiet._id,
      serviceName: 'Food tour toi',
      pricePerHour: d128(280000),
      description: 'Dan di an theo khu vuc noi thanh.',
    },
  ]);

  await CompanionAvailability.insertMany([
    {
      companion: companionTrang._id,
      startTime: new Date(new Date().setHours(18, 0, 0, 0)),
      endTime: new Date(new Date().setHours(22, 0, 0, 0)),
      note: 'Toi thuong ngay',
    },
    {
      companion: companionKiet._id,
      startTime: new Date(new Date().setHours(19, 0, 0, 0)),
      endTime: new Date(new Date().setHours(23, 0, 0, 0)),
      note: 'Sau gio hanh chinh',
    },
  ]);

  const bookingRows = await Booking.insertMany([
    {
      customer: customerAnh._id,
      companion: companionTrang._id,
      bookingTime: monthsAgo(2),
      duration: 120,
      location: 'Quan 1, TP.HCM',
      rentalVenue: 'The Coffee House Pasteur',
      serviceName: 'Coffee companion',
      servicePricePerHour: d128(320000),
      holdAmount: d128(640000),
      status: 'COMPLETED',
      acceptedAt: monthsAgo(2),
      startedAt: monthsAgo(2),
      completedAt: monthsAgo(2),
      note: 'Gap trao doi du an freelance',
    },
    {
      customer: customerLinh._id,
      companion: companionTrang._id,
      bookingTime: monthsAgo(1),
      duration: 90,
      location: 'Thu Duc, TP.HCM',
      rentalVenue: 'Highlands Vincom',
      serviceName: 'Board game buddy',
      servicePricePerHour: d128(360000),
      holdAmount: d128(540000),
      status: 'ACCEPTED',
      acceptedAt: monthsAgo(1),
      note: 'Hen choi Catan',
    },
    {
      customer: customerHuy._id,
      companion: companionKiet._id,
      bookingTime: new Date(Date.now() + 1000 * 60 * 60 * 24),
      duration: 60,
      location: 'Hoan Kiem, Ha Noi',
      rentalVenue: 'Pho co',
      serviceName: 'Food tour toi',
      servicePricePerHour: d128(280000),
      holdAmount: d128(280000),
      status: 'PENDING',
      note: 'Muon tham khao quan an dem',
    },
    {
      customer: customerAnh._id,
      companion: companionKiet._id,
      bookingTime: monthsAgo(0),
      duration: 60,
      location: 'Tay Ho, Ha Noi',
      rentalVenue: 'Quan an nho',
      serviceName: 'Food tour toi',
      servicePricePerHour: d128(280000),
      holdAmount: d128(280000),
      status: 'REJECTED',
      note: 'Khach doi lich sat gio',
    },
    {
      customer: customerLinh._id,
      companion: companionTrang._id,
      bookingTime: new Date(),
      duration: 120,
      location: 'Quan 3, TP.HCM',
      rentalVenue: 'Cong caphe',
      serviceName: 'Coffee companion',
      servicePricePerHour: d128(320000),
      holdAmount: d128(640000),
      status: 'IN_PROGRESS',
      acceptedAt: new Date(),
      startedAt: new Date(),
      note: 'Dang dien ra',
    },
    {
      customer: customerHuy._id,
      companion: companionTrang._id,
      bookingTime: monthsAgo(3),
      duration: 90,
      location: 'Binh Thanh, TP.HCM',
      rentalVenue: 'Coffee shop',
      serviceName: 'Coffee companion',
      servicePricePerHour: d128(320000),
      holdAmount: d128(480000),
      status: 'CANCELLED',
      note: 'Khach huy vi ban',
    },
  ]);

  const [bookingCompleted, bookingAccepted, bookingPending, bookingRejected, bookingInProgress] = bookingRows;

  await WalletTransaction.insertMany([
    {
      user: customerAnh._id,
      amount: d128(3000000),
      type: 'DEPOSIT',
      provider: 'MOCK',
      description: 'Nap lan dau',
      createdAt: monthsAgo(4),
    },
    {
      user: customerLinh._id,
      amount: d128(2500000),
      type: 'DEPOSIT',
      provider: 'MOCK',
      description: 'Nap qua vi dien tu',
      createdAt: monthsAgo(2),
    },
    {
      user: customerHuy._id,
      amount: d128(1000000),
      type: 'DEPOSIT',
      provider: 'MOCK',
      description: 'Nap de dat lich',
      createdAt: monthsAgo(1),
    },
    {
      user: customerAnh._id,
      booking: bookingCompleted._id,
      amount: d128(640000),
      type: 'HOLD',
      description: 'Giu coc booking completed',
      createdAt: monthsAgo(2),
    },
    {
      user: customerAnh._id,
      booking: bookingRejected._id,
      amount: d128(280000),
      type: 'HOLD',
      description: 'Giu coc booking bi tu choi',
      createdAt: monthsAgo(0),
    },
    {
      user: customerAnh._id,
      booking: bookingRejected._id,
      amount: d128(280000),
      type: 'REFUND',
      description: 'Hoan coc do companion tu choi',
      createdAt: monthsAgo(0),
    },
    {
      user: customerLinh._id,
      booking: bookingAccepted._id,
      amount: d128(540000),
      type: 'HOLD',
      description: 'Giu coc booking accepted',
      createdAt: monthsAgo(1),
    },
    {
      user: customerLinh._id,
      booking: bookingInProgress._id,
      amount: d128(640000),
      type: 'HOLD',
      description: 'Giu coc booking dang dien ra',
      createdAt: new Date(),
    },
    {
      user: companionUsers[0]._id,
      booking: bookingCompleted._id,
      amount: d128(544000),
      type: 'CHARGE',
      description: 'Thanh toan cho companion Trang sau khi tru phi nen tang',
      createdAt: monthsAgo(2),
    },
  ]);

  await Transaction.insertMany([
    {
      booking: bookingCompleted._id,
      amount: d128(640000),
      status: 'COMPLETED',
      createdAt: monthsAgo(2),
    },
    {
      booking: bookingInProgress._id,
      amount: d128(640000),
      status: 'PENDING',
      createdAt: new Date(),
    },
  ]);

  await Favorite.insertMany([
    { customer: customerAnh._id, companion: companionTrang._id },
    { customer: customerLinh._id, companion: companionKiet._id },
    { customer: customerHuy._id, companion: companionTrang._id },
  ]);

  await Consultation.insertMany([
    {
      customer: customerAnh._id,
      companion: companionTrang._id,
      question: 'Minh can companion cho buoi networking 2 tieng, ban co kinh nghiem khong?',
      answer: 'Co, minh da ho tro nhieu buoi networking nho va workshop.',
      status: 'ANSWERED',
      createdAt: monthsAgo(1),
      answeredAt: monthsAgo(1),
    },
    {
      customer: customerHuy._id,
      companion: companionKiet._id,
      question: 'Ban co the di food tour sau 20h khong?',
      status: 'PENDING',
      createdAt: new Date(),
      answeredAt: null,
    },
  ]);

  await Report.insertMany([
    {
      reporter: customerLinh._id,
      reportedUser: companionUsers[0]._id,
      reason: 'Companion den tre hon 20 phut so voi gio hen.',
      category: 'Seed: Den tre',
      emergency: false,
      relatedBookingId: bookingAccepted._id,
      reporterLatitude: 10.776,
      reporterLongitude: 106.700,
      status: 'PENDING',
      lastActionAt: new Date(),
      createdAt: new Date(),
    },
    {
      reporter: customerAnh._id,
      reportedUser: companionUsers[1]._id,
      reason: 'Trai nghiem khong dung nhu mo ta trong profile.',
      category: 'Seed: Thai do khong phu hop',
      emergency: false,
      relatedBookingId: bookingRejected._id,
      status: 'RESOLVED',
      resolutionAction: 'REFUND',
      resolutionNote: 'Da xac minh va thuc hien hoan coc.',
      resolvedBy: admin._id,
      resolvedAt: new Date(),
      lastActionAt: new Date(),
      createdAt: monthsAgo(0),
    },
  ]);

  await Notification.insertMany([
    {
      user: customerAnh._id,
      title: 'Dat lich hoan tat',
      content: 'Booking voi companion Trang da duoc hoan tat.',
      isRead: true,
    },
    {
      user: customerLinh._id,
      title: 'Cap nhat tranh chap',
      content: 'Yeu cau tranh chap dang duoc admin xem xet.',
      isRead: false,
    },
    {
      user: companionUsers[0]._id,
      title: 'Co don dat lich moi',
      content: 'Ban vua nhan mot booking moi cho toi nay.',
      isRead: false,
    },
  ]);

  await ChatMessage.insertMany([
    {
      booking: bookingInProgress._id,
      sender: customerLinh._id,
      content: 'Em den quan roi nhe, ban ngoi khu trong nha hay ngoai troi?',
    },
    {
      booking: bookingInProgress._id,
      sender: companionUsers[0]._id,
      content: 'Minh ngoi trong nha gan cua so, ban vao la thay ngay.',
    },
    {
      booking: bookingInProgress._id,
      sender: customerLinh._id,
      content: 'Ok minh thay roi, cam on ban.',
    },
  ]);

  await Withdrawal.insertMany([
    {
      companion: companionTrang._id,
      amount: d128(500000),
      bankName: 'Vietcombank',
      bankAccountNumber: '001100223344',
      accountHolderName: 'DO PHUONG TRANG',
      status: 'PENDING',
    },
    {
      companion: companionKiet._id,
      amount: d128(350000),
      bankName: 'Techcombank',
      bankAccountNumber: '19001234567890',
      accountHolderName: 'PHAM QUOC KIET',
      status: 'REJECTED',
    },
  ]);

  console.log('Seed realistic xong.');
  console.log('');
  console.log('Tai khoan dang nhap (mat khau chung: 123456):');
  console.log(' - ADMIN:      seed_admin');
  console.log(' - CUSTOMER:   seed_customer_anh, seed_customer_linh, seed_customer_huy');
  console.log(' - COMPANION:  seed_companion_trang, seed_companion_kiet, seed_companion_hana');
  console.log('');
  console.log(`Tong quan: ${customers.length} customers, ${companions.length} companions, ${bookingRows.length} bookings.`);
  console.log(`Vi du wallet: DEPOSIT 3, HOLD 4, REFUND 1, CHARGE 1.`);
  console.log(`Muc nap mau: ${money(3000000)} VND, ${money(2500000)} VND, ${money(1000000)} VND.`);
}

main()
  .catch((err) => {
    console.error('[seed:real] Loi:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
