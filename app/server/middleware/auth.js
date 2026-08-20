const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { serializeUser } = require('../utils/permissions');

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({ message: 'This account no longer exists.', code: 'ACCOUNT_NOT_FOUND' });
    }
    if (currentUser.active === false) {
      return res.status(403).json({ message: 'This account has been disabled.', code: 'ACCOUNT_DISABLED' });
    }

    req.authUser = currentUser;
    req.user = serializeUser(currentUser);
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token.', code: 'INVALID_TOKEN' });
  }
};
