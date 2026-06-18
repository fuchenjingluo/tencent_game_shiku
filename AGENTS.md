# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React + TypeScript game project with Phaser handling the game world. Main application code lives in `src/`. React UI is under `src/components/`, Phaser scenes and map logic are under `src/phaser/`, shared types are in `src/types/`, game data and balancing logic are in `src/data/`, audio helpers are in `src/audio/`, and event wiring is in `src/events/`. Design and gameplay notes live in `docs/`. Build output goes to `dist/` and dependencies to `node_modules/`; do not edit or commit generated output.

## Build, Test, and Development Commands
- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the Vite dev server on `0.0.0.0` for local playtesting.
- `npm run build`: run TypeScript project checks, then create a production build in `dist/`.
- `npm run preview`: serve the production build locally for verification.
- `npm test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode while developing.

## Coding Style & Naming Conventions
Use TypeScript modules with React function components where possible. Match the existing style: 2-space indentation, single quotes, no semicolons, and named exports for reusable helpers. Components and classes use `PascalCase` (`HUD`, `GameScene`), hooks use `useX`, and data/helper modules use descriptive camelCase names. Keep Phaser-specific logic in `src/phaser/` and UI state/panels in `src/components/`; communicate across boundaries through existing helpers such as `bus` instead of tight coupling.

## Testing Guidelines
Vitest is configured, but this repository currently has no committed test files. Add tests close to the code they cover using `*.test.ts` or `*.test.tsx`, especially for pure logic in `src/data/`, save handling in `src/hooks/`, and event-driven behavior that can be isolated from Phaser rendering. Run `npm test` before submitting changes and use `npm run build` to catch TypeScript regressions.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commits with concise summaries, including `fix:` for bug fixes and `feat:` for gameplay additions. Keep the same pattern: `feat:`, `fix:`, `docs:`, `refactor:`, or `test:` followed by a short description, for example `fix: correct NPC wall collision`. Pull requests should include the gameplay or UI impact, test/build results, linked issues when available, and screenshots or short clips for visible changes.

## Security & Configuration Tips
Do not commit local logs, saves, generated builds, or dependency folders. Keep browser-only state in local storage/save helpers and avoid introducing secrets into client-side code.
