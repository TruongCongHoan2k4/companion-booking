import User from '../models/user.model.js';

export const getAll = async () => {
  return await User.find();
};

export const create = async (data) => {
  const user = new User(data);
  return await user.save();
};
