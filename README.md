# WatchWithMe

A Tinder-style movie picker for groups, powered by your Plex library.

## Quick Start (Docker)

```bash
docker compose up -d
```

Open `http://your-server-ip:3000` and follow the setup wizard.

## Development

```bash
# Terminal 1 - Backend
cd backend && npm install && npm run dev

# Terminal 2 - Frontend
cd frontend && npm install && npm run dev
```

Frontend: `http://localhost:5173` · Backend API: `http://localhost:3000`

## How It Works

1. **Setup**: Connect to Plex via OAuth. Select your movie library. Movies are cached locally in SQLite.

2. **Create a Session**: The host configures filters (genre, decade, rating, content rating) and sets a match threshold. A 4-character session code is generated.

3. **Share**: Copy the invite link and send it to others. They open it, enter their name, and immediately start swiping.

4. **Swipe**: All users see movies in the same randomized order. Swipe right to like, left to pass. Tap the **i** button for full movie details (synopsis, cast, director, etc.).

5. **Match**: When enough users (configurable, default: everyone) like the same movie, everyone sees a match screen.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `/data` | Directory for SQLite database |
| `NODE_ENV` | `production` | Environment |

## TrueNAS Deployment

In TrueNAS Scale, create a new App using **Custom App** and point it at this docker-compose.yml. Mount a host path or dataset to `/data` for persistent storage.

## Architecture

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: React + Vite (served by Express in production)
- **Database**: SQLite (via better-sqlite3)
- **Real-time**: Socket.io for user join/match events
- **Plex Auth**: PIN-based OAuth (same pattern as Overseerr)
- **Images**: Proxied server-side so the Plex token stays secure
