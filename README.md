# UTC Time Converter

A modern web app that converts any UTC timestamp to **Eastern (EST/EDT)** and **Central (CST/CDT)** time, with real-time Daylight Saving Time awareness. Built for self-hosting on a home lab via Docker.

## Features

- **Accepts any UTC format** — ISO 8601, RFC 2822, SQL datetime, Unix timestamps (seconds or ms), and natural date strings
- **DST-aware** — shows whether DST is active for the input time *and* for today's date
- **IP logging** — every conversion logs the client IP to `logs/conversions.log`; all HTTP requests logged to `logs/requests.log`
- **Modern UI** — dark glassmorphism design, animated background, format chips, recent conversion history
- **Home lab ready** — binds to `0.0.0.0`, reverse-proxy aware (`X-Forwarded-For` / `X-Real-IP`)
- **Health endpoint** — `GET /health` for uptime monitoring (Uptime Kuma, etc.)

## Accepted Input Formats

| Format | Example |
|--------|---------|
| ISO 8601 | `2024-06-15T14:30:00Z` |
| ISO with offset | `2024-06-15T14:30:00+00:00` |
| RFC 2822 | `Sat, 15 Jun 2024 14:30:00 +0000` |
| SQL datetime | `2024-06-15 14:30:00` |
| Unix timestamp (s) | `1718459400` |
| Unix timestamp (ms) | `1718459400000` |
| Natural string | `June 15 2024 14:30 UTC` |
| `now` | Current UTC time |

## Project Structure

```
UTC2ESTConverter/
├── server.js          # Express API — conversion logic + IP logging
├── package.json
├── Dockerfile
├── deploy.sh          # Homelab deploy script (lives outside the repo)
├── .gitignore
├── .dockerignore
├── public/
│   ├── index.html     # App shell
│   ├── style.css      # Dark glassmorphism UI
│   └── app.js         # Frontend logic + localStorage history
└── logs/              # Auto-created at runtime, git-ignored, Docker volume
    ├── requests.log   # All HTTP requests with IP, method, status, response time
    └── conversions.log # Per-conversion: timestamp, IP, raw input
```

## Homelab Deployment (Docker)

This is the recommended way to run the app. The `deploy.sh` script lives **outside** the repo in a parent folder so logs persist across deploys.

### First-time setup

```bash
# On your homelab server
mkdir ~/utc2est && cd ~/utc2est
curl -O https://raw.githubusercontent.com/phani05353/UTC2ESTConverter/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Clone the repo into `~/utc2est/UTC2ESTConverter/`
2. Build the Docker image
3. Stop and remove any existing container
4. Start a new container with logs mounted to `~/utc2est/logs/`

### Directory layout after first deploy

```
~/utc2est/
├── deploy.sh              ← run this to update
├── UTC2ESTConverter/      ← git repo (auto-pulled on each deploy)
└── logs/                  ← persists across deploys, never deleted
    ├── requests.log
    └── conversions.log
```

### Re-deploy / update

```bash
cd ~/utc2est
./deploy.sh
```

Pulls latest code, rebuilds the image, and hot-swaps the container. Logs are untouched.

### Port

The app runs on port **3012**. Override with the `PORT` env var if needed.

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name utc.yourhomelab.local;

    location / {
        proxy_pass http://127.0.0.1:3012;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
    }
}
```

The app reads `X-Forwarded-For` and `X-Real-IP` to log the true client IP when behind a proxy.

## Running Locally (without Docker)

### Prerequisites

- Node.js v18 or newer

```bash
git clone https://github.com/phani05353/UTC2ESTConverter.git
cd UTC2ESTConverter
npm install
npm start
```

Open [http://localhost:3012](http://localhost:3012).

```bash
# Auto-restart on file changes
npm run dev

# Custom port
PORT=8080 npm start
```

## API Reference

### `POST /api/convert`

**Request:**
```json
{ "utcInput": "2024-06-15T14:30:00Z" }
```

**Response:**
```json
{
  "inputUtc": "2024-06-15T14:30:00.000Z",
  "inputFormatted": "Saturday, June 15 2024 at 14:30:00 UTC",
  "eastern": {
    "label": "Eastern",
    "datetime": "Saturday, June 15 2024 at 10:30:00 AM",
    "time12": "10:30:00 AM",
    "offset": "UTC-4",
    "abbreviation": "EDT",
    "isDst": true,
    "dstNote": "Daylight Saving Time is currently ACTIVE"
  },
  "central": {
    "label": "Central",
    "datetime": "Saturday, June 15 2024 at 09:30:00 AM",
    "time12": "09:30:00 AM",
    "offset": "UTC-5",
    "abbreviation": "CDT",
    "isDst": true,
    "dstNote": "Daylight Saving Time is currently ACTIVE"
  },
  "currentDstStatus": {
    "eastern": true,
    "central": true,
    "asOf": "2024-06-15T18:00:00.000Z"
  }
}
```

### `GET /health`

```json
{ "status": "ok", "uptime": 3600 }
```
