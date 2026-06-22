# Stuttons United — Deployment Guide

This `stuttons-united-site/` folder is the **production-ready** site. It is plain static
HTML/CSS/JS with **no build step** — whatever you upload is what goes live. The
editor-only tooling (Tweaks panel, React/Babel, image-slot uploader) has been stripped
out, the resort photo has been baked into a real image file, and your chosen look
(**Black & Gold palette + rich motion**) is now baked directly into every page, so it no
longer depends on browser settings.

> **Recommended host: Netlify.** The RSVP form posts to a **Netlify serverless function**
> that writes each response into your **Notion** database (with a backup copy in Netlify
> Forms). This only runs when the site is hosted on Netlify. You can host the rest of the
> site anywhere, but the RSVP page won't capture responses on a non-Netlify host without
> extra work (see §4).

---

## 1. What's in this folder

```
stuttons-united-site/
├── index.html            Home
├── schedule.html         Schedule  →  activities.html
├── activities.html       Friday activities
├── travel.html           Travel & lodging (Reserve callout)
├── gallery.html          Photos (lightbox)
├── registry.html         Registry
├── faq.html              FAQ
├── rsvp.html             RSVP  ← the Netlify form lives here
├── styles.css
├── site.js               countdown, snowfall, reveal animations
├── rsvp.js               multi-step RSVP logic + form submit
├── netlify.toml          Netlify config (publish dir, cache headers, functions)
├── netlify/
│   └── functions/
│       └── rsvp.mjs      Serverless function: writes each RSVP to Notion
└── images/
    ├── cluster-and-profile-in-snow.jpg   (home hero)
    ├── travel-resort.webp                (baked Reserve photo)
    └── engagement/                       (28 gallery photos)
```

**Drag the `stuttons-united-site` folder (the one with `index.html` directly inside it)**
so `index.html` ends up at the site root — i.e. the live home page is `https://yoursite/`,
not `.../stuttons-united-site/`. Do **not** drag a wrapper/parent folder or the `.zip`.

---

## 2. Deploy to Netlify — drag & drop (fastest, ~2 minutes)

1. Go to **https://app.netlify.com** and log in (create a free account if needed).
2. On the **Sites** page, find the **"Deploy manually"** drop zone (also under
   *Add new site → Deploy manually*).
3. Drag the **`stuttons-united-site` folder** onto the drop zone (the folder that has
   `index.html` directly inside it — not a parent folder, not the `.zip`). Netlify
   uploads it and gives you a live URL like `https://random-name-123.netlify.app`.
   - *If the root shows "Page not found":* you dropped one level too high. Re-drag the
     folder that contains `index.html` directly.
4. Done — the site is live. To change the subdomain: **Site configuration → Domain
   management → Options → Edit site name**.

### Redeploying after edits
Manual deploys don't auto-update. To push changes, drag the folder onto
**Deploys → Drag and drop** again. (For automatic deploys, use the Git option in §3.)

---

## 3. Deploy to Netlify — via Git (optional, enables auto-deploys)

1. Put the contents of this folder in a Git repo (GitHub/GitLab/Bitbucket).
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Build settings: **Build command = blank**, **Publish directory = `/`** (or the
   subfolder if you committed it under one). `netlify.toml` already declares these.
4. Deploy. Every push to the main branch now redeploys automatically.

---

## 4. Configure the RSVP form → Notion (REQUIRED — do this after the first deploy)

Each RSVP is written straight into your Notion **Guest List** database by a small
serverless function (`netlify/functions/rsvp.mjs`). It also drops a backup copy into
Netlify Forms. The Notion secret lives in Netlify environment variables — it is **never**
in the page's code, so guests can't see or misuse it.

### 4a. Create a Notion integration and share the database

1. Go to **https://www.notion.so/my-integrations → New integration**. Name it
   `Stuttons RSVP`, pick your workspace, leave it **Internal**. Create it and copy the
   **Internal Integration Secret** (starts with `ntn_` or `secret_`). Keep this private.
2. Open your **Guest List** database in Notion → **••• (top-right) → Connections →
   Connect to →** pick `Stuttons RSVP`. (Without this the function gets a 404 from Notion.)
3. Get the **database id**: open the database as a full page and copy the 32-character
   hex string in the URL — `notion.so/<workspace>/<THIS_PART>?v=…`. Dashes optional.

### 4b. Add the two environment variables in Netlify

Netlify dashboard → your site → **Site configuration → Environment variables → Add a
variable** (add both, then **redeploy** so the function picks them up):

| Key | Value |
|-----|-------|
| `NOTION_TOKEN` | the Internal Integration Secret from 4a-1 |
| `NOTION_DATABASE_ID` | the database id from 4a-3 |

### 4c. Test it

Open the live `/rsvp.html`, submit a test RSVP, and confirm a new row appears in the
Guest List database within a few seconds. Delete the test row after. If nothing shows up,
see **Troubleshooting** below.

> **Column mapping.** The function maps form answers to your exact Notion column names
> (e.g. *Your Name and/or Party*, *Will you be attending?*, *Friday Activity Interest*).
> It reads your database's live schema on each submit, so it adapts whether a Yes/No
> column is a checkbox or a select. If you **rename** a column in Notion, update the
> matching string in `PROP_MAP` at the top of `netlify/functions/rsvp.mjs` and redeploy.

> **Backup copy.** Submissions also land in Netlify **Forms → `rsvp`**. Turn on an email
> notification there (**Form notifications → Add notification → Email**) for a belt-and-
> suspenders alert on every RSVP. The hidden `bot-field` honeypot blocks basic spam.

### Troubleshooting

- **500 "Server not configured":** the env vars are missing or you didn't redeploy after
  adding them. Re-check 4b and trigger a fresh deploy.
- **"Could not read Notion database" / 404 from Notion:** you skipped 4a-2 (the database
  isn't shared with the integration), or `NOTION_DATABASE_ID` is wrong.
- **Row appears but a field is blank:** that column's name in Notion no longer matches
  the string in `PROP_MAP`. Align them and redeploy.

> **Hosting somewhere other than Netlify?** The function only runs on Netlify. On another
> host the RSVP won't record. Either host on Netlify, or ask me to port the function to
> your platform's serverless format.

---

## 5. Custom domain (stuttonsunited.com)

The footer already shows `stuttonsunited.com`. To point it at the live site:

1. Netlify → **Domain management → Add a domain** → enter `stuttonsunited.com`.
2. **If you bought the domain elsewhere** (GoDaddy, Namecheap, Google Domains, etc.):
   at your registrar, either
   - point the domain's **nameservers** to Netlify DNS (Netlify shows the exact
     nameservers), **or**
   - add the **A / CNAME records** Netlify lists (A record → Netlify's load-balancer IP
     for the apex, CNAME `www` → your `*.netlify.app` host).
3. Netlify provisions a free **HTTPS certificate** automatically (can take a few minutes
   to an hour after DNS propagates).
4. Set **www → apex** (or vice-versa) redirect under Domain management so both work.

---

## 6. Quick pre-launch checklist

- [ ] Home hero photo and gallery thumbnails load (confirms `images/` uploaded intact).
- [ ] Travel page → Reserve callout shows the resort photo.
- [ ] Submit a test RSVP → it appears under Netlify **Forms → rsvp**.
- [ ] Email notification arrives for that test submission.
- [ ] Nav links work between all pages (relative links, no `/deploy/` in the URL).
- [ ] Custom domain resolves over HTTPS (if configured).

That's it — drag the folder, turn on form notifications, point the domain. 🎉
