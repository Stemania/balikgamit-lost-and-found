// Small helpers shared by routes that need the database.
const mongoose = require('mongoose');

const dbReady = () => mongoose.connection.readyState === 1;

const dbUnavailable = (res) =>
  res.status(503).json({ error: 'Database is not connected yet. Please try again in a moment.' });

module.exports = { dbReady, dbUnavailable };
