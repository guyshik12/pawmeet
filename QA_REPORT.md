# Sniffs — QA Report

**Date:** 2026-05-25
**Bar:** Park test (10 friendly strangers at a local dog park can install the app, make a profile, and use the core flow without crashing or seeing something embarrassing).
**Not the bar:** App Store launch. Polish, edge cases, and animation perfection are explicitly out of scope here.

The rule for every item below is the same: if a friendly stranger handing you their phone after using your app would think *"that's weird"* or *"that didn't work,"* it's in scope. If they would never notice, it isn't.

---

## RED — Fix before the park test

These will either crash, leak data, or cause the very first user interaction to fail. Don't run the test until these are green.

### R1. Branding is three different names

| Source | Name |
|---|---|
| App icon label (`config/app.js` → `APP_NAME`) | **PawMeet** |
| App display name (`app.json` → `expo.name`) | **Sniffs** |
| Repo + READMEs | **Sniffs** |
| Slug | **DogPark** (`app.json`) vs **pawmeet** (`app.config.ts`) |
| iOS bundle ID | `com.pawmeet.app` |

When a stranger taps the icon labeled "PawMeet" but you've been pitching them "Sniffs," that's a 5-second confusion right at the start. Pick one name, propagate it through `config/app.js`, `app.json`, `app.config.ts`, README, and APP_GUIDE.

### R2. Two competing Expo configs

`app.json` and `app.config.ts` both exist. They disagree on:

- **Slug** (`DogPark` vs `pawmeet`)
- **Plugins** — `app.json` only lists `@react-native-community/datetimepicker`; `app.config.ts` lists location, image-picker, and notifications.

When both files are present, `app.config.ts` wins for Expo, but anything that reads `app.json` directly (some EAS tooling, copy-paste config docs, future-you in three months) will see the wrong picture. **Delete `app.json` and let `app.config.ts` be the single source of truth.**

### R3. Registration is brittle in three different ways

`src/screens/auth/RegisterScreen.tsx`:

```ts
const { data, error } = await supabase.auth.signUp({ ... });
if (error) { ... }
if (data.user) await supabase.from('profiles').insert({ id: data.user.id, name }).single();
Alert.alert('Welcome!', 'Account created. Sign in to continue.');
navigation.navigate(Routes.Login);
```

Three problems:

1. **Email confirmation ambiguity.** If Supabase has email confirmation ON, the user gets the "Welcome! Sign in" alert but actually needs to click an email link first. They'll tap Sign In, fail, and assume the app is broken. Verify in the Supabase dashboard whether confirmation is ON; if it is, either turn it off for the park test or update the UI to say "check your email."
2. **The profile insert error is silently dropped.** If RLS denies the insert, or any other failure, the user ends up authenticated with no `profiles` row. The next call to `getProfile()` throws — and `RootNavigator` swallows that too (`catch (_) {}`). User lands on Discover with `profile: null` and the app silently misbehaves.
3. **Race condition.** If email confirmation is OFF, `signUp` returns a session immediately. The `onAuthStateChange` listener in `RootNavigator` fires while the profile insert is still in flight. Sometimes you'll race past the insert and land logged-in with no profile.

**Fix:** await `signUp`, await `insert`, surface insert errors, and only THEN navigate. Or even better, use a Supabase database trigger to auto-create the `profiles` row on `auth.users` insert and stop relying on the client.

### R4. No "create first dog" gate

`README.md` claims: *"After registration, you're prompted to create your first dog profile."*

I cannot find this anywhere in the code. A newly registered user with zero dogs lands on the Discover tab, sees "No dogs nearby" (which is technically true but misleading), and has no idea they need to go to Profile and create a dog before anything works. This is the single most likely "huh?" moment in the entire flow.

**Fix:** If `dogs.length === 0` after auth, force the user through `AddEditDogModal` before showing any tabs. Block it. The whole app is unusable without a dog and the current UI doesn't say so.

### R5. No global error boundary

`App.tsx` has no `ErrorBoundary`. A single render exception in any deep screen produces a white screen of death with no way to recover except force-quit. Given the amount of `(x as any)?.field ?? 'fallback'` defensive code in the realtime listeners (look at `AppTabs.tsx` lines 244–293), you've clearly hit nulls before. One unguarded one and the whole app dies for that user.

**Fix:** wrap `RootNavigator` in a simple error boundary that renders "Something went wrong, tap to restart."

### R6. RLS status is unverifiable from the code

`supabase/` contains exactly one file: an edge function. **No migrations, no schema.sql, no config.toml.** That means your entire database schema and every RLS policy lives only in the Supabase dashboard, with no version control and no way for me to verify it from the repo.

This matters a lot because the `EXPO_PUBLIC_SUPABASE_ANON_KEY` ships in the app binary. The moment a friendly stranger has your app on their phone, that key is in their wallet. If RLS isn't strictly enforced on every table, that user (or anyone they share the key with) can read:

- Every user's profile, push_token, email-linked id
- Every user's GPS coordinates in real time (the `locations` table)
- Every DM in `messages`
- Every pack and every pack member

**Before the park test, log into Supabase and confirm, table by table, that RLS is ON and the policies make sense for the operations the app actually does.** Tables to check: `profiles`, `dogs`, `locations`, `friendships`, `friend_requests`, `messages`, `packs`, `pack_members`, `pack_join_requests`. Also confirm the `dog-photos` and `pack-photos` storage buckets have policies that prevent random users from overwriting each other's images.

Bonus task while you're there: `supabase db dump` the schema and check it into the repo so future-you can reason about it.

---

## YELLOW — Won't kill the test, but you'll wish you'd known

### Y1. Trip Mode polling soup

While a trip is active, you have:

- `watchPositionAsync` every 5s / 5m
- `getCurrentPositionAsync` polling every 10s (the comment says "watchPositionAsync doesn't always fire in simulators" — that's a *simulator* problem, you don't need this fallback on a real phone)
- `fetchActiveTripDogs` polling every 8s
- `friend_requests` polling every 4s
- Two realtime channels (locations + friend_requests)

Plus the always-on `AppTabs`-global polling: friendships every 4s, badge_count every 15s, realtime on badge_count. Plus React Query's `focusManager` refetching on every app-foreground.

A 30-minute walk on this will heat the phone and burn Supabase egress. For 10 testers on one walk, survivable. For a real launch, you'll get "the app drains my battery" reviews. Cut the simulator-only `locationPollRef`, lengthen `fetchActiveTripDogs` to 15–20s, and trust the realtime channel for `friend_requests`.

### Y2. Search bar is a fake door

`DiscoveryHubScreen.tsx` line 314 renders a prominent search bar that, on tap, shows `Alert.alert('Coming soon', 'Search is coming in the next update!')`. Your README and APP_GUIDE both describe search as a working feature. Testers will tap it. Either hide the bar for the test or wire it up. (Note: `FriendsScreen` does have search via `SearchOverlay` — so search exists, just not on the Hub.)

### Y3. Silent failure on Trip Mode "Say Hi"

`WalksScreen.tsx` line 545:

```ts
try { await handleDogLike(...); ... } catch {}
```

If the like fails, you set `connected = true` and dismiss the sheet, telling the user "Woof Sent!" — but nothing happened. Show a toast on error.

### Y4. Two Discover code paths

`src/screens/discover/` contains both `DiscoverScreen.tsx` (the legacy one) and `DiscoveryHubScreen.tsx` + `QuickMatchScreen.tsx` (the new flow that's actually wired into the navigator). The legacy one is dead code. Delete it before you confuse yourself debugging a tester's screenshot.

### Y5. Image upload accepts HEIC

`utils/imageUpload.ts` derives content-type from the file extension (`image/${ext === 'jpg' ? 'jpeg' : ext}`), so a HEIC from an iPhone is uploaded as `image/heic`. Supabase storage accepts it; React Native `Image` may not render it on Android. Force the export to JPEG via `ImagePicker` options or transcode before upload.

### Y6. Dog parks endpoint is Tel Aviv only

`WalksScreen.tsx` line 48 hardcodes `https://gisn.tel-aviv.gov.il/...`. Outside Tel Aviv, the request 404s, `dogParksError` is set, and the idle screen says "Park markers unavailable (network error)." If your park test is in Tel Aviv, fine. If it isn't, change the copy to something like "No park data for your area" so testers don't think the app is broken.

### Y7. Empty/loading states are inconsistent

DiscoveryHub renders text-only "Loading..." in three places. QuickMatch uses a real `ActivityIndicator`. FriendsScreen does its own thing. Pick a pattern.

---

## GREEN — Defer

- `console.log('[Hub] Pack tapped:', pack.name)` in `DiscoveryHubScreen.tsx:209` — strip before launch but it's invisible to testers.
- No unit/integration tests anywhere. Doesn't matter for the park test.
- Photo reorder is a swap, not a true list reorder. Power-user nitpick.
- Visual theme inconsistency: DiscoveryHub uses a dark "Midnight Park" theme while everything else is light. Cohesion issue for a real launch, not for the test.
- `RootNavigator` swallows `getProfile` errors silently. Already covered by R3.
- Multiple realtime channels could be unified into one. Optimization, not a bug.

---

## The shortlist, in order

If you have a long weekend, this is the order:

1. **R6** — Verify RLS in Supabase. This is the only one that has a security tail. Do it first.
2. **R3 + R4** — Fix the registration → first-dog flow. If a stranger can't get to Discover with a dog they made, the test is over before it starts.
3. **R1 + R2** — Pick one name, delete `app.json`. Half-hour change.
4. **R5** — Add an error boundary. Twenty minutes.
5. **Y2** — Either hide the fake search bar or admit "Coming soon" right on it.
6. **Y3** — Surface the Trip Mode like error.

Everything else can wait until after the park test, because the point of the park test is to learn what to fix next — and humans will surface real issues you don't have on this list.

---

## After this is done

The deal we made: park test within 14 days. The point of fixing R1–R6 isn't to launch — it's to clear the table so the test produces real signal instead of "couldn't get past the signup screen." If after fixing these you're still stuck, that's no longer a QA problem, and we should talk about it as the launch-anxiety thing it is.
