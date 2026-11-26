// GET /api/stats - dashboard numbers computed by MongoDB (aggregation pipeline).
const express = require('express');
const { Item } = require('../models/Item');
const { dbReady, dbUnavailable } = require('../db');

const router = express.Router();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

router.get('/', async (_req, res) => {
  if (!dbReady()) return dbUnavailable(res);

  const weekAgo = new Date(Date.now() - WEEK_MS);
  const [facets] = await Item.aggregate([
    {
      $facet: {
        byStatusType: [{ $group: { _id: { status: '$status', type: '$type' }, count: { $sum: 1 } } }],
        byCategory: [
          { $match: { status: 'Open' } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
        ],
        topLocations: [
          { $match: { status: 'Open' } },
          { $group: { _id: { $toLower: '$location' }, name: { $first: '$location' }, count: { $sum: 1 } } },
          { $sort: { count: -1, name: 1 } },
          { $limit: 5 },
        ],
        newThisWeek: [{ $match: { createdAt: { $gte: weekAgo } } }, { $count: 'n' }],
        claimedThisWeek: [{ $match: { status: 'Claimed', claimedAt: { $gte: weekAgo } } }, { $count: 'n' }],
      },
    },
  ]);

  const count = (status, type) =>
    facets.byStatusType
      .filter((g) => (!status || g._id.status === status) && (!type || g._id.type === type))
      .reduce((sum, g) => sum + g.count, 0);

  const total = count();
  const claimed = count('Claimed');

  return res.status(200).json({
    total,
    open: count('Open'),
    openLost: count('Open', 'Lost'),
    openFound: count('Open', 'Found'),
    claimed,
    returnRate: total ? Math.round((claimed / total) * 100) : 0,
    newThisWeek: facets.newThisWeek[0]?.n || 0,
    claimedThisWeek: facets.claimedThisWeek[0]?.n || 0,
    byCategory: facets.byCategory.map((c) => ({ category: c._id, count: c.count })),
    topLocations: facets.topLocations.map((l) => ({ location: l.name, count: l.count })),
  });
});

module.exports = router;
