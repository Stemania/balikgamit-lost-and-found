// Business rules for a new Lost & Found post.
// Returns { errors: [...], data: {...} }. If `errors` is not empty, the API answers 400 Bad Request.
const { TYPES, CATEGORIES, LIMITS } = require('./models/Item');

const DAY_MS = 24 * 60 * 60 * 1000;

// Case-insensitive match against a list of allowed values ("lost" -> "Lost").
function matchOption(value, options) {
  if (typeof value !== 'string') return null;
  const wanted = value.trim().toLowerCase();
  return options.find((opt) => opt.toLowerCase() === wanted) || null;
}

// Trim a string and collapse repeated spaces; non-strings become ''.
function clean(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function validateItem(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object.'], data: null };
  }

  const errors = [];
  const data = {
    type: matchOption(body.type, TYPES),
    itemName: clean(body.itemName),
    category: matchOption(body.category, CATEGORIES),
    location: clean(body.location),
    description: typeof body.description === 'string' ? body.description.trim() : '',
    reporterName: clean(body.reporterName),
    contact: clean(body.contact),
    dateOccurred: null,
  };

  if (!data.type) errors.push(`type is required and must be one of: ${TYPES.join(', ')}.`);
  if (!data.category) errors.push(`category is required and must be one of: ${CATEGORIES.join(', ')}.`);

  for (const field of ['itemName', 'location', 'reporterName', 'contact']) {
    if (!data[field]) errors.push(`${field} is required.`);
  }

  for (const [field, max] of Object.entries(LIMITS)) {
    if (data[field] && data[field].length > max) {
      errors.push(`${field} must be at most ${max} characters.`);
    }
  }

  // dateOccurred: "YYYY-MM-DD", not in the future, not older than one year.
  if (typeof body.dateOccurred !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOccurred)) {
    errors.push('dateOccurred is required in YYYY-MM-DD format.');
  } else {
    const date = new Date(`${body.dateOccurred}T00:00:00Z`);
    const now = Date.now();
    // Round-trip check rejects impossible dates like 2026-02-30.
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.dateOccurred) {
      errors.push('dateOccurred is not a real calendar date.');
    } else if (date.getTime() > now + DAY_MS) {
      // One day of slack so users ahead of UTC (e.g. Philippines, UTC+8) can pick "today".
      errors.push('dateOccurred cannot be in the future.');
    } else if (date.getTime() < now - 365 * DAY_MS) {
      errors.push('dateOccurred cannot be more than one year ago.');
    } else {
      data.dateOccurred = date;
    }
  }

  return { errors, data };
}

module.exports = { validateItem, matchOption };
