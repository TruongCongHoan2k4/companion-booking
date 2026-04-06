import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'accessToken';

export const verifyToken = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer =
      header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const token = req.cookies?.[COOKIE_NAME] || bearer;

    if (!token) {
      return res.status(401).json({ message: 'Chưa đăng nhập hoặc thiếu token.' });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Cấu hình JWT chưa đầy đủ.' });
    }

    const decoded = jwt.verify(token, secret);
    const sub = decoded.sub || decoded.userId || decoded.id;
    if (!sub) {
      return res.status(401).json({ message: 'Token không hợp lệ.' });
    }

    req.auth = {
      userId: String(sub),
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token không hợp lệ.' });
    }
    return res.status(401).json({ message: 'Xác thực thất bại.' });
  }
};

/**
 * Gắn req.auth nếu có Bearer/cookie hợp lệ; không có token vẫn cho qua (cho API công khai).
 * Token hết hạn / sai → 401.
 */
export const optionalVerifyToken = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer =
      header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const token = req.cookies?.[COOKIE_NAME] || bearer;

    if (!token) {
      return next();
    }

    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Cấu hình JWT chưa đầy đủ.' });
    }

    const decoded = jwt.verify(token, secret);
    const sub = decoded.sub || decoded.userId || decoded.id;
    if (!sub) {
      return res.status(401).json({ message: 'Token không hợp lệ.' });
    }

    req.auth = {
      userId: String(sub),
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token không hợp lệ.' });
    }
    return res.status(401).json({ message: 'Xác thực thất bại.' });
  }
};
