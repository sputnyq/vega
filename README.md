# Vega

Node.js-Monorepo für die Vega-Anwendung gemäß `docs/implementation-plan.md`.
Ein Express-Server stellt später API und beide gebauten Frontends bereit; Admin
und Kundenformular bleiben getrennte Vite-Builds. WordPress bleibt CMS und
Einbettungsfläche.

## Voraussetzungen

- Node.js 24 LTS und npm 11 oder neuer (siehe `engines`)
- Docker Engine mit Docker Compose
- Für lokale Entwicklung: `.env` aus `.env.example` anlegen

```sh
npm install
npm run db:up
npm run dev
```

Die lokale Datenbank ist **MariaDB 10.11.19** und wird über
`docker-compose.yml` gestartet und nur an `127.0.0.1:3307` veröffentlicht
(intern weiterhin Port 3306). Hostinger bestätigt für seine Web-/Cloud-
Hostingtarife MariaDB ([Hostinger-Support](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/)), veröffentlicht in der Support-Dokumentation aber keine
konkrete Serverversion. MariaDB 10.11.19 war der aktuelle 10.11-LTS-Patch laut
[MariaDB-Veröffentlichung vom 24. August 2026](https://mariadb.org/mariadb-server-12-3-11-8-11-4-and-10-11-q3-2026-maintenance-releases-and-goodbye-10-6/). Die 10.11-Reihe ist daher die lokale Kompatibilitäts-
Basis (sie entspricht auch der MariaDB-Reihe der alten App), keine Behauptung
über Hostingers exakten Patchstand. Diesen vor dem Deployment direkt auf der
Hostinger-Datenbank prüfen:

```sql
SELECT VERSION();
```

Zum Stoppen der lokalen Datenbank ohne Löschen der Daten: `npm run db:down`.
Die Compose-Volume `vega-mariadb-data` bleibt dabei erhalten. Zugangsdaten aus
`.env.example` sind ausschließlich lokale Platzhalter und dürfen nicht für
Produktion verwendet werden.

Lokale URLs:

- Express API/Healthcheck: <http://127.0.0.1:3000/health>
- Admin-SPA: <http://127.0.0.1:5173/admin/>
- Kundenformular: <http://127.0.0.1:5174/customer-form/>

Produktions-Build und Start:

```sh
npm run typecheck
npm test
npm run build
npm start
```

Der Server benötigt `APP_BASE_URL`; Browser-Builds erhalten keine Vega- oder
WordPress-Domain als Build-Variable. `CORS_ALLOWED_ORIGINS` ist eine
kommaseparierte Liste exakter Origins (Schema, Host und Port, ohne Pfad oder
Wildcard). In Produktion müssen öffentliche Origins HTTPS verwenden.

## Struktur

```text
apps/server/         Express 5, Laufzeitkonfiguration, Healthcheck, Static Hosting
apps/admin/          React 19 / Vite / MUI Admin-Platzhalter
apps/customer-form/  React 19 / Vite Kundenformular-Platzhalter
packages/domain/     Geteilte fachliche Typen und DTOs
prisma/              Für das spätere relationale Schema reserviert
docs/                Architektur, ADRs und Umsetzungsplan
```

Das ist das Plattform-Grundgerüst (Arbeitspaket A1), keine fertige
Produktivfunktion. Hostinger-Laufzeit, Cron, Auth, Datenbank, API-Verträge,
Mail und GCS müssen in den nachfolgenden Arbeitspaketen separat umgesetzt und
verifiziert werden.
