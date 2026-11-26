// Express application: static web page + JSON API.
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const itemsRouter = require('./routes/items');
const { TYPES, STATUSES, CATEGORIES, LOCATIONS } = require('./models/Item');

const app = express();

app.use(express.json({ limit: '10kb' })); // parse JSON bodies, reject huge payloads
app.use(express.static(path.join(__dirname, '..', 'public'))); // the web page

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// Health check - handy for Render and for checking the database link.
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    database: DB_STATES[mongoose.connection.readyState] || 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Dropdown options for the web page (single source of truth with the model).
app.get('/api/options', (_req, res) => {
  res.status(200).json({ types: TYPES, statuses: STATUSES, categories: CATEGORIES, locations: LOCATIONS });
});

app.use('/api/items', itemsRouter);

// Unknown API route -> 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` });
});

// Error handler - always answer with JSON and a correct status code.
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: 'Validation failed.', details: Object.values(err.errors).map((e) => e.message) });
  }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
});

module.exports = app;
