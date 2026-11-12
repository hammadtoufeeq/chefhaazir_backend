# Chef Haazir — Backend

*Ghar se door, ghar ka khana.* Book a verified home chef in Pakistan for a 2-hour slot, with groceries from the platform's city store.

Node.js, Express 5, MongoDB (Mongoose), JWT auth in httpOnly cookies, Zod validation.

## Setup

```bash
npm install
cp .env.example .env      # then fill in your values
npm run create-admin      # creates the first admin from ADMIN_* in .env (run once)
npm run dev               # http://localhost:5000
```

## Roles

| Role | How the account is made |
| --- | --- |
| Guest | No account; can browse chefs and grocery |
| Customer (`user`) | `POST /api/auth/register/user` |
| Chef | `POST /api/auth/register/chef` (pending until OTP, contract and admin approval) |
| Grocery owner | `POST /api/auth/register/grocery-owner` (store pending until admin approval; one approved store per city) |
| Admin | `npm run create-admin` |

## Main rules

- Fixed slots: 08-10, 10-12, 12-14, 14-16, 16-18, 18-20, 20-22 (Pakistan time)
- Book at least 2 hours before the slot and at most 7 days ahead; the chef has 15 minutes to accept
- Accepting locks the slot and rejects other requests for it; cancel until 1.5 hours before (admin any time)
- Confirmed bookings auto-complete 24 hours after the slot; issues can be reported until then
- Groceries under Rs 500 have a Rs 150 delivery fee; prices, rate and commission are copied into each booking
- Chefs pay commission + groceries + delivery through settlements; unpaid for 3 days after the issue window = blocked

## API

All routes start with `/api`.

**Auth** — `POST /auth/register/user`, `POST /auth/register/chef`, `POST /auth/register/grocery-owner`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me`

**Chefs** — public: `GET /chefs` (search, city, cuisine, minPrice, maxPrice, page, limit), `GET /chefs/:id`, `GET /chefs/:id/availability?date=` · chef: `GET|PATCH /chefs/me/profile`, `POST /chefs/me/contract`, `POST /chefs/me/verify-otp`, `GET /chefs/me/earnings`

**Bookings** — customer: `POST /bookings`, `GET /bookings/mine` · chef: `GET /bookings/chef`, `PATCH /bookings/:id/accept`, `PATCH /bookings/:id/reject`, `PATCH /bookings/:id/complete`, `PATCH /bookings/:id/grocery-return` · customer, chef or admin: `GET /bookings/:id`, `PATCH /bookings/:id/cancel`

**Grocery** — public: `GET /grocery/stores`, `GET /grocery/items?city=` · grocery owner: `GET /grocery/my-store`, `GET /grocery/my-items`, `GET /grocery/stats`, `POST /grocery/items`, `PATCH /grocery/items/:id`, `DELETE /grocery/items/:id`, `GET /grocery/orders`, `PATCH /grocery/orders/:bookingId/status`, `PATCH /grocery/orders/:bookingId/verify-return`

**Settlements** — chef: `POST /settlements`, `GET /settlements/mine` · admin: `GET /settlements`, `PATCH /settlements/:id/verify`, `PATCH /settlements/:id/reject`

**Issues** — customer or chef: `POST /issues`, `GET /issues/mine` · admin: `GET /issues`, `PATCH /issues/:id/resolve`

**Admin** — `GET /admin/chefs`, `POST /admin/chefs/:id/otp`, `PATCH /admin/chefs/:id/approval`, `GET /admin/stores`, `PATCH /admin/stores/:id/approval`, `GET /admin/chef-payments`, `GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/stats`, `GET|PATCH /admin/settings`

## Week 17 requirements

| Requirement | Where |
| --- | --- |
| Full CRUD | Grocery items (`/grocery/items`) |
| Auth | Access + refresh JWT in httpOnly cookies, refresh token hashed in MongoDB, `protect` + `requireRole` |
| Pagination + search | `GET /chefs`, `GET /grocery/items`, admin lists |
| Validation | Zod schemas in `zod-validator/`, business rules in controllers |
| Aggregation | `GET /admin/chef-payments` (commission due per chef), `GET /admin/stats`, report counts in `GET /admin/users` |
