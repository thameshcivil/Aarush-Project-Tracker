# BOQ & Project Tracker

A free, offline-first construction project tracker built from your
`Amutharani_Residency_Project_Aarush.xlsx` workbook. It runs entirely in the
browser (no server, no login, no cost) and installs on Android like a real app.

It rebuilds everything your Excel file did:
- Measurement-driven quantity takeoff (Nos × Member × L × B × D)
- Material coefficients per work type (Ex, PCC, RCC, BW, PBW, Tile, IPL, EPL, etc.)
- Abstract-1 (by work section), Abstract-2 (by notation, with wastage %), Main Abstract (cost estimate)
- Material purchase tracking
- Daily cash ledger with running balance
- **New:** Schedule/task tracking with progress %, planned vs actual dates
- **New:** Multiple projects, each fully independent
- **New:** Export to `.xlsx` and share it straight to WhatsApp/Gmail from your phone

All your data is stored locally on your device (browser storage). Nothing is
uploaded anywhere.

---

## 1. Host it on GitHub Pages (free, ~5 minutes)

1. Create a new **public** repository on GitHub, e.g. `boq-tracker`.
2. Upload every file in this folder to the repo, keeping the folder structure
   exactly as-is (`index.html` at the root, `css/`, `js/`, `icons/` as subfolders).
   Easiest way: on the repo page, click **Add file → Upload files**, drag the
   whole contents of this folder in, and commit.
3. Go to the repo's **Settings → Pages**.
4. Under "Build and deployment", set **Source: Deploy from a branch**, branch
   `main`, folder `/ (root)`. Save.
5. Wait a minute, then GitHub shows your live URL, something like:
   `https://<your-username>.github.io/boq-tracker/`

That's it — the app is now live and free forever on GitHub's servers.

## 2. Install it on your Android phone (so it behaves like an app)

1. Open the GitHub Pages URL above in **Chrome** on your phone.
2. Tap the **⋮ menu → Add to Home screen / Install app**.
3. It now sits on your home screen with its own icon, opens full-screen (no
   browser bar), and works **offline** after the first load.

You can update the app anytime by pushing new files to the GitHub repo — Chrome
picks up the change automatically next time you open it (thanks to the
service worker cache).

---

## 3. Using the app

### Multiple projects
Home screen → **+ New Project**, or **⬆ Import Excel** to bring in an existing
workbook (this one, or a future export from the app). Tap any project to open
it; each has entirely separate BOQ, rates, spend and schedule data. Use the
**⧉** icon to duplicate a project as a starting template for a new site.

### Updating quantities (BOQ / Measurements tab)
Open a project → **BOQ**. Each **Section** (e.g. "Footing", "Brick Work")
holds line items. For each item you enter:
- **Notation** — the work type (PCC, RCC, BW, etc. — see Coefficients below)
- **Nos, Mem (member count), L, B, D** — same as your Excel columns

Quantity = `Nos × Member × Length × Breadth × Depth`, and materials
(cement/sand/bricks/aggregate) are computed automatically using that
notation's coefficient. Edit any cell, it recalculates immediately, and every
Abstract updates instantly too. Add new sections with **+ Add Section**, new
items with **+ Add Item**.

### Updating coefficients (material mix ratios)
More (bottom nav) → **Coefficients**. This is the "how much cement/sand/bricks
per unit" table (same as your Coefficients sheet). If your site mix ratio
differs — e.g. you use 1:4 instead of 1:6 mortar — edit the numbers here once;
every BOQ item using that notation recalculates automatically. Add a brand-new
work type with **+ Add Coefficient**.

### Updating Schedule of Rates (material cost per unit)
More → **Schedule of Rates**. This is your Main Abstract's rate list — cement
₹/bag, sand ₹/unit, steel ₹/MT, etc. Update a rate any time cement prices
change, for instance, and the whole cost estimate re-totals immediately. The
**Wastage %** field here also controls the buffer added on top of raw
material quantities (Abstract-2 "With Wastage" row). The **Other Cost Items**
table below it is for lump-sum items like Doors, Windows, Electrical,
Plumbing, Labour — anything that isn't a bulk material.

### Material Spend
More → **Material Spend Tracker**. Log what you've actually purchased
(quantity + amount) against each material — this feeds the "As Per Spend" /
"To Be Spend" columns in the Main Abstract.

### Daily Spend (cash ledger)
Bottom nav → **Spend**. One row per transaction: date, description, quantity,
amount received (from client) or amount spent, plus a remark. Running balance
is calculated automatically, newest totals shown at the top of the screen.

### Schedule tracking (new)
Bottom nav → **Schedule**. Add a task per work item (e.g. "Excavation",
"Roof Slab"), set category, status, planned/actual start & end dates, and drag
the progress slider. The dashboard shows your overall % complete across all
tasks.

### Exporting / Sharing via WhatsApp or Mail
Dashboard → **📤 Export Excel** downloads a `.xlsx` file (same sheet layout:
Title, Coefficients, Measurements, Abstract-1, Abstract-2, Main Abstract,
Material Spend, Daily Spend, Schedule).

Dashboard → **📲 Share via WhatsApp/Mail** opens Android's native share sheet
directly with that Excel file attached — pick WhatsApp, Gmail, Drive, etc.
(This uses the Web Share API; on older browsers it just downloads the file
instead, which you can then attach manually.)

### Re-importing
You can re-import any exported `.xlsx` (or your original template) either as
a brand-new project (Home → **⬆ Import Excel**) or to overwrite the currently
open project (More → **Import Excel into this project**).

---

## 4. Notes & limitations

- Data lives in your phone's browser storage. **Clearing Chrome's site data
  or app data will erase it** — export to Excel regularly as a backup, and
  keep a copy of the file somewhere safe (email it to yourself, save to
  Drive).
- This is a static, client-side app — there's no login and no cloud sync
  between devices. If you want it on two phones with shared data, export from
  one and import into the other.
- Built with vanilla HTML/CSS/JS + [SheetJS](https://sheetjs.com/) for Excel
  read/write, loaded from a public CDN — an internet connection is needed the
  very first time you open the app (to cache it), after that it works fully
  offline.
