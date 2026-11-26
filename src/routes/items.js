// REST API routes for /api/items
//   GET   /api/items              -> 200 list (optional filters: ?type=&category=&status=)
//   POST  /api/items              -> 201 created | 400 validation errors
//   PATCH /api/items/:id/claim    -> 200 claimed | 400 bad id | 404 not found | 409 already claimed
const express = require('express');
const mongoose = require('mongoose');
const { Item, TYPES, STATUSES, CATEGORIES } = require('../models/Item');
const { validateItem, matchOption } = require('../validateItem');

const router = express.Router();

const dbReady = () => mongoose.connection.readyState === 1;
const dbUnavailable = (res) =>
  res.status(503).json({ error: 'Database is not connected yet. Please try again in a moment.' });

// GET /api/items - read posts from the cloud database
router.get('/', async (req, res) => {
  const filter = {};
  const errors = [];
  const filters = { type: TYPES, category: CATEGORIES, status: STATUSES };

  for (const [field, allowed] of Object.entries(filters)) {
    const raw = req.query[field];
    if (raw === undefined || raw === '') continue;
    const value = matchOption(raw, allowed);
    if (!value) errors.push(`${field} filter must be one of: ${allowed.join(', ')}.`);
    else filter[field] = value;
  }

  if (errors.length) return res.status(400).json({ error: 'Invalid filter.', details: errors });
  if (!dbReady()) return dbUnavailable(res);

  const items = await Item.find(filter).sort({ createdAt: -1 }).limit(200);
  return res.status(200).json({ count: items.length, items });
});

// POST /api/items - accept a JSON payload and store it
router.post('/', async (req, res) => {
  const { errors, data } = validateItem(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  if (!dbReady()) return dbUnavailable(res);

  const item = await Item.create(data); // status defaults to "Open"
  return res.status(201).location(`/api/items/${item.id}`).json({ message: 'Item posted.', item });
});

// PATCH /api/items/:id/claim - mark an item as returned to its owner
router.patch('/:id/claim', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ error: 'Invalid item id.' });
  if (!dbReady()) return dbUnavailable(res);

  const item = await Item.findById(id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.status === 'Claimed') return res.status(409).json({ error: 'Item is already marked as claimed.', item });

  item.status = 'Claimed';
  item.claimedAt = new Date();
  await item.save();
  return res.status(200).json({ message: 'Item marked as claimed.', item });
});

module.exports = router;
