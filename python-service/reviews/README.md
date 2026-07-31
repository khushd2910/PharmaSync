# Reviews (Medicine Review CRUD)

A Django-based service for per-medicine reviews (star rating + comment).
Same split as `../medicine_api` and `../chatbot`: this app owns the actual
MongoDB reads/writes, Node is an authenticated proxy in front of it (see
`server/controllers/reviewController.js`). This service has no auth/session
system of its own, so every write trusts the `userId` / `userName` /
`isAdmin` fields Node forwards — Node is responsible for verifying who's
logged in before it ever calls in here.

Reviews are stored in their own `reviews` collection in the same MongoDB
database Node uses, keyed by `medicineId` — one review per user per
medicine.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/api/medicines/<medicine_id>/reviews` | List a medicine's reviews (newest first) + a rating summary (`count`, `average`, star `distribution`) |
| `POST` | `/api/medicines/<medicine_id>/reviews` | Create a review. Body: `{ userId, userName, rating, comment }`. `409` if this user already reviewed this medicine — edit the existing one instead. |
| `PUT` | `/api/reviews/<review_id>` | Edit a review. Body: `{ userId, rating, comment }`. `403` unless `userId` matches the review's author. |
| `DELETE` | `/api/reviews/<review_id>` | Delete a review. Body: `{ userId, isAdmin }`. `403` unless `userId` matches the author, or `isAdmin` is true. |

`rating` must be an integer 1–5. `comment` is optional, capped at 1000
characters.

Run alongside the other apps — see `../medicine_api/README.md` for setup
and how to start the Django server (`python3 manage.py runserver 0.0.0.0:8000`).
