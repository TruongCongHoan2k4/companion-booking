export const requireCustomer = (req, res, next) => {
  if (req.auth?.role !== 'CUSTOMER') {
    return res.status(403).json({ message: 'Chỉ khách hàng mới thực hiện được thao tác này.' });
  }
  next();
};
