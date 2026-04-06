import Favorite from '../models/favorite.model.js';
import Companion from '../models/companion.model.js';

export async function addFavorite(customerUserId, companionId) {
  const companion = await Companion.findById(companionId).populate('user', 'username fullName').lean();
  if (!companion) {
    const err = new Error('Không tìm thấy companion.');
    err.status = 404;
    throw err;
  }
  await Favorite.updateOne(
    { customer: customerUserId, companion: companionId },
    { $setOnInsert: { customer: customerUserId, companion: companionId } },
    { upsert: true }
  );
  return {
    id: `${String(customerUserId)}:${String(companionId)}`,
    companion: {
      id: String(companion._id),
      bio: companion.bio || '',
      user: companion.user
        ? {
            id: String(companion.user._id),
            username: companion.user.username,
            fullName: companion.user.fullName,
          }
        : undefined,
    },
    createdAt: new Date(),
  };
}

export async function removeFavorite(customerUserId, companionId) {
  await Favorite.deleteOne({ customer: customerUserId, companion: companionId });
}

export async function listFavoritesForCustomer(customerUserId) {
  const rows = await Favorite.find({ customer: customerUserId })
    .populate({
      path: 'companion',
      populate: { path: 'user', select: 'username fullName' },
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return rows.map((f) => ({
    id: String(f._id),
    companion: f.companion
      ? {
          id: String(f.companion._id),
          bio: f.companion.bio || '',
          user: f.companion.user
            ? {
                id: String(f.companion.user._id),
                username: f.companion.user.username,
                fullName: f.companion.user.fullName,
              }
            : undefined,
        }
      : undefined,
    createdAt: f.createdAt,
  }));
}

