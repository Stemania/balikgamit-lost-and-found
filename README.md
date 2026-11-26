# BalikGamit: Campus Lost & Found

A small cloud web app where students post items they **lost** or **found** on campus, browse the board, and mark items as **claimed** once they are returned.

Built for **IT 412 Platform Technologies: Cloud PaaS Web App & Basic API Project**.

| Layer | Technology | Cloud model |
|---|---|---|
| Hosting / runtime | [Render](https://render.com) Web Service | **PaaS** |
| Application | Node.js + Express | - |
| Database | MongoDB Atlas (M0 free cluster) | Managed database (DBaaS) |
| Front end | HTML, CSS, vanilla JavaScript (served by Express) | - |

**Live app:** https://balikgamit.onrender.com
(free tier: the first visit after ~15 minutes of inactivity can take up to a minute while the service wakes up)

## Architecture

```
Browser (HTML/JS)  --HTTPS-->  Render PaaS: Node.js + Express  --TLS-->  MongoDB Atlas
   form + board                 static page + REST API                   database "lostfound"
                                (auto-built from GitHub)                 collection "items"
```

## REST API

| Method | Route | Description | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/items` | List items, newest first. Optional: `?type=Lost\|Found`, `?category=...`, `?status=Open\|Claimed`, `?q=keyword`, `?limit=1-200` | `200 OK` | `400` invalid query |
| `POST` | `/api/items` | Create an item from a JSON body | `201 Created` | `400` validation failed / malformed JSON |
| `PATCH` | `/api/items/:id/claim` | Mark an item as claimed | `200 OK` | `400` invalid id, `404` not found, `409` already claimed |
| `GET` | `/api/stats` | Dashboard numbers (MongoDB aggregation pipeline) | `200 OK` | - |
| `GET` | `/api/health` | Server and database status | `200 OK` | - |
| `GET` | `/api/options` | Categories and suggested locations for the form | `200 OK` | - |

If the database is unreachable, item routes return `503 Service Unavailable`.

### Example `POST /api/items` body

```json
{
  "type": "Found",
  "itemName": "Blue water tumbler",
  "category": "Tumblers & Lunchboxes",
  "location": "Library",
  "dateOccurred": "2026-11-26",
  "description": "Has a cat sticker near the lid",
  "reporterName": "Juan Dela Cruz",
  "contact": "juan.delacruz@school.edu"
}
```

Validation rules: `type`, `itemName`, `category`, `location`, `dateOccurred`, `reporterName` and `contact` are required; `category` must be one of the listed categories; the date must be a real `YYYY-MM-DD` date, not in the future and not older than one year; text fields have length limits.

## Run locally

1. Install Node.js 20 or newer.
2. `npm install`
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your Atlas connection string.
4. `npm start`, then open http://localhost:3000

If you get `querySrv ECONNREFUSED`, add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `.env` (local only).

## Deploy on Render

- **New > Web Service**, connect this GitHub repository
- Runtime: **Node** · Build command: `npm install` · Start command: `npm start` · Instance type: **Free**
- Environment variable: `MONGODB_URI` = your Atlas connection string
- MongoDB Atlas > Network Access must allow `0.0.0.0/0` (Render's free tier has no static IP)
- Every push to `main` triggers an automatic rebuild and deploy

## Project structure

```
server.js              entry point: loads env, starts Express, connects to Atlas
src/app.js             Express app, health/options routes, error handling
src/routes/items.js    REST routes for /api/items
src/routes/stats.js    GET /api/stats (dashboard aggregation)
src/db.js              database-ready helpers (503 when Atlas is unreachable)
src/models/Item.js     Mongoose schema + allowed categories/statuses
src/validateItem.js    business rules for new posts (400 errors)
public/                web app: dashboard, reports table, detail panel, report dialog, API & status page
```
