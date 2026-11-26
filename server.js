// Entry point: load settings, start the web server, connect to MongoDB Atlas.
require('dotenv').config(); // reads .env locally; on Render the variables come from the dashboard
const dns = require('dns');
const mongoose = require('mongoose');

// Optional: some Windows/home networks can't answer the SRV lookup that "mongodb+srv://" needs
// (error: querySrv ECONNREFUSED). Setting DNS_SERVERS=8.8.8.8,1.1.1.1 in .env makes Node use
// public DNS instead. Not needed on Render, so leave it unset there.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
}
const app = require('./src/app');

const PORT = process.env.PORT || 3000; // Render provides PORT automatically
const MONGODB_URI = process.env.MONGODB_URI;

app.listen(PORT, () => {
  console.log(`BalikGamit is running on http://localhost:${PORT}`);
});

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Add it to your .env file (local) or the Render Environment tab.');
} else {
  mongoose
    .connect(MONGODB_URI, { dbName: 'lostfound', serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('Connected to MongoDB Atlas (database: lostfound)'))
    .catch((err) => console.error('Could not connect to MongoDB Atlas:', err.message));
}
