EM Wiki – Catalog + Trade
Open index.html (Catalog) or trade.html (Trade). Keep all files and the img/ folder together.
Upload the whole folder to Netlify Drop / Cloudflare Pages / GitHub Pages.

Trade Hub: ads are saved in the visitor's browser only. To make ads visible to everyone,
replace the small "Ads" object in trade.js (all/add/del) with calls to a backend such as Firebase or Supabase.
trade-data.js is a snapshot of item prices/stars/thumbnails. Prices you edit on the Catalog page are applied
on the Trade page automatically (same browser). Re-export the snapshot after big catalog changes.

Log Update (log.html): every admin change (price, tags, demand, add/delete item, save, import) is recorded with the admin name. Stored in this browser only; a backend is needed to share it.
Add item: log in as admin, press "Add item" at the top of the catalog. Items are saved in this browser (em_custom); to make them permanent for everyone, add them to the site data.

My Lists button (left of the search bar, catalog page): wishlist (your saved items, grey tiles, total value), View all (opens the My List filter) and Recently viewed (items you open). Stored per account in this browser.

Logo hover: img/logo-clouds.png and img/logo-letters.png are the logo split in two layers; hovering scales the logo and fades the clouds (nav.css).

Accounts (auth.js): sign up / sign in at the top left. Accounts and the logged-in session are kept in the visitor's browser (localStorage),
so they stay signed in when they come back. Only the admin account sees Edit, Save/Discard, Edits (copy) and Import.
Without a server this is a convenience gate, not real security: accounts exist per browser, and edits are saved per browser too.
For real shared accounts and shared edits you need a backend (Firebase/Supabase) - auth.js is written so it can be replaced.

My List: each account has its own list (and x1/x2 quantities), kept in the browser. Signed out you see the guest list.
The first time an account is created or signed in, the current guest list is copied into it.


SERVER (Supabase): accounts and Trade Hub ads are now stored on a server and require login. See SETUP.md and supabase-setup.sql. supabase-config.js holds the project URL + public key.
The old browser-only accounts and the hardcoded admin password were removed; create gwensharra again via Sign up, then promote it in SQL (SETUP.md).

SHARED DATA: catalog edits, added items and the Log Update live in Supabase (tables site_state and site_log, see supabase-setup-2.sql). Admin writes, everyone reads. auth.js (EMData/EMLog) syncs every 20 s.
