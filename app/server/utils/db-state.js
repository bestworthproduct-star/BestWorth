let databaseAvailable = false;
let lastDatabaseError = null;

function setDatabaseAvailable(value) {
  databaseAvailable = Boolean(value);
  if (databaseAvailable) {
    lastDatabaseError = null;
  }
}

function setLastDatabaseError(error) {
  lastDatabaseError = error ? String(error.message || error) : null;
}

function getDatabaseStatus() {
  return {
    available: databaseAvailable,
    lastError: lastDatabaseError
  };
}

module.exports = {
  setDatabaseAvailable,
  setLastDatabaseError,
  getDatabaseStatus
};
