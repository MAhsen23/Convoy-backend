# Convoy Realtime Events (Socket.IO)

This document is the source of truth for all websocket realtime events.
Frontend and backend should update this file whenever event contracts change.

---

## 1) Transport + Auth

- Transport: **Socket.IO**
- URL: same backend host (e.g. `https://api.yourdomain.com`)
- Auth: JWT (same token returned by `/api/auth/login` or `/api/auth/register`)

### Client connection

```ts
import { io } from 'socket.io-client';

const socket = io(API_BASE_URL, {
  transports: ['websocket'],
  auth: { token: accessToken }
});
```

If token is invalid/expired, server rejects the socket handshake.

---

## 2) Room Model

Server uses these rooms:

- `user:{userId}` -> personal events for one user
- `conversation:{conversationId}` -> chat events for a conversation
- `convoy:{convoyId}` -> convoy events for members

On connect, server auto-joins:
- user room
- all user conversation rooms
- all active convoy rooms

---

## 3) Client -> Server Events

### 3.1 Conversation

#### `conversation:join`

Join a conversation room (server verifies membership).

```json
{ "conversation_id": 123 }
```

#### `conversation:leave`

Leave conversation room.

```json
{ "conversation_id": 123 }
```

#### `conversation:typing`

Typing state in a conversation.

```json
{
  "conversation_id": 123,
  "is_typing": true
}
```

### 3.2 Convoy

#### `convoy:join_room`

Join a convoy room (server verifies active membership).

```json
{ "convoy_id": 44 }
```

#### `convoy:leave_room`

Leave convoy room.

```json
{ "convoy_id": 44 }
```

---

## 4) Server -> Client Events

## 4.1 Social / Friends

### `friend_request:new` (to receiver user room)

```json
{
  "request": {
    "id": 1,
    "sender_id": 12,
    "receiver_id": 34,
    "status": "pending",
    "created_at": "2026-02-22T10:00:00.000Z"
  }
}
```

### `friend_request:accepted` (to sender + receiver user rooms)

```json
{
  "request_id": 1,
  "sender_id": 12,
  "receiver_id": 34
}
```

### `friend_request:rejected` (to sender user room)

```json
{
  "request_id": 1,
  "sender_id": 12,
  "receiver_id": 34
}
```

### `friend_request:cancelled` (to receiver user room)

```json
{
  "request_id": 1,
  "sender_id": 12,
  "receiver_id": 34
}
```

### `friends:updated` / `friends:removed`

```json
{
  "user_ids": [12, 34]
}
```

---

## 4.2 Chat

### `conversation:message_new` (to `conversation:{id}` except sender)

```json
{
  "conversation_id": 10,
  "message": {
    "id": 999,
    "conversation_id": 10,
    "sender_id": 12,
    "type": "text",
    "content": "Hey!",
    "metadata": null,
    "created_at": "2026-02-22T10:06:00.000Z"
  }
}
```

### `inbox:conversation_updated` (to receiver user rooms)

This is a lightweight inbox event for users who are not currently inside the chat screen/room.

```json
{
  "conversation_id": 10,
  "actor_user_id": 12,
  "latest_message": "Hey!",
  "latest_message_at": "2026-02-22T10:06:00.000Z",
  "message": {
    "id": 999,
    "conversation_id": 10,
    "sender_id": 12,
    "type": "text",
    "content": "Hey!",
    "metadata": null,
    "created_at": "2026-02-22T10:06:00.000Z"
  }
}
```

### `conversation:updated` (compat alias of `inbox:conversation_updated`)

Some clients still listen to `conversation:updated`. Backend emits this with the same payload for compatibility.

### `conversation:read` (to `conversation:{id}` except reader)

```json
{
  "conversation_id": 10,
  "user_id": 34,
  "last_read_at": "2026-02-22T10:10:00.000Z"
}
```

### `conversation:typing` (to `conversation:{id}` except sender)

```json
{
  "conversation_id": 10,
  "user": {
    "id": 12,
    "username": "roadwarrior"
  },
  "is_typing": true,
  "timestamp": 1700000000000
}
```

---

## 4.3 Convoy

### `convoy:created` (to creator user room)

```json
{
  "convoy": {
    "id": 44,
    "code": "7J2KQ9",
    "name": "Night Run",
    "status": "active"
  }
}
```

### `convoy:joined` / `convoy:left`

```json
{
  "convoy": { "id": 44, "code": "7J2KQ9", "status": "active" }
}
```

```json
{ "convoy_id": 44 }
```

### `convoy:member_joined` / `convoy:member_left` (to `convoy:{id}` except actor)

```json
{
  "convoy_id": 44,
  "user": {
    "id": 34,
    "username": "driver34",
    "profile_picture_url": null
  }
}
```

### `convoy:ended` (to `convoy:{id}` except actor who ended convoy)

```json
{
  "convoy_id": 44,
  "ended_by": 12,
  "ended_at": "2026-02-22T11:00:00.000Z"
}
```

### `convoy:invite_new` / `convoy:invite_accepted` / `convoy:invite_rejected`

```json
{
  "invite": {
    "id": 77,
    "convoy_id": 44,
    "inviter_id": 12,
    "invitee_id": 34,
    "status": "pending"
  }
}
```

```json
{
  "invite_id": 77,
  "convoy_id": 44,
  "invitee_id": 34
}
```

---

## 5) Frontend Integration Flow

### Chat screen flow

1. Call `GET /api/chat/conversations/:id/messages` for initial history.
2. Emit `conversation:join` with that `conversation_id`.
3. Listen:
   - `conversation:message_new`
   - `conversation:typing`
   - `conversation:read`
4. On send:
   - Always use `POST /api/chat/messages`
   - Payload: `{ "to_user_id", "content", "type?", "metadata?" }`
   - Backend auto-resolves existing direct conversation or creates new one
5. On open/focus:
   - API call `PATCH /api/chat/conversations/:id/read`.
6. On unmount:
   - emit `conversation:leave`.

### Inbox screen flow

1. Call `GET /api/chat/conversations`.
2. Listen:
   - `inbox:conversation_updated` (primary for inbox refresh when chat room is not active)
   - `conversation:message_new` (optional fallback if app keeps conversation rooms joined globally)
3. Refresh only affected conversation item by id (or refetch list as fallback).

### Convoy screen flow

1. Emit `convoy:join_room` when convoy detail opens.
2. Listen:
   - `convoy:member_joined`
   - `convoy:member_left`
   - `convoy:ended`
3. Emit `convoy:leave_room` on screen exit.

---

## 6) Reliability Notes

- Keep JWT fresh; reconnect socket on token refresh.
- Implement reconnection backoff (Socket.IO handles base retry).
- Deduplicate messages by `message.id`.
- Treat realtime as enhancement:
  - Always keep REST APIs as source of truth.
  - On reconnect, fetch latest conversation/messages to heal missed events.

---

## 7) Versioning Rule

When adding/changing events:

1. Update backend emit payload.
2. Update this file with event and payload contract.
3. Frontend updates listener/parser together.

If a breaking change is needed, create a new event name (e.g. `conversation:message_new_v2`) and deprecate old one gradually.
