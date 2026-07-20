# Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

# AGENT.md — ChatConnect

Instructions for any AI coding agent (Claude Code, Cursor, Copilot, etc.) working in this repository. Read this file in full before making changes.

## Project Summary

ChatConnect is a WhatsApp-style real-time messaging app.

- **Client**: React Native with Expo (expo-router), TypeScript
- **Backend**: Node.js + Express, TypeScript
- **Database**: MongoDB (Atlas free tier)
- **Cache / presence**: Redis (Upstash free tier)
- **Real-time**: Socket.io
- **Auth**: Firebase Phone Auth (OTP) + custom JWT session on top
- **Media storage**: Cloudinary
- **Push notifications**: Expo Notifications
- **Hosting**: Render (backend), EAS / local builds (client)

Everything runs on free tiers. Do not introduce paid services, paid API tiers, or dependencies that require a credit card, without asking first.

## Repository Layout

```
/client     — Expo app (React Native, TypeScript)
/server     — Express API (TypeScript)
/server/src/models      — Mongoose schemas
/server/src/routes      — Express route definitions
/server/src/controllers — Route handler logic
/server/src/services    — Business logic, external API calls (Firebase, Cloudinary, Socket.io)
/server/src/sockets     — Socket.io event handlers
```

(Adjust this section as the actual folder structure solidifies — keep it accurate.)

## Standing Rules for Any Agent

1. **Never touch functional logic when asked for styling changes, and vice versa.** If asked to restyle a screen, do not alter state, API calls, or business logic. If asked to fix a bug, do not redesign the UI unless explicitly requested.
2. **Never commit secrets.** No API keys, Firebase config, JWT secrets, or DB connection strings in code. All secrets go in `.env` files, which must stay in `.gitignore`. If a `.env.example` exists, keep it in sync with required variable *names* only, never values.
3. **Match the existing dark-mode finance-adjacent aesthetic** already used in the client: deep slate backgrounds, amber/gold accents, Sora (headings) and DM Mono (numeric/mono content) fonts, and the shared utility class system. Don't introduce a new design system without asking.
4. **Stay within the free-tier stack.** Don't add packages or services that require payment (e.g. don't swap Firebase Auth for Twilio, don't add a paid DB tier) without flagging it to the user first and explaining why.
5. **Persist all messages to MongoDB**, never rely on Socket.io alone for message durability. Socket.io is for real-time delivery; MongoDB is the source of truth.
6. **JWT handling**: access tokens are short-lived; refresh tokens are used for renewal. Never store tokens in AsyncStorage — always `expo-secure-store`.
7. **Follow the phased build order** in the project roadmap doc (ChatConnect_Roadmap.docx). Don't jump ahead to later-phase features (e.g. E2E encryption, groups) while earlier-phase work (e.g. core 1:1 messaging) is incomplete or untested, unless the user explicitly asks for that feature.
8. **Write TypeScript, not JavaScript**, for both client and server. Type all API request/response shapes.
9. **Keep Socket.io events and REST routes documented** as you add them — maintain a running list (either in this file or a linked `API.md`) of event names and endpoint signatures so nothing is duplicated or renamed inconsistently.
10. **Ask before large refactors.** If a task seems to require touching more than ~5 files or restructuring folders, confirm with the user first.
11. **Test auth flows manually against Firebase's test phone numbers** during development, not real SMS sends, to avoid burning the free quota.
12. **When in doubt about scope, do less.** Implement exactly what was asked; note follow-up suggestions separately rather than building them unprompted.

## Environment Variables (names only — do not hardcode values)

**Server (`/server/.env`)**

```
PORT
MONGODB_URI
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
EXPO_ACCESS_TOKEN
```

**Client (`/client/.env`)**

```
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

## Current Status

*Update this section as the project progresses so any agent picking up the repo has current context.*

- [ ] Phase 0 — Project Setup
- [ ] Phase 1 — OTP Authentication (Firebase)
- [ ] Phase 2 — Contacts & User Discovery
- [ ] Phase 3 — Core 1:1 Messaging
- [ ] Phase 4 — Presence & Notifications
- [ ] Phase 5 — Media Messages
- [ ] Phase 6 — Groups & Extras
- [ ] Phase 7 — End-to-End Encryption

## Reference

Full phase-by-phase task breakdown, deliverables, and exit criteria: see `ChatConnect_Roadmap.docx` in the project root.
