# ddotsjobs mobile (Expo / React Native)

Native iOS + Android app. Shares the backend via the web app's tRPC `AppRouter`
type; native UI with React Navigation + zustand.

> **Isolated from the pnpm workspace on purpose.** `pnpm-workspace.yaml` excludes
> `apps/mobile` (`- "!apps/mobile"`) so the web/worker `pnpm install
> --frozen-lockfile` + turbo build are never affected by React Native deps.
> Install and run this app on its own (below), ideally on macOS for iOS.

## Setup

```bash
cd apps/mobile
npm install            # its own node_modules, separate from the repo
npx expo install       # reconcile native dep versions for the Expo SDK
npm start              # Metro; press i (iOS sim) / a (Android) / scan in Expo Go
```

Backend URL is `app.json > expo.extra.apiUrl` (defaults to https://ddotsjobs.com).
Point it at a LAN dev server for local development.

## What works today

- **Jobs** tab: browse + search live jobs (`jobs.list`), open a job
  (`jobs.getBySlug`) — these are public procedures, no auth needed.
- **Saved / Chat / Profile** tabs: fully wired to `jobs.getSavedJobs`,
  `chat.getConversations` / `getMessages` / `sendMessage`, `seeker.getProfile`,
  and gated behind a session token. They render a sign-in notice until auth
  exists (see below). Chat uses polling (3s thread / 10s inbox), matching web.
- Offline: last jobs list cached in zustand (`lib/store.ts`).

## Backend follow-ups (required for authed features)

1. **Mobile token auth.** The web authenticates via next-auth cookies, which a
   native app can't reuse. Expose a bearer-token login (e.g. `auth.mobileLogin`
   returning a signed token; validate `Authorization: Bearer` in the tRPC
   context). The client already sends the stored token (`lib/trpc.ts` +
   `lib/auth.ts`) and `LoginScreen` is ready to call a real OTP flow.
2. **Shared `AppRouter` type.** `lib/trpc.ts` imports the type via a relative
   path into `apps/web`. Extract `AppRouter` into a standalone
   `packages/api`-style package for a clean, robust build.
3. **Push notifications.** Add `expo-notifications`, register the Expo push
   token on login, store it in a `device_tokens` table, and send from the
   worker's notification/email jobs (new message / job alert / application).

## Build & submit (EAS — run on a machine with an Expo account)

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build --platform ios       # needs an Apple Developer account
eas build --platform android   # produces an .aab for Play
eas submit --platform ios
eas submit --platform android
```

## Status

Scaffold: navigation, screens, tRPC/query/auth wiring, theme, offline store.
Not yet done here (needs a device/simulator + Expo account): running the app,
EAS builds, store submission, and the backend token-auth + push endpoints above.
