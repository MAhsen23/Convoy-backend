# Database migrations

Migrations are plain SQL and can be applied in either of these ways:

1. **Supabase Dashboard**  
   Open your project → SQL Editor → paste and run the contents of each file in order (oldest timestamp first).

2. **Supabase CLI**  
   From the project root:
   ```bash
   supabase link 
   supabase db push
   ```

## Migration files

- `20250222000001_initial_schema.sql` – `users`, `otp_codes`, `api_logs`, sequence for 9-digit `unique_id`, indexes and triggers.

## After running

- Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` point to the same project.
- For production OTP emails, set `RESEND_API_KEY` and `OTP_FROM_EMAIL` and use `BYPASS_OTP=false` (or omit it).
