# UTC Time Converter

A modern web app that converts any UTC timestamp to **Eastern (EST/EDT)** and **Central (CST/CDT)** time, with real-time Daylight Saving Time awareness.

## Features

- **Accepts any UTC format** — ISO 8601, RFC 2822, SQL datetime, Unix timestamp (seconds or milliseconds), and natural date strings
- **DST-aware** — shows whether DST is active for the input time *and* for today's date
- **IP logging** — every conversion request logs the client IP to `logs/conversions.log`
- **Request logging** — full HTTP access log via Morgan to `logs/requests.log`
- **Modern UI** — dark glassmorphism design, animated background, recent conversion history (localStorage)
- **Home lab ready** — binds to `0.0.0.0`, works behind a reverse proxy (reads `X-Forwarded-For`)
- **Health endpoint** — `GET /health` for uptime monitoring

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

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer

### Install & Run

```bash
git clone https://github.com/phani05353/UTC2ESTConverter.git
cd UTC2ESTConverter
npm install
npm start
```

Open [http://localhost:3012](http://localhost:3012) in your browser.

### Development (auto-restart on file changes)

```bash
npm run dev
```

### Custom Port

```bash
PORT=8080 npm start
```

## Home Lab / Reverse Proxy Setup

The server listens on `0.0.0.0` so it's reachable on your local network. Example Nginx config for reverse proxy:

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

The app reads `X-Forwarded-For` and `X-Real-IP` headers to log the true client IP.

## Project Structure

```
UTC2ESTConverter/
├── server.js          # Express backend — conversion API + IP logging
├── package.json
├── .gitignore
├── public/
│   ├── index.html     # App shell
│   ├── style.css      # Dark glassmorphism UI
│   └── app.js         # Frontend logic
└── logs/              # Auto-created at runtime (git-ignored)
    ├── requests.log   # All HTTP requests with IP
    └── conversions.log # Conversion events with raw input + IP
```

## API

### `POST /api/convert`

**Request body:**
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
  "central": { ... },
  "currentDstStatus": {
    "eastern": true,
    "central": true,
    "asOf": "2024-06-15T18:00:00.000Z"
  }
}
```

### `GET /health`

Returns `{ "status": "ok", "uptime": <seconds> }` — useful for home lab monitoring (Uptime Kuma, etc.).

## Logs

Logs are written to `logs/` (created automatically, excluded from git):

- `requests.log` — every HTTP request: timestamp, IP, method, path, status, response time
- `conversions.log` — every conversion: timestamp, IP, raw input string
