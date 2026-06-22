// Stuttons United — RSVP → Notion
//
// Netlify serverless function (v2). Receives the RSVP JSON from rsvp.js and
// creates a row in your Notion "Guest List" database. The Notion secret never
// touches the browser — it lives in Netlify environment variables:
//
//   NOTION_TOKEN        — your Notion internal integration secret (starts "ntn_" / "secret_")
//   NOTION_DATABASE_ID  — the Guest List database id (32-char hex, dashes optional)
//
// See README-DEPLOY.md §4 for the 5-minute setup.

const NOTION_VERSION = '2022-06-28';

// Our payload key  →  the EXACT Notion column name (from your CSV export).
// Rename a column in Notion? Update the right-hand string here and redeploy.
const PROP_MAP = {
  name:            'Your Name and/or Party',                 // title
  email:           'Primary Contact Email',
  attending:       'Will you be attending?',
  plusOne:         'Plus One',
  guestName:       'Guest Name',
  guestEmail:      'Guest Email',
  numberAttending: 'How many will be attending the ceremony?',
  numberChildcare: 'Childcare #',
  thursday:        'Thursday Welcome Dinner',
  fridayActivities:'Friday Activities',
  fridayDinner:    'Friday Night Dinner',
  sundayBrunch:    'Sunday Brunch?',
  fridayInterest:  'Friday Activity Interest',               // multi-select
  diet:            'Diet',
  song:            'Song',
  advice:          'Advice',
  memory:          'Memory',
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!token || !dbId) {
    return json({ error: 'Server not configured: set NOTION_TOKEN and NOTION_DATABASE_ID.' }, 500);
  }

  let data;
  try { data = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  // Honeypot — silently accept (and discard) obvious bots.
  if (data['bot-field']) return json({ ok: true, skipped: 'bot' });

  // 1) Read the live DB schema so we coerce every value to its real column type.
  const schemaRes = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
    headers: authHeaders(token),
  });
  if (!schemaRes.ok) {
    return json({ error: 'Could not read Notion database', detail: await schemaRes.text() }, 502);
  }
  const props = (await schemaRes.json()).properties || {};

  // 2) Build the properties payload.
  const properties = {};
  for (const [key, notionName] of Object.entries(PROP_MAP)) {
    const def = props[notionName];
    if (!def) continue;                 // column not in the DB — skip quietly
    const built = coerce(def.type, data[key]);
    if (built !== undefined) properties[notionName] = built;
  }

  // 3) Create the page.
  const createRes = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  if (!createRes.ok) {
    return json({ error: 'Notion rejected the row', detail: await createRes.text() }, 502);
  }

  return json({ ok: true });
};

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION };
}

// Turn a raw value into the right Notion property shape for the column's type.
function coerce(type, raw) {
  const empty = raw === undefined || raw === null || raw === '';
  switch (type) {
    case 'title':
      return { title: [{ text: { content: String(raw ?? '') } }] };
    case 'rich_text':
      return empty ? undefined : { rich_text: [{ text: { content: String(raw) } }] };
    case 'email':
      return { email: empty ? null : String(raw) };
    case 'phone_number':
      return { phone_number: empty ? null : String(raw) };
    case 'number': {
      if (empty) return { number: null };
      const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
      return { number: Number.isFinite(n) ? n : null };
    }
    case 'checkbox':
      return { checkbox: isYes(raw) };
    case 'select':
      return empty ? undefined : { select: { name: String(raw) } };
    case 'status':
      return empty ? undefined : { status: { name: String(raw) } };
    case 'multi_select': {
      const arr = Array.isArray(raw) ? raw : (empty ? [] : [raw]);
      return { multi_select: arr.filter(Boolean).map(v => ({ name: String(v) })) };
    }
    default:
      // Unknown type — best effort as text if we can.
      return empty ? undefined : { rich_text: [{ text: { content: String(raw) } }] };
  }
}

function isYes(raw) {
  if (raw === true) return true;
  return ['yes', 'true', '1', 'on'].includes(String(raw).trim().toLowerCase());
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
