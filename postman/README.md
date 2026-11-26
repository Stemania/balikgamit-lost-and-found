# Testing the BalikGamit API with Postman (Part 4)

`BalikGamit.postman_collection.json` holds 10 ready-made requests against the live API
(`https://balikgamit.onrender.com`). Each request has **Tests** that check the status code,
so every response shows green PASS checks that you can screenshot as proof.

## 1. Import the collection

1. Open Postman (desktop app or web) and sign in.
2. Click **Import** (top left), then drag in `BalikGamit.postman_collection.json`
   (or **files** and pick it from this `postman` folder).
3. A collection named **BalikGamit API (IT 412 Final)** appears in the left sidebar.

> **Postman on the web:** requests to `onrender.com` work as-is. Only `localhost` needs the Postman desktop app or Desktop Agent.

## 2. Wake the server first

Render's free tier sleeps after about 15 minutes idle. Open https://balikgamit.onrender.com in your browser
and wait until the dashboard loads (up to a minute). Then go back to Postman.

## 3. Send the requests in order (1 to 10)

Click a request in the sidebar, then **Send**. Request 3 saves the new item's id, and requests 7 and 8 reuse it,
so keep the order.

| # | Request | Expected status | What it proves |
|---|---|---|---|
| 1 | `GET /api/health` | **200 OK** | Server is up and connected to MongoDB Atlas |
| 2 | `GET /api/items` | **200 OK** | Reads records from the cloud database |
| 3 | `POST /api/items` (valid JSON) | **201 Created** | Stores a JSON payload in the database |
| 4 | `POST /api/items` (bad fields) | **400 Bad Request** | Validation rejects bad input with reasons |
| 5 | `POST /api/items` (broken JSON) | **400 Bad Request** | Malformed JSON is rejected safely |
| 6 | `GET /api/items?type=Found&status=Open&q=tumbler` | **200 OK** | Filters and search |
| 7 | `PATCH /api/items/:id/claim` | **200 OK** | Updates the record to Claimed |
| 8 | `PATCH` the same item again | **409 Conflict** | Can't claim twice |
| 9 | `PATCH` an id that doesn't exist | **404 Not Found** | Unknown records handled |
| 10 | `GET /api/stats` | **200 OK** | Aggregated numbers from MongoDB |

## 4. What to screenshot

The rubric names **200, 201 and 400**, so these three are required. The rest are a bonus.

| Screenshot | Request | Make sure it shows |
|---|---|---|
| **Required: 200 OK** | 2 | Method + URL, status `200 OK`, the JSON body with `items` |
| **Required: 201 Created** | 3 | The JSON **Body** you sent and status `201 Created` + the returned `item` |
| **Required: 400 Bad Request** | 4 | The bad body you sent, status `400 Bad Request` + the `details` list |
| Bonus | 7, 8, 9 | `200`, `409` and `404` on the claim route |
| Bonus | Test Results tab | Click **Test Results** under the response: all checks **PASS** |
| Bonus | Collection run | Collection **⋯ > Run collection > Run** shows 10 requests, 18 passed tests in one view |
| Proof of persistence | Browser | After request 3, the live site shows "Blue water tumbler" (switch the status filter to Claimed after request 7) |

Tips: maximise the Postman window so the URL, status and body fit in one screenshot
(Windows: **Win + Shift + S**). Keep the status code (top right of the response) visible in every shot.

## Testing a local copy instead

Run `npm start`, then in Postman open the collection, click the **Variables** tab, and change `baseUrl`
to `http://localhost:3000` (Postman desktop app needed for localhost).
