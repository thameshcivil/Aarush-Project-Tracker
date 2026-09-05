# BOQ & Project Tracker

A free, offline-first construction project tracker that runs entirely in the
browser — no server, no login, no cost. It installs on Android like a real
app via GitHub Pages.

## What it does

- **You build the work list yourself** — add each work item with a quantity
  (or dimensions), pick its type (Excavation, PCC, Brick Work, etc.), and the
  app calculates materials needed using **editable coefficients**.
- **Linked Material Tracker** — required quantities come straight from your
  BOQ; you just log what you've purchased and spent, and see what's left to
  buy, automatically.
- **Schedule of Work** — list your tasks in the order you'll do them, give
  each a duration and labour count, and the app **calculates the dates for
  you** (no manual date entry). Reorder anytime and every date recalculates.
- **Upcoming Work & Today's Report** — see what's coming up in the next 7
  days with labour required, and a daily report of what's active today, how
  much labour is needed, and today's cash entries.
- **Multiple projects**, each fully independent.
- **Export to Excel** and **Share via WhatsApp/Mail** straight from your
  phone's native share sheet.
- Excel import is optional, not required — only use it if you want to bring
  in an existing spreadsheet.

All data is stored locally on your device. Nothing is uploaded anywhere.

---

## 1. Host it on GitHub Pages (free, ~5 minutes)

**Important — this is the step that broke last time, so read carefully:**
the files in this folder must sit **directly at the root of your repo**, not
inside a subfolder. `index.html` must be at `yourrepo/index.html`, not
`yourrepo/app/index.html` or `yourrepo/boq-tracker-app/index.html`.

1. Create a new **public** repository on GitHub, e.g. `boq-tracker`.
2. On the repo page, click **Add file → Upload files**.
3. Open this folder on your computer, select **everything inside it**
   (`index.html`, `manifest.json`, `service-worker.js`, `README.md`, and the
   `css`, `js`, `icons` folders) and drag *those* in — not the outer folder
   they came in. Commit.
4. Double-check: on the repo's main page you should see `index.html` listed
   directly, not folder-inside-a-folder.
5. Go to **Settings → Pages**. Under "Build and deployment", set
   **Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
6. Wait a minute, then GitHub shows your live URL, e.g.
   `https://<your-username>.github.io/boq-tracker/`

**If you're updating from a previous install:** delete the old files in the
repo first (or delete the whole repo and redo it) rather than uploading on
top — that avoids any stray leftover files from an earlier attempt.

## 2. Install it on your Android phone

1. Open the GitHub Pages URL in **Chrome**.
2. Tap **⋮ menu → Add to Home screen / Install app**.
3. It now sits on your home screen with its own icon, opens full-screen, and
   works **offline** after the first load.

**If you already installed a previous version:** uninstall/remove it from
your home screen once, then clear Chrome's site data for that URL (Chrome
menu → Settings → Site settings → find the site → Clear & reset), before
reinstalling. This clears out anything the old broken version cached.

---

## 3. Using the app

### Multiple projects
Home screen → **+ New Project**. Tap any project card to open it — each has
entirely separate BOQ, rates, spend and schedule data. **⧉** duplicates a
project as a template for a new site.

### Adding your work list (BOQ tab)
Open a project → **BOQ**. Add a **Section** (e.g. "Footing", "Brick Work"),
then **+ Add Item** inside it. Each item is its own card:
- **Notation** — the work type (PCC, RCC, BW, etc.)
- **Nos, Member Count, Length, Breadth, Depth** — quantity = all five
  multiplied together (set unused ones to 1)

Materials (cement/sand/bricks/aggregate) calculate automatically from the
notation's coefficient the moment you edit any field.

Each section and each item card has a ▾/▸ chevron — tap it to collapse a
section down to a one-line summary (item count, quantity, cement) or an
item down to just its description and quantity. Handy once a project has a
lot of items. **Collapse All / Expand All** at the top of the screen does
it for everything at once. Collapsed state is remembered per project.

### Editing coefficients (material mix ratios)
More → **Coefficients**. This is "how much cement/sand/bricks per unit" for
each work type. Edit a number here and every BOQ item using that notation
recalculates immediately. Add a new work type with **+ Add Coefficient**.

### Editing Schedule of Rates (cost per unit)
More → **Schedule of Rates**. Cement ₹/bag, sand ₹/unit, steel ₹/MT, etc. —
update any time prices change and the cost estimate re-totals instantly. The
**Wastage %** here also sets the buffer added on top of raw quantities.
**Other Cost Items** below it is for lump-sum lines (Doors, Electrical,
Labour) that aren't bulk materials.

### Material Tracker (linked to your BOQ)
Dashboard → **📦 Material Tracker** (or More → **Material Spend Tracker**).
The top section auto-lists the 5 bulk materials with how much you **need**
(computed from your BOQ + wastage) — just fill in what you've purchased and
spent; "Remaining to Buy" updates live. Below that, **Other Materials** is a
free-form section for anything outside the bulk 5 (steel, paint, tile,
fittings).

### Daily cash ledger
Bottom nav → **Spend**. One entry per transaction: date, description, amount
received or spent, remark. Running balance calculates automatically.

### Schedule of Work (workflow-driven)
Bottom nav → **Schedule**. Set your **Work start date** once. Then add tasks
**in the order you'll actually do them** — each with a Duration (days) and
Labour Required. The app chains the dates together itself: task 2 starts the
day after task 1 ends, and so on. Reorder any time with **↑/↓** and every
date recalculates. Use **⇅ From BOQ Sections** to auto-create one task per
BOQ section you haven't linked yet. Track real progress with **Actual
Start/End** dates and the progress slider — those don't affect the plan,
they're just what really happened.

### Upcoming Work & Today's Report
Dashboard shows a live **Today** summary (tasks active, labour needed, spend
today) and an **Upcoming Work** preview for the next 7 days — tap either to
see the full view. **Today's Report** breaks down exactly what's active
today, labour required, and today's cash entries — useful as a quick
end-of-day or morning check.

### Exporting / Sharing via WhatsApp or Mail
Dashboard → **📲 Share via WhatsApp/Mail** opens Android's native share sheet
with an Excel export attached (Title, Coefficients, Measurements, Abstract-1,
Abstract-2, Main Abstract, Material Spend, Daily Spend, Schedule). On older
browsers it downloads the file instead — attach it manually from there.

### Importing an existing Excel file (optional)
Home → **⬆ Import Excel**, or from within a project, More → **Import Excel
into this project** (this overwrites that project's current data). Only
needed if you're bringing in a spreadsheet you already have — not required
for normal use.

### Cloud Backup & Multi-Device Sync (optional)
By default the app is fully offline/local — this section only matters if
you want to sign in and use the same projects across two phones.

**Setup (one-time, ~10 minutes, free, no credit card):**
1. Go to [console.firebase.google.com](https://console.firebase.google.com),
   sign in with any Google account, click **Add project**.
2. **Build → Authentication → Get started** → enable **Email/Password**.
3. **Build → Firestore Database → Create database** → production mode →
   any nearby region.
4. **Project Settings** (gear icon) → **Your apps** → click **</>** (web) →
   register the app → copy the `firebaseConfig` values shown.
5. Open `js/firebase-config.js` in your repo and paste those 6 values in,
   replacing the `YOUR_...` placeholders. Commit.
6. In Firestore → **Rules** tab, paste the rule shown at the top of
   `js/firebase-config.js` and click **Publish** — this makes sure each
   person can only read/write their own data.
7. Reload the app. **More → Cloud Backup & Sync** (or the ☁️ icon on the
   Home screen) now shows a sign-up form instead of the "not set up"
   message.

**Using it:** create an account (email + password) and every project on
that device syncs up automatically. Sign in with the same account on
another phone and its projects pull down automatically too. Editing on
either device pushes the change; whichever edit is newer wins if you
happen to edit the same project on both at once while offline. Turn off
**Auto-sync** on the account screen to sync manually instead, via
**Backup All Projects Now**.

**Regardless of whether you set this up**, a **Download Local Backup
(.json)** button on the same screen saves every project on this device to
one file any time — a simple offline safety net, no sign-in needed.

---

## 4. Notes & limitations

- Data lives in your phone's browser storage. **Clearing Chrome's site data
  will erase it** — export to Excel regularly as a backup.
- No login, no cloud sync between devices. To use it on two phones with
  shared data, export from one and import into the other.
- Built with vanilla HTML/CSS/JS + [SheetJS](https://sheetjs.com/) (loaded
  from a public CDN) for Excel read/write — needs internet the very first
  time you open the app, then works offline.
