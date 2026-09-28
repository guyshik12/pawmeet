-- ============================================================================
-- Sniffs — RLS baseline (0001)
-- ----------------------------------------------------------------------------
-- This migration enables Row-Level Security on every table the app touches
-- and adds policies that match the read/write patterns in the current code.
--
-- BEFORE RUNNING:
--   1. Review each policy below. I inferred column names from src/services/*
--      — if your actual schema differs (e.g. you used `user_id` instead of
--      `owner_id`), edit the policies before running.
--   2. Take a database backup. (Supabase Dashboard > Database > Backups.)
--   3. Run this in the Supabase SQL editor (Database > SQL Editor > New Query).
--      Run it on STAGING first if you have one.
--
-- AFTER RUNNING:
--   - Try the full app flow end-to-end as a brand-new user.
--   - If something breaks, the policy is probably too strict. Check the
--     Supabase logs (Logs Explorer > postgres) for "permission denied" rows.
--
-- These policies are intentionally permissive enough to keep the app working
-- (e.g. anyone authenticated can read profiles + dogs, because Discover and
-- Trip Mode need that). They are NOT a final security model — they're a
-- starting point that beats no-RLS-at-all.
-- ============================================================================

-- ─── profiles ───────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
-- Tightening later: change USING to (id = auth.uid() OR id IN (... users you're matched with ...))

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No DELETE policy = no deletes allowed. That's intentional.

-- ─── dogs ───────────────────────────────────────────────────────────────────
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dogs_select_authenticated" ON public.dogs;
CREATE POLICY "dogs_select_authenticated"
  ON public.dogs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "dogs_insert_own" ON public.dogs;
CREATE POLICY "dogs_insert_own"
  ON public.dogs FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "dogs_update_own" ON public.dogs;
CREATE POLICY "dogs_update_own"
  ON public.dogs FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "dogs_delete_own" ON public.dogs;
CREATE POLICY "dogs_delete_own"
  ON public.dogs FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ─── locations ──────────────────────────────────────────────────────────────
-- NOTE: Locations include live GPS coords. Anyone authenticated can read them
-- today because Discover + Trip Mode need that. For a real launch you'll want
-- coarse-grained location (city/neighborhood only) for non-friends.
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locations_select_authenticated" ON public.locations;
CREATE POLICY "locations_select_authenticated"
  ON public.locations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "locations_insert_own" ON public.locations;
CREATE POLICY "locations_insert_own"
  ON public.locations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "locations_update_own" ON public.locations;
CREATE POLICY "locations_update_own"
  ON public.locations FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "locations_delete_own" ON public.locations;
CREATE POLICY "locations_delete_own"
  ON public.locations FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ─── friendships ────────────────────────────────────────────────────────────
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select_party" ON public.friendships;
CREATE POLICY "friendships_select_party"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "friendships_insert_party" ON public.friendships;
CREATE POLICY "friendships_insert_party"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "friendships_update_party" ON public.friendships;
CREATE POLICY "friendships_update_party"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "friendships_delete_party" ON public.friendships;
CREATE POLICY "friendships_delete_party"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- ─── friend_requests ────────────────────────────────────────────────────────
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_requests_select_party" ON public.friend_requests;
CREATE POLICY "friend_requests_select_party"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_insert_sender" ON public.friend_requests;
CREATE POLICY "friend_requests_insert_sender"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_update_receiver" ON public.friend_requests;
CREATE POLICY "friend_requests_update_receiver"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid() OR sender_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid() OR sender_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_delete_party" ON public.friend_requests;
CREATE POLICY "friend_requests_delete_party"
  ON public.friend_requests FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ─── messages ───────────────────────────────────────────────────────────────
-- Messages are read by either party of the friendship, or by any pack member
-- if the message belongs to a pack. We use EXISTS subqueries for the
-- membership check.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_party_or_packmember" ON public.messages;
CREATE POLICY "messages_select_party_or_packmember"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR (
      friendship_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.id = messages.friendship_id
        AND (f.user_a = auth.uid() OR f.user_b = auth.uid())
      )
    )
    OR (
      pack_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pack_members pm
        WHERE pm.pack_id = messages.pack_id
        AND pm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "messages_insert_self" ON public.messages;
CREATE POLICY "messages_insert_self"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (
        friendship_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.id = messages.friendship_id
          AND (f.user_a = auth.uid() OR f.user_b = auth.uid())
        )
      )
      OR (
        pack_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.pack_members pm
          WHERE pm.pack_id = messages.pack_id
          AND pm.user_id = auth.uid()
        )
      )
    )
  );

-- No UPDATE policy = messages are immutable. Intentional.
-- No DELETE policy = no deletion. Tighten or loosen as you see fit.

-- ─── packs ──────────────────────────────────────────────────────────────────
-- Packs come in three types: public, semi-public (both visible to all),
-- and private (visible only to members).
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packs_select_visible" ON public.packs;
CREATE POLICY "packs_select_visible"
  ON public.packs FOR SELECT
  TO authenticated
  USING (
    type IN ('public', 'semi-public')
    OR EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = packs.id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "packs_insert_self" ON public.packs;
CREATE POLICY "packs_insert_self"
  ON public.packs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
-- If your column is named `creator_id` instead of `created_by`, change above.

DROP POLICY IF EXISTS "packs_update_leader" ON public.packs;
CREATE POLICY "packs_update_leader"
  ON public.packs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = packs.id
      AND pm.user_id = auth.uid()
      AND pm.role = 'leader'
    )
  );

DROP POLICY IF EXISTS "packs_delete_creator" ON public.packs;
CREATE POLICY "packs_delete_creator"
  ON public.packs FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ─── pack_members ───────────────────────────────────────────────────────────
ALTER TABLE public.pack_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pack_members_select_authenticated" ON public.pack_members;
CREATE POLICY "pack_members_select_authenticated"
  ON public.pack_members FOR SELECT
  TO authenticated
  USING (true);
-- Tightening later: scope to members of the same pack only.

DROP POLICY IF EXISTS "pack_members_insert_self_or_leader" ON public.pack_members;
CREATE POLICY "pack_members_insert_self_or_leader"
  ON public.pack_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = pack_members.pack_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'leader'
    )
  );

DROP POLICY IF EXISTS "pack_members_update_leader" ON public.pack_members;
CREATE POLICY "pack_members_update_leader"
  ON public.pack_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = pack_members.pack_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'leader'
    )
  );

DROP POLICY IF EXISTS "pack_members_delete_self_or_leader" ON public.pack_members;
CREATE POLICY "pack_members_delete_self_or_leader"
  ON public.pack_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = pack_members.pack_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'leader'
    )
  );

-- ─── pack_join_requests ─────────────────────────────────────────────────────
ALTER TABLE public.pack_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pack_join_requests_select_self_or_leader" ON public.pack_join_requests;
CREATE POLICY "pack_join_requests_select_self_or_leader"
  ON public.pack_join_requests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = pack_join_requests.pack_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'leader'
    )
  );

DROP POLICY IF EXISTS "pack_join_requests_insert_self" ON public.pack_join_requests;
CREATE POLICY "pack_join_requests_insert_self"
  ON public.pack_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pack_join_requests_update_leader" ON public.pack_join_requests;
CREATE POLICY "pack_join_requests_update_leader"
  ON public.pack_join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = pack_join_requests.pack_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'leader'
    )
  );

DROP POLICY IF EXISTS "pack_join_requests_delete_self_or_leader" ON public.pack_join_requests;
CREATE POLICY "pack_join_requests_delete_self_or_leader"
  ON public.pack_join_requests FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pack_members pm
      WHERE pm.pack_id = pack_join_requests.pack_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'leader'
    )
  );

-- ─── Storage buckets ────────────────────────────────────────────────────────
-- Storage policies live in a different table (storage.objects). Set these up
-- in the Supabase Dashboard > Storage > Policies, NOT here. Recommended:
--
-- dog-photos bucket:
--   - SELECT: public read (photos appear in Discover for any authenticated user)
--   - INSERT: authenticated, no path restriction (you upload to dog-<id>-slot<n>)
--   - UPDATE/DELETE: authenticated, restrict by ownership if you store owner
--     in the path (current code doesn't, so this is a TODO)
--
-- pack-photos bucket: same pattern, restrict UPDATE/DELETE to pack leaders.
