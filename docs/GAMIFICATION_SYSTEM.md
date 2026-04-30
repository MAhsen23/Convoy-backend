## Gamification System (Phase 1)

This document describes the **Level, XP, and Achievements** system for Convoy backend and how the mobile app should integrate it.

Phase 1 covers:
- **Driving** (distance-based)
- **Convoy** (convoys completed)
- **Convoy Leader** (convoys led)
- **Garage** (vehicle count)

Later phases can add Social, Hazards, Sharing.

---

## Concepts

### XP Events (idempotent)
XP is awarded through an append-only ledger table `xp_events`.

- Every XP award has a unique `event_key` (example: `convoy_end:91:user:10`).
- If the same event is processed again (retry, duplicate request), it becomes a no-op.

### Levels
Level is derived deterministically from XP using:

- \( xpRequired(level) = 100 * (level - 1)^2 \)
- \( level(xp) = floor(sqrt(xp/100)) + 1 \)

Backend stores `users.xp_total` and `users.level` for fast reads.

### Aggregated Stats (progress)
Progress tracking uses the `user_stats` table:
- `total_distance_km`
- `convoys_completed`
- `convoys_led_completed`
- `vehicle_count`

### Achievements
Achievement definitions live in `achievement_definitions`. Unlocks are stored in `user_achievements` with a unique `(user_id, achievement_key)` constraint.

Each achievement has:
- badge (icon URL)
- XP reward
- metric + target for progress

---

## Phase 1 Achievement Catalog (seeded)

Metric keys:
- **Driving**: `total_distance_km`
- **Convoy**: `convoys_completed`
- **Convoy Leader**: `convoys_led_completed`
- **Garage**: `vehicle_count`

Backend seeds these keys (XP rewards are placeholders and can be tuned later):
- Driving: First Drive, 50km, 250km, 1000km, 5000km, 50000km
- Convoy: Convoy Member (1), Team Player (5), Convoy Veteran (100)
- Convoy Leader: 1, 5, 10, 25, 50, 100, 250, 500
- Garage: 1, 3, 5 vehicles

---

## REST APIs (Phase 1)

All endpoints require `Authorization: Bearer <token>`.

### 1) Get my progression
**GET** `/api/gamification/me`

Response example:

```json
{
  "success": true,
  "status": "OK",
  "data": {
    "progression": {
      "user_id": 10,
      "xp_total": 340,
      "level": 2,
      "current_level_xp": 100,
      "next_level_xp": 400,
      "xp_to_next_level": 60,
      "stats": {
        "user_id": 10,
        "total_distance_km": 73.200,
        "convoys_completed": 6,
        "convoys_led_completed": 2,
        "vehicle_count": 3,
        "updated_at": "2026-04-30T10:00:00.000Z"
      }
    }
  }
}
```

### 2) List achievement definitions (catalog)
**GET** `/api/gamification/achievements`

Response example:

```json
{
  "success": true,
  "status": "OK",
  "data": {
    "achievements": [
      {
        "key": "driving_50km",
        "category": "driving",
        "title": "Road Beginner",
        "description": "Drive 50 km in total.",
        "badge_icon_url": null,
        "xp_reward": 100,
        "metric_key": "total_distance_km",
        "target_value": 50,
        "is_active": true,
        "sort_order": 20
      }
    ]
  }
}
```

### 3) List my unlocked achievements + my stats for progress
**GET** `/api/gamification/achievements/me`

Response example:

```json
{
  "success": true,
  "status": "OK",
  "data": {
    "unlocked": [
      {
        "achievement_key": "driving_first_drive",
        "unlocked_at": "2026-04-30T10:00:00.000Z",
        "xp_awarded": 50,
        "metadata": {
          "metric_key": "total_distance_km",
          "target_value": 0.1,
          "current_value": 1.2
        }
      }
    ],
    "stats": {
      "user_id": 10,
      "total_distance_km": 73.2,
      "convoys_completed": 6,
      "convoys_led_completed": 2,
      "vehicle_count": 3,
      "updated_at": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

---

## Real-time Socket Events (Phase 1)

Client connects normally (JWT in handshake). Server emits to user room `user:{userId}`.

### 1) XP/Level updated
**Server → Client** `gamification:progress_updated`

Payload example:

```json
{
  "user_id": 10,
  "xp_total": 340,
  "level": 2
}
```

### 2) Achievement unlocked
**Server → Client** `gamification:achievement_unlocked`

Payload example:

```json
{
  "user_id": 10,
  "achievement": {
    "key": "convoy_team_player",
    "category": "convoy",
    "title": "Team Player",
    "description": "Complete 5 convoys.",
    "badge_icon_url": null,
    "xp_reward": 150
  }
}
```

---

## Server-side Trigger Points (Phase 1)

### Convoy end
When convoy ends (leader ends convoy), backend:
1) finalizes/persists `convoy_members.distance_km`
2) updates `user_stats` for every convoy member
3) applies XP for distance (config: `XP_PER_KM`, capped by `MAX_XP_PER_CONVOY`)
4) evaluates/unlocks achievements and emits socket events

### Member leave
When a member leaves before end, backend persists their in-memory distance into `convoy_members.distance_km`.

### Garage add/remove
On vehicle add/remove, backend refreshes `user_stats.vehicle_count` and evaluates garage achievements.

---

## Mobile App Flow (Phase 1)

### App startup / profile screen
1) Call `GET /api/gamification/me` → show XP + level + progress bar
2) Call `GET /api/gamification/achievements` → cache catalog (badge, rewards, target)
3) Call `GET /api/gamification/achievements/me` → unlocked list + stats
4) Build progress UI by comparing `stats[metric_key]` against `target_value`

### During session
- Listen for socket events:
  - `gamification:progress_updated` → update XP/level UI
  - `gamification:achievement_unlocked` → show toast + update achievements UI

---

## Environment Variables
- `XP_PER_KM` (default 10)
- `MAX_XP_PER_CONVOY` (default 500)

