# Turning on real accounts + shared trade ads (Supabase, free)

Your site is on GitHub Pages, which can only serve files. Supabase is the small server that stores
accounts and trade ads. Takes about 10 minutes, once.

1. Go to https://supabase.com, sign up, click **New project** (any name, pick a region near you, save the database password somewhere).
2. **Authentication > Sign In / Providers > Email**: turn **Confirm email OFF** and save.
   (Usernames are turned into a private login e-mail, so nobody receives mail.)
3. **SQL Editor > New query**: paste all of `supabase-setup.sql` and press **Run**. Then do the same with `supabase-setup-2.sql` (shared catalog edits + shared Log Update).
4. **Project Settings > API**: copy the **Project URL** and the **anon public** key into `supabase-config.js`.
   Never use the `service_role` key.
5. Upload/commit all the files to your GitHub repo (replace the old ones), wait a minute, hard refresh the site.
6. **Create your admin account**: on gwenvaluehub.com press Log in > Sign up with the username `gwensharra` and a NEW password.
   Do this first, before anyone else can take the name. Then in the SQL Editor run:
   `update public.profiles set role = 'admin' where lower(username) = 'gwensharra';`
   Log out and back in: you now see Edit, Add item, etc.

What is stored on the server: accounts (passwords are hashed by Supabase), trade ads, catalog edits (prices, tags, demand, stars), items added with Add item, and the Log Update.
Ads can only be read, posted and deleted by logged-in people; you can delete any ad as admin.
Edits and the log are readable by everyone (even logged out) and writable only by the admin. Press Save in the bar at the bottom to publish edits; visitors see them within about 20 seconds, or instantly on refresh.
The first time you open the live site as admin, whatever is already saved in your browser (edits, added items, log) is uploaded automatically.
Still stored per browser: My List / wishlist / recently viewed.

## Fun Fact tab and Members page (no new SQL needed)
- Fun facts: as admin, open an item, press Edit, write one fact per line in "Fun facts", press Apply. They are saved for everyone right away (stored in the same `site_state` table as your other edits, key `facts`). The item card shows them in the new Fun Fact tab.
- Members page (members.html, replaces the Scammers menu entry): shows everyone who has an account, only to logged-in visitors. Click a name for their profile (member number, join date, trade ads posted, latest ads).

## IP address view + max 3 accounts per IP (supabase-setup-33.sql)
Run `supabase-setup-33.sql` in the SQL Editor (after supabase-setup-24.sql).
- Admins and moderators see a member's IP on their profile: Moderation > **IP address** (last seen IP, IP at sign-up, other accounts on the same IP). Nobody else can read IPs.
- Only 3 accounts can be created per IP. The 4th sign-up is refused with "You're not able to make more accounts." If an account still gets created beyond the 3rd (for example by calling the API directly), it is banned automatically and is never signed in.
- Existing accounts count towards the limit with the last IP we saw for them. Admins are never banned.
- IPv6 is counted per /64 block. People on one shared network (school, family, mobile carrier) share the 3 slots.
