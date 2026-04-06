import mongoose from 'mongoose';
import Companion from '../models/companion.model.js';
import User from '../models/user.model.js';
import ServicePrice from '../models/servicePrice.model.js';
import Review from '../models/review.model.js';

function decToNumber(d) {
  if (d == null) return 0;
  const str = typeof d === 'object' && typeof d.toString === 'function' ? d.toString() : String(d);
  return Math.round(Number(str) || 0);
}

async function loadRatingByCompanionId() {
  const rows = await Review.aggregate([
    { $match: { hidden: { $ne: true } } },
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'bk',
      },
    },
    { $unwind: '$bk' },
    {
      $group: {
        _id: '$bk.companion',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);
  const map = {};
  for (const r of rows) {
    map[String(r._id)] = {
      averageRating: r.averageRating != null ? Math.round(r.averageRating * 10) / 10 : null,
      reviewCount: r.reviewCount || 0,
    };
  }
  return map;
}

async function loadPriceRangeByCompanionId(companionIds) {
  if (!companionIds.length) return {};
  const oids = companionIds.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await ServicePrice.aggregate([
    { $match: { companion: { $in: oids } } },
    {
      $group: {
        _id: '$companion',
        min: { $min: '$pricePerHour' },
        max: { $max: '$pricePerHour' },
      },
    },
  ]);
  const map = {};
  for (const r of rows) {
    map[String(r._id)] = {
      min: decToNumber(r.min),
      max: decToNumber(r.max),
    };
  }
  return map;
}

function toPublicCompanionJson(doc, extras = {}) {
  const c = doc.toObject ? doc.toObject() : { ...doc };
  const o = {
    id: String(c._id),
    bio: c.bio,
    hobbies: c.hobbies,
    appearance: c.appearance,
    availability: c.availability,
    serviceType: c.serviceType,
    area: c.area,
    rentalVenues: c.rentalVenues,
    gender: c.gender,
    gameRank: c.gameRank,
    onlineStatus: c.onlineStatus,
    status: c.status,
    pricePerHour: c.pricePerHour != null && c.pricePerHour.toString ? c.pricePerHour.toString() : c.pricePerHour,
    avatarUrl: c.avatarUrl,
    portraitImageUrl: c.portraitImageUrl,
    introVideoUrl: c.introVideoUrl,
    introMediaUrls: c.introMediaUrls,
    skills: c.skills,
    user: c.user
      ? {
          id: String(c.user._id || c.user.id),
          username: c.user.username,
          fullName: c.user.fullName,
        }
      : undefined,
    responseRate: 0,
    averageRating: extras.averageRating ?? null,
    reviewCount: extras.reviewCount ?? 0,
    servicePriceMin: extras.servicePriceMin ?? null,
    servicePriceMax: extras.servicePriceMax ?? null,
  };
  return o;
}

const APPROVED_FILTER = { status: 'APPROVED' };

export async function listApprovedCompanions() {
  const list = await Companion.find(APPROVED_FILTER)
    .populate('user', 'username fullName')
    .sort({ updatedAt: -1 })
    .lean();

  const ids = list.map((c) => String(c._id));
  const [ratingMap, priceMap] = await Promise.all([loadRatingByCompanionId(), loadPriceRangeByCompanionId(ids)]);

  return list.map((c) => {
    const id = String(c._id);
    const r = ratingMap[id] || {};
    const p = priceMap[id] || {};
    const base = decToNumber(c.pricePerHour);
    const minP = p.min > 0 ? p.min : base;
    const maxP = p.max > 0 ? p.max : base;
    return toPublicCompanionJson(c, {
      averageRating: r.averageRating,
      reviewCount: r.reviewCount,
      servicePriceMin: minP || null,
      servicePriceMax: maxP || null,
    });
  });
}

export async function searchApprovedCompanions(query) {
  const all = await listApprovedCompanions();
  const serviceType = query.serviceType && String(query.serviceType).trim();
  const area = query.area && String(query.area).trim();
  const gender = query.gender && String(query.gender).trim();
  const minPrice = query.minPrice != null && query.minPrice !== '' ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice != null && query.maxPrice !== '' ? Number(query.maxPrice) : null;
  const onlineOnly = query.online === '1' || query.online === 'true';

  return all.filter((c) => {
    if (onlineOnly && !c.onlineStatus) return false;
    if (serviceType && !(c.serviceType || '').toLowerCase().includes(serviceType.toLowerCase())) return false;
    if (area && !(c.area || '').toLowerCase().includes(area.toLowerCase())) return false;
    if (gender && (c.gender || '') !== gender) return false;
    const min = Number(c.servicePriceMin ?? c.pricePerHour ?? 0);
    const max = Number(c.servicePriceMax ?? c.pricePerHour ?? 0);
    if (minPrice != null && !Number.isNaN(minPrice) && max < minPrice) return false;
    if (maxPrice != null && !Number.isNaN(maxPrice) && min > maxPrice) return false;
    return true;
  });
}

export async function getApprovedCompanionById(companionId) {
  if (!mongoose.Types.ObjectId.isValid(companionId)) {
    const err = new Error('ID companion không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const c = await Companion.findOne({ _id: companionId, ...APPROVED_FILTER })
    .populate('user', 'username fullName')
    .lean();
  if (!c) {
    const err = new Error('Không tìm thấy companion.');
    err.status = 404;
    throw err;
  }
  const id = String(c._id);
  const [ratingMap, priceMap] = await Promise.all([
    loadRatingByCompanionId(),
    loadPriceRangeByCompanionId([id]),
  ]);
  const r = ratingMap[id] || {};
  const p = priceMap[id] || {};
  const base = decToNumber(c.pricePerHour);
  const minP = p.min > 0 ? p.min : base;
  const maxP = p.max > 0 ? p.max : base;
  return toPublicCompanionJson(c, {
    averageRating: r.averageRating,
    reviewCount: r.reviewCount,
    servicePriceMin: minP || null,
    servicePriceMax: maxP || null,
  });
}

export async function listPublicServicePrices(companionId) {
  if (!mongoose.Types.ObjectId.isValid(companionId)) {
    const err = new Error('ID companion không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const ok = await Companion.exists({ _id: companionId, ...APPROVED_FILTER });
  if (!ok) {
    const err = new Error('Không tìm thấy companion.');
    err.status = 404;
    throw err;
  }
  const rows = await ServicePrice.find({ companion: companionId }).sort({ createdAt: -1 }).lean();
  return rows.map((row) => ({
    id: String(row._id),
    serviceName: row.serviceName,
    pricePerHour: decToNumber(row.pricePerHour),
    description: row.description,
  }));
}

export async function registerCompanionApplication(userId, body) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('Không tìm thấy người dùng.');
    err.status = 404;
    throw err;
  }
  // Chỉ cho phép user CUSTOMER nộp hồ sơ. Việc "trở thành companion" chỉ xảy ra sau khi admin duyệt.
  if (user.role !== 'CUSTOMER') {
    const err = new Error('Chỉ tài khoản khách hàng mới đăng ký companion tại đây.');
    err.status = 403;
    throw err;
  }

  let companion = await Companion.findOne({ user: userId });
  const fields = {
    bio: body.bio != null ? String(body.bio).trim() : undefined,
    hobbies: body.hobbies != null ? String(body.hobbies).trim() : undefined,
    appearance: body.appearance != null ? String(body.appearance).trim() : undefined,
    availability: body.availability != null ? String(body.availability).trim() : undefined,
  };

  if (companion) {
    Object.assign(companion, fields);
    companion.status = 'PENDING';
    await companion.save();
  } else {
    companion = await Companion.create({
      user: userId,
      ...fields,
      status: 'PENDING',
    });
  }

  return { companionId: String(companion._id), status: companion.status };
}
