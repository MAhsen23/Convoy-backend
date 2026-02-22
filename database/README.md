# Database migrations

Migrations live in **`database/migrations/`**. Apply them in order (by filename).

## How to apply

1. **Supabase Dashboard**  
   Open your project → SQL Editor → paste and run the contents of each file in **`database/migrations/`** in order (oldest filename first).

2. **Supabase CLI** (if you use it)  
   The CLI expects migrations in `supabase/migrations/` by default. You can either:
   - Copy or symlink `database/migrations/*.sql` into `supabase/migrations/` before running `supabase db push`, or
   - Run the SQL manually from `database/migrations/` in the SQL Editor as above.

## Migration files

- `20250222000001_initial_schema.sql` – `users` (udid, device_info, no role), `otp_codes` (email only), `api_logs` (SERIAL id, request_id UNIQUE, indexes, cleanup_old_api_logs), sequence for **7-digit** `unique_id`, indexes and triggers.
- `20250222000002_drop_role_from_users.sql` – Run only if you already applied an older version that had a `role` column; drops `role` from `users`.
- `20250222000003_otp_email_only.sql` – Run only if you have an older `otp_codes` with a `phone` column; makes OTP email-only.
- `20250222000004_users_device_and_api_logs.sql` – Run if you have an older schema: adds `udid` and `device_info` to users; replaces `api_logs` with the new structure and `cleanup_old_api_logs()`.

## After running

- Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` point to the same project.
- For production OTP emails, set `RESEND_API_KEY` and `OTP_FROM_EMAIL` and use `BYPASS_OTP=false` (or omit it).