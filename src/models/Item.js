// Item model - the shape of one Lost & Found post stored in MongoDB Atlas.
const mongoose = require('mongoose');

const TYPES = ['Lost', 'Found'];
const STATUSES = ['Open', 'Claimed'];
const CATEGORIES = [
  'Electronics',
  'IDs & Cards',
  'Bags & Wallets',
  'Keys',
  'Clothing & Accessories',
  'Books & School Supplies',
  'Tumblers & Lunchboxes',
  'Others',
];
// Suggestions only - users may type any location.
const LOCATIONS = [
  'Library',
  'Canteen',
  'Gymnasium',
  'Covered Court',
  'Main Building',
  'Computer Laboratory',
  'Science Laboratory',
  'Hallway / Stairs',
  'Comfort Room',
  'Parking Area',
  'Main Gate',
  'Classroom (specify room)',
];

const LIMITS = {
  itemName: 80,
  location: 80,
  description: 500,
  reporterName: 60,
  contact: 100,
};

const itemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true },
    itemName: { type: String, required: true, trim: true, maxlength: LIMITS.itemName },
    category: { type: String, enum: CATEGORIES, required: true },
    location: { type: String, required: true, trim: true, maxlength: LIMITS.location },
    dateOccurred: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: LIMITS.description, default: '' },
    reporterName: { type: String, required: true, trim: true, maxlength: LIMITS.reporterName },
    contact: { type: String, required: true, trim: true, maxlength: LIMITS.contact },
    status: { type: String, enum: STATUSES, default: 'Open' },
    claimedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // adds createdAt / updatedAt automatically
    toJSON: {
      // Send a clean `id` to clients instead of Mongo's internal `_id` / `__v`.
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Item = mongoose.model('Item', itemSchema);

module.exports = { Item, TYPES, STATUSES, CATEGORIES, LOCATIONS, LIMITS };
