const express = require('express');
const morgan = require('morgan');
const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3012;

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

const logStream = fs.createWriteStream(path.join(logsDir, 'requests.log'), { flags: 'a' });

// Custom morgan token for real IP (handles proxies/home lab reverse proxy)
morgan.token('real-ip', (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'unknown'
  );
});

app.use(morgan(':date[iso] :real-ip :method :url :status :response-time ms', { stream: logStream }));
app.use(morgan(':date[iso] :real-ip :method :url :status :response-time ms'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Try parsing UTC input in multiple formats
function parseUtcInput(input) {
  const trimmed = input.trim();

  // Try ISO 8601
  let dt = DateTime.fromISO(trimmed, { zone: 'utc' });
  if (dt.isValid) return dt;

  // Try RFC 2822
  dt = DateTime.fromRFC2822(trimmed, { zone: 'utc' });
  if (dt.isValid) return dt;

  // Try HTTP date
  dt = DateTime.fromHTTP(trimmed, { zone: 'utc' });
  if (dt.isValid) return dt;

  // Try SQL datetime
  dt = DateTime.fromSQL(trimmed, { zone: 'utc' });
  if (dt.isValid) return dt;

  // Try Unix timestamp (seconds or milliseconds)
  if (/^\d{10}$/.test(trimmed)) {
    dt = DateTime.fromSeconds(parseInt(trimmed, 10), { zone: 'utc' });
    if (dt.isValid) return dt;
  }
  if (/^\d{13}$/.test(trimmed)) {
    dt = DateTime.fromMillis(parseInt(trimmed, 10), { zone: 'utc' });
    if (dt.isValid) return dt;
  }

  // Try common patterns via JS Date as fallback
  const jsDate = new Date(trimmed);
  if (!isNaN(jsDate.getTime())) {
    dt = DateTime.fromJSDate(jsDate, { zone: 'utc' });
    if (dt.isValid) return dt;
  }

  return null;
}

function getZoneInfo(utcDt, ianaZone, label, abbreviationStd, abbreviationDst) {
  const zoned = utcDt.setZone(ianaZone);
  const isDst = zoned.isInDST;
  const offsetHours = zoned.offset / 60;
  const offsetStr = offsetHours >= 0 ? `UTC+${offsetHours}` : `UTC${offsetHours}`;

  return {
    label,
    datetime: zoned.toFormat("cccc, LLLL d yyyy 'at' h:mm:ss a"),
    date: zoned.toISODate(),
    time: zoned.toFormat('HH:mm:ss'),
    time12: zoned.toFormat('h:mm:ss a'),
    iso: zoned.toISO(),
    isDst,
    offset: offsetStr,
    abbreviation: isDst ? abbreviationDst : abbreviationStd,
    dstNote: isDst
      ? 'Daylight Saving Time is currently ACTIVE'
      : 'Daylight Saving Time is currently INACTIVE (Standard Time)',
  };
}

app.post('/api/convert', (req, res) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'unknown';

  const { utcInput } = req.body;

  if (!utcInput || typeof utcInput !== 'string') {
    return res.status(400).json({ error: 'utcInput is required' });
  }

  const logEntry = `[${new Date().toISOString()}] IP=${ip} INPUT="${utcInput.trim()}"\n`;
  fs.appendFile(path.join(logsDir, 'conversions.log'), logEntry, () => {});

  const utcDt = parseUtcInput(utcInput);

  if (!utcDt) {
    return res.status(422).json({
      error: 'Could not parse the provided time. Try formats like: 2024-03-15T14:30:00Z, March 15 2024 14:30 UTC, or a Unix timestamp.',
    });
  }

  const todayInNewYork = DateTime.now().setZone('America/New_York');
  const isDstTodayEastern = todayInNewYork.isInDST;
  const isDstTodayCentral = DateTime.now().setZone('America/Chicago').isInDST;

  res.json({
    inputUtc: utcDt.toISO(),
    inputFormatted: utcDt.toFormat("cccc, LLLL d yyyy 'at' HH:mm:ss 'UTC'"),
    eastern: getZoneInfo(utcDt, 'America/New_York', 'Eastern', 'EST', 'EDT'),
    central: getZoneInfo(utcDt, 'America/Chicago', 'Central', 'CST', 'CDT'),
    currentDstStatus: {
      eastern: isDstTodayEastern,
      central: isDstTodayCentral,
      asOf: DateTime.now().toISO(),
    },
  });
});

// Health check for home lab monitoring
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`UTC Converter running at http://0.0.0.0:${PORT}`);
  console.log(`Logs: ${logsDir}`);
});
