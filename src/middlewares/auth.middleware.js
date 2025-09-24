import AppError from '../utils/appError.js';
import { verifyToken } from '../utils/jwt.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded; // decoded -> userId
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token', 403));
  }
};

export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    if (!roles.includes(req.user.role)) {
      console.log(req.user);
      
      return res.status(403).json({ error: "Forbidden: insufficient rights" });
    }
    next();
  };
};
