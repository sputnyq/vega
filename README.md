# Vega

Node.js-Monorepo für die Vega-Anwendung gemäß `docs/implementation-plan.md`.
Ein Express-Server stellt API und beide getrennten Vite-Builds bereit. Die
Admin-App verwendet Better Auth mit Prisma, E-Mail/Passwort und verpflichtendem
TOTP. WordPress bleibt CMS und Einbettungsfläche.

## Voraussetzungen

- Node.js 24 LTS und npm 11 oder neuer (siehe `engines`)
- Docker Engine mit Docker Compose
- Für lokale Entwicklung: `.env` aus `.env.example` anlegen und die markierten
  Auth-/Bootstrapwerte setzen

```sh
cp .env.example .env
# BETTER_AUTH_SECRET mit `openssl rand -base64 32` erzeugen und in .env setzen.
# INITIAL_ADMIN_EMAIL und INITIAL_ADMIN_PASSWORD nur für den einmaligen Seed setzen.
npm install
npm run db:up
npm run db:migrate:dev
npm run db:seed
npm run dev
```

Der Seed erstellt einmalig den Better-Auth-Admin mit dem Anzeigenamen
`root_user`, der in `INITIAL_ADMIN_EMAIL` gesetzten Login-E-Mail und dem
`INITIAL_ADMIN_PASSWORD`. Passwörter werden serverseitig gehasht; der Seed gibt
keine E-Mail-Adresse oder Passwörter aus. Nach erfolgreichem Seed
`INITIAL_ADMIN_EMAIL` und `INITIAL_ADMIN_PASSWORD` aus der Runtime-Konfiguration
entfernen. Ein erneuter Seed ändert vorhandene Konten oder Passwörter nicht.

Beim ersten Login muss der Admin das Initialpasswort ändern und TOTP mit einem
Authenticator einrichten/verifizieren. Erst danach werden Admin-APIs
freigeschaltet. Mitarbeiter-E-Mail-Adressen werden nicht verifiziert; eine
öffentliche Registrierung ist deaktiviert. Sessions laufen absolut nach 30
Tagen ab und werden bei Aktivität nicht verlängert.

Jedes neu gesetzte Passwort benötigt mindestens 8 Zeichen und muss mindestens
einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.

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
- Admin-SPA: <http://127.0.0.1:5173/> (unauthenticated users are redirected to `/login`; TOTP challenges use `/two-factor`; unknown paths show the 404 page)
- Kundenformular: <http://127.0.0.1:5174/customer-form/>

Admin-Routen übernehmen den Legacy-Pfadbestand (`/`, `/edit/:id`, `/blanco`,
`/settings/*`, `/email-text/:id`) und ergänzen `/invoices`,
`/invoices/archived`, `/orders/archived` und `/profile`. Einstellungen sind in
`/settings` (Optionen), `/settings/content/*` (Möbel, Kategorien, Angebote,
Verpackung, Leistungen) und `/settings/users` (User Management) gegliedert;
bestehende `/settings/furniture`- und ähnliche Pfade bleiben kompatible Aliase.
Die Content-Seiten Möbel, Kategorien, Angebote, Verpackung und Leistungen sind
an Admin-CRUD-Endpunkte angeschlossen.

Öffentliche Safe-DTO-GETs für das eingebettete Formular:
`/api/catalog/categories`, `/api/catalog/furniture`, `/api/catalog/offers`,
`/api/catalog/packings`, `/api/catalog/services` und
`/api/catalog/service-rates`. Diese GETs benötigen keine Anmeldung; ausgeblendete
Verpackungen und Leistungen (`show=false`) sind öffentlich nicht enthalten.
Änderungen laufen ausschließlich über `/api/admin/catalog/*` und erfordern eine
abgeschlossene Admin-Session.

`/edit/-1` enthält die modulare, siebenteilige Auftragserfassung nach dem
Legacy-Aufbau (Kunde, Adressen, Umzugsgut, Extras, Basis, Konditionen,
Buchhaltung). Jeweils eine zweite Be-/Entladestelle lässt sich ergänzen und mit
der ersten tauschen; Speichern sitzt wie früher rechts oben in der Navigation.
Das Formular sendet `POST /api/orders`; derselbe Endpunkt ist für das
Kundenformular ohne Login offen. Anonyme Einreichungen sind serverseitig
rate-limitiert und können keine Preise setzen. Der Server validiert die Daten,
vergibt die Auftragsnummer ab 1000 und antwortet nur mit dieser Nummer.
Angemeldete Mitarbeiter können auch unvollständige Entwürfe speichern, wie im
Legacy-Flow; anonyme Kundenanfragen müssen vollständig sein.

Die aktive Auftragsübersicht unter `/` entspricht der Legacy-Spaltenfolge und
paginiert mit zehn Einträgen. Mitarbeitende können Aufträge suchen, bearbeiten,
archivieren/wiederherstellen und Angebotskopien erstellen. Der Editor zeigt ein
minimalistisches Journal ohne Feld-Diffs. Die Rechnungsverwaltung ist Admin-only:
Blanco-Rechnungen unter `/blanco` bzw. `/invoices/new`, Rechnungen mit optionalem
1:1-Auftragsbezug aus dem Buchhaltungsreiter sowie Übersicht/Archiv unter
`/invoices` und `/invoices/archived`. Rechnungs-PDFs werden serverseitig aus dem
aktuellen Stand erzeugt und nicht gespeichert.

Kartenintegration, Uploads, Gutschriften, Mahnungen, Rechnungsversand und die
vollständige autoritative Angebotsberechnung sind weiterhin offen. Für alle
Tabellen müssen die versionierten Migrationen ausgerollt werden
(`npm run db:migrate:deploy`).

Migrationen nach Änderungen am Prisma-Schema versioniert erzeugen und deployen;
Produktion verwendet ausschließlich bereits geprüfte Migrationen:

```sh
npm run db:migrate:dev -- --name describe_change
npm run db:migrate:deploy
```

Produktions-Build und Start:

```sh
npm run typecheck
npm test
npm run build
npm start
```

Der Server benötigt `APP_BASE_URL`, `BETTER_AUTH_URL`, ein starkes
`BETTER_AUTH_SECRET` (mindestens 32 Zeichen) und
`BETTER_AUTH_TRUSTED_ORIGINS`. `CORS_ALLOWED_ORIGINS` ist eine kommaseparierte
Liste exakter Origins (Schema, Host und Port, ohne Pfad oder Wildcard). In
Produktion müssen öffentliche Origins HTTPS verwenden. Browser-Builds erhalten
keine Vega- oder WordPress-Domain als Build-Variable.

Für produktiven Mailversand sind außerdem zwingend
`HOSTINGER_MAIL_API_TOKEN` und `HOSTINGER_MAILBOX_RESOURCE_ID` als reine
Server-Runtime-Secrets zu setzen. Ein leerer optionaler
`HOSTINGER_MAIL_API_BASE_URL` verwendet den Standard
`https://api.mail.hostinger.com`.

## Struktur

```text
apps/server/         Express 5, Better Auth, Prisma, Laufzeitkonfiguration
apps/admin/          React 19 / Vite / MUI Login, Passwortwechsel und TOTP
apps/customer-form/  React 19 / Vite Kundenformular
packages/domain/     Geteilte fachliche Typen und DTOs
prisma/              Better-Auth-Schema und versionierte MySQL-Migrationen
docs/                Architektur, ADRs und Umsetzungsplan
```

Der aktuelle Funktions- und Restarbeitsstand steht verbindlich in
`docs/implementation-status.md`. Hostinger-Cron, Provider-End-to-End-Proofs,
GCS und die noch offenen Fachbereiche bleiben nachgelagerte Arbeitspakete.
