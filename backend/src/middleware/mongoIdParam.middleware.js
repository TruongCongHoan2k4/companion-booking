import mongoose from 'mongoose';

export const validateMongoIdParam = (paramName = 'id') => (req, res, next) => {
  const v = req.params[paramName];
  if (!v || !mongoose.Types.ObjectId.isValid(v)) {
    return res.status(400).json({ message: 'ID không hợp lệ.' });
  }
  next();
};
