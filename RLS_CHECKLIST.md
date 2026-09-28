# Sniffs — RLS verification checklist

The QA report's R6 was the one I couldn't fix from code: Row-Level Security policies live in your Supabase dashboard, not the repo. Without RLS, the anon key shipped in your app binary lets anyone read every user's profile, GPS coordinates, DMs, and push tokens. Before the park test, RLS needs to be on.

This is a 10–15 minute task. Don't skip it.

## What I left for you

`supabase/migrations/0001_rls_baseline.sql` — a starter migration that enables RLS on every table and adds policies that match the read/write patterns I saw in the code. **Review it before running** — I inferred column names from queries, so they might not match your actual schema exactly (e.g. I assumed `created_by` on the `packs` table; yours might be `creator_id`).

## Run order

1. **Take a database backup first.** Supabase Dashboard → Database → Backups → "Create backup". One-click, 30 seconds.

2. **Run the migration in the SQL editor.**
   - Supabase Dashboard → SQL Editor → New Query.
   - Paste the contents of `supabase/migrations/0001_rls_baseline.sql`.
   - Run.
   - If any statement errors (column name mismatch), fix that one line and re-run. The migration uses `DROP POLICY IF EXISTS` so it's safe to re-run.

3. **Verify in the dashboard.**
   - Supabase Dashboard → Authentication → Policies.
   - For each of these tables, confirm "RLS Enabled" is on (lock icon):
     - `profiles`
     - `dogs`
     - `locations`
     - `friendships`
     - `friend_requests`
     - `messages`
     - `packs`
     - `pack_members`
     - `pack_join_requests`

4. **Smoke-test the app end-to-end as a fresh user.** Register a new account, create a dog, swipe on a fake user, send a message, start a trip, create a pack. If anything fails, the policy is probably too strict — check Supabase Logs Explorer → postgres for "permission denied" rows.

## Storage buckets — do this separately

The SQL migration does NOT cover storage. You also need:

- **Dashboard → Storage → `dog-photos` → Policies**:
  - SELECT: public (or `authenticated`) — photos need to show in Discover.
  - INSERT: `authenticated`.
  - UPDATE / DELETE: `authenticated`. (To restrict to owner you'd need to encode owner-id in the storage path, which the current code doesn't do — that's a real follow-up but not park-test blocking.)

- **Dashboard → Storage → `pack-photos` → Policies**: same pattern.

## What this checklist is NOT

It's not a final security model. It's the minimum to keep the anon key from being a master key. After the park test, when you have actual user signals, you'll tighten:

- Profiles: stop letting every authenticated user read every other user's `push_token` and `interests`.
- Locations: serve coarse-grained location (neighborhood, not lat/lng) to non-friends.
- Pack members: scope reads to members of the same pack.

Park-test bar first. Real security model later.

## When you're done

Reply with "RLS is on" and we're at zero remaining RED items. Park test in 14 days. That was the deal.
