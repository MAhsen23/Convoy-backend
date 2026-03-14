# Convoy Backend – Flow & API Reference

Single source of truth for backend flows, APIs, and data model. **Edit this file step by step** when you add or change features.

---

## Table of contents

1. [Overview](#1-overview)
2. [Authentication flows](#2-authentication-flows)
3. [User identity (unique_id & username)](#3-user-identity-unique_id--username)
4. [Database (migrations & tables)](#4-database-migrations--tables)
5. [Auth API reference](#5-auth-api-reference)
6. [Garage API reference](#6-garage-api-reference)
7. [Environment & config](#7-environment--config)
8. [Project structure](#8-project-structure)
9. [Changelog](#9-changelog)

---

## 1. Overview

- **Stack**: Node.js, Express, Supabase (PostgreSQL), JWT, optional Resend (email OTP).
- **Auth**: Email OTP (prod: real email; dev: fixed code) and/or email+password (register/login).
- **User identity**: Each user has a **7-digit `unique_id`** (for search/share) and a **unique username** (case-insensitive). Admins are not in the users table; they’ll be managed separately when needed (e.g. 1–2 admins via simple table or env).

---

## 2. Authentication flows

### 2.1 Register (email verification required)

1. **Send OTP**  
   Client → `POST /api/auth/send-otp` with `{ "email": "user@example.com" }`.  
   - **Dev** (`BYPASS_OTP=true`): Fixed code `123456`; no email sent; response may include `dev_code`.  
   - **Prod**: 6-digit OTP sent to email. Used only to verify the user owns the email before register.

2. **Register**  
   Client → `POST /api/auth/register` with `{ "email", "code", "username", "password" }`.  
   - Verifies OTP for that email first; if invalid/expired, returns error.  
   - If valid: checks email and username availability, creates user with `password_hash`, returns JWT + user.

### 2.2 Login

- **Login**  
  Client → `POST /api/auth/login` with **either** `{ "email", "password" }` or `{ "username", "password" }` (not both).  
  - If user has no password (legacy account), API returns a message to reset or contact support.

### 2.3 Protected routes

- **Me**: `GET /api/auth/me` with `Authorization: Bearer <token>`.  
- **Update profile**: `PATCH /api/auth/profile` with optional `username`, `profile_picture_url`, `status`.

---

## 3. User identity (unique_id & username)

### 3.1 7-digit `unique_id`

- **Purpose**: Easy to share and search (“add me: 1247190”).
- **Storage**: 7-digit integer from sequence `user_unique_id_seq`. 
- **Lookup**: `GET /api/auth/profile/:uniqueId` returns public profile by unique_id.
red in `reserved_unique_ids` and are **skipped** when assigning IDs—so users get “normal” 7-digit IDs and you can use golden ones for giveaways or special accounts later.
- **Lookup**: `GET /api/auth/profile/:uniqueId` returns public profile by unique_id.
 **Check availability**: `GET /api/auth/check-username?username=xxx`.

### 3.3 Admins (not in users table)

- Admins are **not** stored in the users table (no username/status needed; usually 1–2 people).
- When you add a dashboard, manage admins in a **simple separate way**: e.g. a small `admins` table (user_id or email) or an env list. Use `authorize('admin')` middleware and resolve admin status from that store.

---

## 4. Database (migrations & tables)

### 4.1 Migrations

- **Location**: `database/migrations/`.
- **Apply**: Supabase Dashboard → SQL Editor (paste and run each file in order, oldest first), or copy into `supabase/migrations/` and run `supabase db push`.
- **Details**: See `database/README.md`.

### 4.2 Why SERIAL (integer) for users.id?

- **Simple lookups**: `api_logs.user_id` is an integer FK to `users.id`, so “logs for user 42” is a simple `WHERE user_id = 42` and joins are small and fast.
- **One database**: UUIDs help when IDs are generated in many places or you merge DBs; for a single backend DB, SERIAL is simpler and sufficient.
- **Public ID stays separate**: The 7-digit `unique_id` remains for sharing/search; the internal `id` is just for the app and DB.

### 4.3 Tables (current)

| Table        | Purpose |
|-------------|---------|
| `users`     | **id (SERIAL)** – integer primary key; unique_id (7-digit from sequence, starts at 2000000 then 2000001, …), username, email, phone, password_hash, profile_picture_url, udid, device_info (JSONB), push_token (TEXT), status, is_active, timestamps. Constraint: at least one of email/phone. No `role` column; admins managed separately. |
ve, timestamps. Constraint: at least one of email/phone. No `role` column; admins managed separately. |
| `reserved_unique_ids` | value (INTEGER PK). Golden 7-digit IDs that are not assigned to users (e.g. 1111111, 1234567, 9999999); add more as needed. |
_id = 123`, ip_address, user_agent, request_body/response_body (JSONB), duration_ms, success, status, message, error_message, created_at. Indexes: request_id, user_id, created_at, (method, path), status_code, success. Function `cleanup_old_api_logs()` deletes logs older than 90 days. |
| `vehicles`  | id (SERIAL), user_id (FK users), model, power, fuel_type, modifications, **image_url** (TEXT), is_primary (one per user), created_at, updated_at. Garage: primary shown in profile/convoys/chats. |

### 4.4 Key indexes

- `users`: unique_id, username, email, phone, status.
- `otp_codes`: email, expires_at.
- `api_logs`: user_id, created_at, request_id.
- `vehicles`: user_id, (user_id) WHERE is_primary = true.

---

## 5. Auth API reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/auth/send-otp`       | No  | Send verification code to email (used before register). Body: `{ "email" }`. |
| POST   | `/api/auth/register`       | No  | Register after email verification. Body: `{ "email", "code", "username", "password" }| POST   | `/api/auth/send-otp`       | No  | Send verification code to email (used before register). Body: `{ "email" }`. |
| POST   | `/api/auth/register`       | No  | Register after email verification. Body: `{ "email", "code", "username", "password" }`. Verifies OTP then creates account. |
ery: `?username=xxx`. |
| GET    | `/api/auth/profile/:uniqueId` | No  | Public profile by 7-digit unique_id. |
| GET    | `/api/auth/me`             | Yes | Current user profile. Header: `Authorization: Bearer <token>`. |
| PATCH  | `/api/auth/profile`        | Yes | Update profile. Body: `{ "username?", "profile_picture_url?", "status?", "udid?", "device_info?", "push_token?" }`. |

---

## 6. Garage API reference

Users can add multiple vehicles; one can be set as **primary** (shown in profile, convoys, chats). All garage routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/garage`           | List current user's vehicles (primary first). |
| POST   | `/api/garage`           | Add vehicle. Body: `{ "model", "power?", "fuel_type?", "modifications?", "image_url?", "is_primary?" }`. |
| GET    | `/api/garage/:id`       | Get one vehicle (must belong to user). |
| PATCH  | `/api/garage/:id`       | Update vehicle. Body: `{ "model?", "power?", "fuel_type?", "modifications?", "image_url?", "is_primary?" }`. |
| DELETE | `/api/garage/:id`       | Remove vehicle. |
| PATCH  | `/api/garage/:id/primary` | Set this vehicle as primary (clears primary on others). |

**Response shape (success):**

```json
{
  "success": true,
  "status": "OK",
  "message": "...",
  "data": { ... }
}
```

**Auth error (401):**

```json
{
  "success": false,
  "status": "ERROR",
  "message": "Authentication token required",
  "data": null
}
```

### 6.1 Social (Crew/Friends) API

All social routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/social/users/search?q=...` | Search users by `username` or `unique_id` (each user includes `conversation_id` if direct chat already exists). |
| POST   | `/api/social/friend-requests` | Send friend request. Body supports one of: `{ "to_user_id" }`, `{ "to_unique_id" }`, `{ "to_username" }`. |
| GET    | `/api/social/friend-requests/pending` | List pending requests received by current user. |
| PATCH  | `/api/social/friend-requests/:id` | Accept/reject request. Body: `{ "action": "accept" | "reject" }`. |
| GET    | `/api/social/friends` | List current user's friends (crew). |
| DELETE | `/api/social/friends/:userId` | Remove a friend. |

`GET /api/social/users/suggested` and `GET /api/social/users/:identifier` also include `conversation_id` when a direct conversation with the current user already exists.

### 6.2 Direct Chat API

All chat routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/chat/direct/:userId` | Create/get 1:1 conversation with a friend. |
| POST   | `/api/chat/messages` | **Single send-message API (direct chat)**: always send `{ "to_user_id", "content", "type?", "metadata?" }`. Backend finds existing 1:1 conversation or creates it automatically. |
| GET    | `/api/chat/conversations` | List current user's conversations. |
| GET    | `/api/chat/conversations/:id/messages` | List messages (`limit`, `offset` supported). |
| PATCH  | `/api/chat/conversations/:id/read` | Mark conversation as read for current user. |

Conversation list item shape:

```json
{
  "id": 1,
  "type": "direct",
  "direct_user_one_id": 10,
  "direct_user_two_id": 11,
  "created_at": "2026-02-22T10:00:00.000Z",
  "latest_message": "Hey, let's drive!",
  "latest_message_at": "2026-02-22T10:10:00.000Z",
  "unread_count": 2,
  "other_user": {
    "id": 11,
    "username": "roadwarrior",
    "profile_picture_url": null,
    "status": "online"
  }
}
```

### 6.3 Convoy Core API

All convoy routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/convoys` | Create convoy. Body: `{ "name?", "max_members?" }` (2..50). Creator becomes leader. |
| GET    | `/api/convoys/current` | Get current active convoy for user (or null). |
| POST   | `/api/convoys/join` | Join convoy by code. Body: `{ "code" }`. |
| POST   | `/api/convoys/:id/leave` | Leave convoy (members only; leader must end convoy). |
| POST   | `/api/convoys/:id/end` | End convoy (leader only). |
| GET    | `/api/convoys/:id/members` | List active convoy members. |
| POST   | `/api/convoys/:id/invites` | Send invite. Body: `{ "invitee_user_id" }`. |
| GET    | `/api/convoys/invites/pending` | List pending convoy invites for current user. |
| PATCH  | `/api/convoys/invites/:id` | Respond to invite. Body: `{ "action": "accept" | "reject" }`. |

---

## 7. Environment & config

- **`.env`**: Copy from `.env.example`. Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`.
- **OTP**  
  - Dev: `BYPASS_OTP=true` → fixed code, no email.  
  - Prod: set `RESEND_API_KEY` and `OTP_FROM_EMAIL`; do not set `BYPASS_OTP` (or set `false`).
- **JWT**: `JWT_SECRET` (min 32 chars), `JWT_EXPIRY` (e.g. `30d`).

---

## 8. Project structure

```
src/
  config/         db.js, config.js
  controllers/    authController.js, garageController.js, socialController.js, chatController.js, convoyController.js
  middleware/     auth.js (authenticate, authorize)
  models/         userModel.js, vehicleModel.js, socialModel.js, chatModel.js, convoyModel.js
  routes/         authRoutes.js, garageRoutes.js, socialRoutes.js, chatRoutes.js, convoyRoutes.js
  services/       otpService.js, emailService.js, firebaseService.js (stub)
  utils/          jwt.js, password.js
database/
  migrations/     20250222000001_initial_schema.sql … 20250222000010_convoy_core.sql
docs/
  BACKEND_FLOW.md  (feature flows)
  REALTIME_EVENTS.md  (Socket.IO event contracts)
.env.example
```

---

## 9. Changelog

*Use this section to note what changed and when. Edit step by step as you add or update features.*

| Date       | Change |
|------------|--------|
| 2025-02-22 | Initial: migrations (users, otp_codes, api_logs), 9-digit unique_id, username_normalized, email OTP (Resend in prod, dev bypass), auth APIs (send-otp, verify-otp, register, login, me, profile, check-username, profile by uniqueId), userModel, authController, emailService, firebaseService stub, .env.example. |
| 2025-02-22 | Migrations moved to `database/migrations/` (see `database/README.md`). |
| 2025-02-22 | unique_id changed from 9-digit to **7-digit** (1_000_000–9_999_999). Removed `role` from users table; admins will be managed separately when needed (e.g. simple admins table or env). Added migration `20250222000002_drop_role_from_users.sql` for existing DBs. |
| 2025-02-22 | OTP is **email-only**; removed legacy phone OTP. `otp_codes` table: email required, no phone column. Migration `20250222000003_otp_email_only.sql` for existing DBs. |
| 2025-02-22 | **Users**: added `udid` (VARCHAR 255), `device_info` (JSONB). **api_logs**: new structure (id SERIAL, request_id UNIQUE NOT NULL, method, url, path, user_id UUID, ip_address, user_agent, request/response JSONB, duration_ms, success, status, message, error_message, created_at); indexes on request_id, user_id, created_at, (method, path), status_code, success; `cleanup_old_api_logs()` for 90-day retention. Migration `20250222000004_users_device_and_api_logs.sql` for existing DBs. Profile API supports udid/device_info. |
| 2025-02-22 | **users.id** changed from UUID to **SERIAL** (integer). **api_logs.user_id** is **INTEGER** FK to users(id) for simple “logs for user X” lookups. See §4.2 for why SERIAL. **Note:** Migration 004 still uses UUID for user_id (for DBs that already have UUID users). New installs use initial migration only. |
| 2025-02-22 | **Garage (vehicles)**: migration 006, `vehicles` table (model, power, fuel_type, modifications, is_primary). APIs: GET/POST /api/garage, GET/PATCH/DELETE /api/garage/:id, PATCH /api/garage/:id/primary. |
| 2025-02-22 | **Vehicle image**: `vehicles.image_url` (TEXT) for vehicle image URL. Migration 007 adds column for existing DBs. POST/PATCH garage accept `image_url`. |
| 2025-02-22 | **Social + Chat**: migration 008 adds `friend_requests`, `friendships`, `conversations`, `conversation_members`, `messages`. Added search users by username/unique_id, friend request send/accept/reject/list/remove APIs, and 1:1 conversation/message/read APIs. |
| 2025-02-22 | **Chat optimization**: migration 009 adds `get_direct_conversations_for_user(user_id)` RPC for optimized latest_message + unread_count + other_user in one DB call. Added direct auto-create send endpoint `/api/chat/direct/:userId/messages`. |
| 2025-02-22 | **Convoy core**: migration 010 adds `convoys`, `convoy_members`, `convoy_invites` and extends user status with `in_convoy`. Added create/join/leave/end convoy and invite APIs under `/api/convoys`. |
| 2025-02-22 | **Socket.IO realtime**: added JWT-authenticated socket server (`src/socket/io.js`), user/conversation/convoy rooms, emitted realtime events from chat/social/convoy controllers, and realtime contract doc `docs/REALTIME_EVENTS.md`. |

---

*Last updated: 2025-02-22*
