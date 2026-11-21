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
