# IPU Inventory — Next.js Front End

Next.js app with **Chakra UI** that replicates the original HTML front end routes and behavior. Back end remains **Supabase** (REST + Edge Functions).

## Routes (HTML → Next.js)

| Original (HTML)           | Next.js route        |
|--------------------------|----------------------|
| `index.html` / landing   | `/`                  |
| `ipu.html?ipu_id=1&name=Dayton` | `/ipu/dayton` (or `/ipu/butler-warren`, `/ipu/miami-county`) |
| `admin.html`             | `/admin`             |
| Inventory page           | `/inventory`         |

## Setup

1. **Install dependencies**
   ```bash
   cd frontend-next
   npm install
   ```

2. **Optional: environment variables**  
   Copy `.env.local.example` to `.env.local` and set your Supabase URL and anon key if you use a different project. If you skip this, the app uses the same hardcoded defaults as the original HTML (same Supabase project).

3. **Logo (optional)**  
   For the landing page IPU cards, copy the logo into `public`:
   ```bash
   cp "../Front End/ICS_true_logo.jpeg" public/
   ```
   If you skip this, the image area will show a broken placeholder until the file exists.

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   The app will be at **http://localhost:3000**.

## Step-by-step: how to test the app

1. **Landing (`/`)**
   - Open http://localhost:3000.
   - You should see “OHI • Innovative Care Solutions”, “Select an IPU”, and three IPU cards: Dayton, Butler Warren, Miami County.
   - Click **Dayton IPU** → should go to `/ipu/dayton`.

2. **IPU page (`/ipu/dayton`)**
   - Top bar: “Choose location” (back to `/`) and “Admin” (to `/admin`).
   - Left: scanner (asset number input + Send). Use **Enter** for scan-out, **Shift+Enter** for scan-in.
   - Right: “On-Hand Status” list (from Supabase `ipu_item_totals`). Try **Take 1** on an item (updates totals).
   - Confirm toasts appear for scan / take-one and that the list refreshes.

3. **Admin (`/admin`)**
   - From IPU page, click **Admin** (or open `/admin`; optional query: `?ipu_id=1&name=Dayton`).
   - “Back to IPU” → back to the IPU page; “Choose IPU” → `/`.
   - **Scan In**: enter asset, Send (same Edge function as IPU scan-in).
   - **Quick Adjustments** table: use **+** / **−** to queue changes; click **Confirm / Update** to persist to Supabase.
   - **Inventory Management** → goes to `/inventory`. Par Level and History can show “Not wired” toasts for now.

4. **Inventory (`/inventory`)**
   - “Back to Admin” → `/admin`; “Choose IPU” → `/`.
   - **Add Asset**: pick item type and location, enter asset number, Add Asset.
   - **Move Asset**: enter asset number and new location, Move Asset.
   - **Delete Asset**: enter asset number, Delete Asset.
   - **Asset Inventory** table: use location filter and Search; check pagination (Previous / Next) and result count.

5. **Navigation**
   - From `/` → each IPU card → `/ipu/{slug}`.
   - From `/ipu/dayton` → Admin → `/admin`; from Admin → Inventory → `/inventory`.
   - All “Choose location” / “Choose IPU” links go to `/`.
   - “Back to Admin” from inventory goes to `/admin`; “Back to IPU” from admin goes to the correct `/ipu/{slug}`.

## Build & run for production

```bash
npm run build
npm start
```

## Tech stack

- **Next.js 14** (App Router)
- **Chakra UI** (components and theme)
- **Supabase** (REST API + Edge Functions: `asset-movement`, `IPU_Inventory`)
