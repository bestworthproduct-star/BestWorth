const User = require('../models/User');
const { serializeUser } = require('../utils/permissions');
const { getRequestToken, verifyAuthToken, clearSessionCookie } = require('../utils/auth-token');

module.exports = async (req, res, next) => {
  const token = getRequestToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = verifyAuthToken(token);
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'This account no longer exists.', code: 'ACCOUNT_NOT_FOUND' });
    }
    if (currentUser.active === false) {
      clearSessionCookie(res);
      return res.status(403).json({ message: 'This account has been disabled.', code: 'ACCOUNT_DISABLED' });
    }
    if (Number(decoded.sv || 0) !== Number(currentUser.sessionVersion || 0)) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.', code: 'SESSION_REVOKED' });
    }

    req.authUser = currentUser;
    req.user = serializeUser(currentUser);
    next();
  } catch (err) {
    clearSessionCookie(res);
    res.status(401).json({ message: 'Invalid or expired session.', code: 'INVALID_TOKEN' });
  }
};
