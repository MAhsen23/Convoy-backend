# Convoy Voice Calls (Agora) - Backend Flow

This document describes the production flow for Agora voice calls in convoy chat.

## 1) Prerequisites

Set these environment variables on backend:

- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`
- `AGORA_TOKEN_EXPIRY_SECONDS` (optional, default `3600`)

Never generate tokens on frontend. Tokens must always come from backend.

## 2) API Endpoint

### Generate token for convoy voice

- **Method:** `POST`
- **Path:** `/api/convoys/:id/voice/token`
- **Auth:** Bearer JWT required

Request body:

```json
{
  "role": "publisher",
  "expiry_seconds": 3600
}
```

Body fields:

- `role` (optional): `publisher` or `subscriber` (default `publisher`)
- `expiry_seconds` (optional): server clamps to range `60` to `86400`

Success response:

```json
{
  "success": true,
  "status": "OK",
  "message": "Convoy voice token generated",
  "data": {
    "app_id": "your-agora-app-id",
    "channel_name": "convoy_15",
    "convoy_id": 15,
    "token": "007eJx...",
    "uid": 10,
    "role": "publisher",
    "expires_in_seconds": 3600,
    "expires_at": "2026-03-22T10:00:00.000Z"
  }
}
```

Validation rules:

- User must be authenticated.
- Convoy must exist.
- Convoy status must be `active` or `started`.
- User must be an active member of that convoy.
- Agora config must be present on backend.

## 3) Channel and UID Strategy

- Channel format: `convoy_{convoyId}` (example: `convoy_15`)
- UID in Agora token: backend user id (`req.user.id`)

This keeps identity mapping simple between app and Agora.

## 4) Recommended Frontend Call Flow

1. User opens convoy voice UI.
2. Frontend calls `POST /api/convoys/:id/voice/token`.
3. Frontend joins Agora RTC with:
   - `appId` from response
   - `channelName` from response
   - `token` from response
   - `uid` from response
4. On token lifecycle callback (or around ~80% token lifetime), call token API again.
5. Use refreshed token in Agora renew-token API.
6. On leave, exit Agora channel and cleanup local audio tracks.

## 5) Token Refresh Guidance

- Do not wait for hard expiry.
- Refresh proactively ~5-10 minutes before expiry (or when Agora triggers token will expire callback).
- If refresh fails, keep retry with backoff and show reconnect state.

## 6) Security Notes

- Do not expose `AGORA_APP_CERTIFICATE` to frontend.
- Keep token TTL short enough for security and long enough for UX.
- Restrict token issuance to convoy membership checks (already enforced).

