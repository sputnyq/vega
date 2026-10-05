# ADR 0001: Eine modular aufgebaute Hostinger-Node-App

- **Status:** Akzeptiert
- **Datum:** 2026-10-05

## Kontext

Der bisherige Funktionsumfang ist über WordPress/PHP, mehrere React-SPAs, ein TypeScript-Core-Paket und einen separaten Express-Mail-Proxy verteilt. Ziel ist eine einzelne Node.js-App mit Hostinger MySQL und vorhandenen WordPress-Seiten als Content-/Einbettungsfläche.

## Entscheidung

Ein Root-Repository mit einer modularen Node-App und einem Produktionsdeployment. Express 5 liefert APIs, Better Auth, Admin-SPA und den Formularloader/-build aus. Vorgaben: Node 24 LTS, TypeScript 7, Vite, React 19, aktuelles MUI, Prisma/MySQL.

## Folgen

- Kein separater Mail-Proxy und kein WordPress-Datenbackend im Zielsystem.
- Vite-Builds bleiben getrennte Frontends, aber keine getrennten Server.
- Gemeinsame DTOs/Validierung liegen in einem internen Package.
- Pakete und Hostinger-Laufzeit werden in einer festen Lockfile-/Engine-Kombination geprüft.
- Managed Hostinger Deployment und tägliche Cron-Ausführung müssen im Integrations-Proof validiert werden.
