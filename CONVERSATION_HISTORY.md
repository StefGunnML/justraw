# Conversation History System

## Overview

The JustRaw application now has a complete conversation history system that persists all conversations with Pierre to the database. No more lost conversations!

## Features

✅ **Persistent Storage**: All conversations are saved to a PostgreSQL database
✅ **Session Management**: Each conversation session gets a unique ID
✅ **History Viewing**: View and load past conversation sessions
✅ **Automatic Recovery**: Current session is automatically restored on page refresh
✅ **Metadata Tracking**: Tracks respect scores, timestamps, and message counts

## Database Schema

### `conversations` Table

```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_dossier(user_id),
  session_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  respect_change INT DEFAULT 0,
  respect_score_after INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
- `idx_conversations_user_id` - Fast queries by user and date
- `idx_conversations_session_id` - Fast queries by session

## API Endpoints

### POST `/api/conversation`
Processes audio and saves the conversation

**Body (FormData):**
- `file`: Audio file
- `sessionId`: UUID for the current session

**Response:**
```json
{
  "userText": "Bonjour...",
  "aiText": "Pff...",
  "audio": "data:audio/wav;base64,...",
  "respectScore": 48
}
```

### GET `/api/conversation`
Retrieves conversation history

**Query Parameters:**
- `sessionId` (optional): Get messages for a specific session
- No params: Get all sessions summary

**Response (all sessions):**
```json
{
  "sessions": [
    {
      "session_id": "uuid",
      "user_message": "...",
      "ai_response": "...",
      "respect_score_after": 48,
      "created_at": "2026-01-08T...",
      "message_count": 5
    }
  ]
}
```

**Response (specific session):**
```json
{
  "conversations": [
    {
      "id": 1,
      "user_id": "...",
      "session_id": "...",
      "user_message": "...",
      "ai_response": "...",
      "respect_change": -2,
      "respect_score_after": 48,
      "created_at": "..."
    }
  ]
}
```

## Frontend Features

### Session Management
- Each browser session gets a unique UUID
- Sessions persist in the URL (could be enhanced with URL params)
- Current session automatically loads on page refresh

### History UI
- Click the **History** button (clock icon) in the header
- View all past conversation sessions
- Click any session to load it and view the full conversation
- Shows:
  - Date and time of conversation
  - Number of messages
  - Final respect score
  - Preview of first exchange

## Setup

### 1. Initialize Database

Run the migration scripts:

```bash
# Create user_dossier table (if not exists)
node scripts/init-db.js

# Create conversations table
node scripts/add-conversations-table.js
```

### 2. Environment Variables

Ensure `.env.local` contains:

```env
DATABASE_URL=postgresql://user:password@host:port/database
GPU_GATEWAY_URL=http://your-gpu-service
GPU_API_KEY=your-api-key
```

### 3. Start Development Server

```bash
npm run dev
```

## How It Works

### 1. Page Load
- Frontend generates a unique `sessionId` using `crypto.randomUUID()`
- Automatically fetches conversation history for current session
- Restores conversation state if any messages exist

### 2. User Interaction
- User records audio via microphone
- Frontend sends audio + `sessionId` to `/api/conversation`
- Backend:
  1. Transcribes audio
  2. Generates AI response
  3. Updates respect score
  4. **Saves conversation to database**
  5. Returns response to frontend

### 3. Viewing History
- User clicks History button
- Frontend fetches all past sessions from `/api/conversation`
- Displays sessions in a modal with metadata
- User can click any session to load it

## Future Enhancements

Potential improvements:

- [ ] Search conversations by text
- [ ] Filter by date range or respect score
- [ ] Export conversations
- [ ] Delete specific sessions
- [ ] Share conversation links
- [ ] Conversation analytics/insights
- [ ] Multi-user support with authentication
- [ ] Archive old conversations

## Technical Details

### Session Recovery
The current implementation uses a session ID generated on page load. To enable true cross-device session recovery, consider:

1. **URL Parameters**: Add `?session=uuid` to the URL
2. **localStorage**: Store session ID in browser storage
3. **User Authentication**: Tie sessions to authenticated users

### Performance
- Indexes ensure fast queries even with thousands of messages
- Frontend only loads one session at a time
- Session list shows previews only (not full conversations)

### Data Retention
Currently, no automatic cleanup is implemented. Consider adding:
- Automatic archival after N days
- Maximum message limit per user
- Periodic cleanup jobs

## Troubleshooting

### "Session not found"
- Clear browser cache and refresh
- Check that database connection is working
- Verify `sessionId` is being sent with requests

### "No past conversations"
- Ensure database migration ran successfully
- Check database connection in console
- Verify `user_id` matches in API and database

### SSL Connection Errors
The migration scripts automatically fall back to non-SSL connections for local development. In production:
- Ensure `DATABASE_URL` uses `sslmode=require`
- Verify SSL certificates are valid
- Check DigitalOcean database settings

## Support

For issues or questions, check:
1. Browser console for errors
2. Server logs for API errors
3. Database connection with `psql` or pgAdmin
