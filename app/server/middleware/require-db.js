const { getDatabaseStatus } = require('../utils/db-state');

module.exports = (req, res, next) => {
  const databaseStatus = getDatabaseStatus();

  if (!databaseStatus.available) {
    return res.status(503).json({
      message: 'Database unavailable',
      code: 'DB_UNAVAILABLE',
      lastError: databaseStatus.lastError
    });
  }

  next();
};
