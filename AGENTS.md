# AGENTS.md

## Cursor Cloud specific instructions

This is a diploma project ("Diplom") for a 3D educational equipment visualization website. It uses a small Node.js/Express backend plus static frontend assets.

- Install dependencies with `npm install`.
- Start the app with `npm start`; the server listens on `0.0.0.0:8080` by default.
- Run checks with `npm test`.
- Equipment data lives in `data/equipment.json`.
- The SQLite database (`data/equipment.sqlite`) is created and seeded automatically on first `npm start` from `data/equipment.json`; no migrations needed.
- Default admin password is `admin123` (override with `ADMIN_PASSWORD` env var).
- There is no build step and no linter; `npm test` runs `node --check` syntax validation and verifies the browser fallback data file is in sync with `equipment.json`.
