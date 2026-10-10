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
npm ci
npm run db:generate
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

Unter `/settings/users` verwalten Admins Mitarbeiterkonten: Suche, Anlage,
Rollenwechsel, Sperrung/Entsperrung, Passwort-Reset-Mail und 2FA-Reset.
**Jede Aktion verlangt das aktuelle Passwort des ausführenden Admins.**
Das Initialpasswort eines neuen Kontos separat sicher übergeben, nicht per
E-Mail versenden; der Mitarbeiter muss es wechseln und TOTP einrichten.
Der Admin-2FA-Reset darf erst nach separat geprüfter Identität erfolgen und
erzwingt neues Enrollment. Sperrung, Rollenwechsel und 2FA-Reset widerrufen
Sitzungen und offene Reset-/2FA-Challenges. Das eigene Konto kann hier nicht
gesperrt, herabgestuft oder per 2FA-Reset zurückgesetzt werden.

### Recovery bei Verlust des einzigen Admin-Authenticators

Nur ein autorisierter Betreiber mit serverseitigem DB-/Runtime-Zugang darf
diesen Pfad verwenden. Identität über einen bereits bekannten unabhängigen
Kontakt und eine aktuelle geschützte Datenbanksicherung **vorher** prüfen.
Wenn ein weiterer aktiver Admin existiert, dessen Mitarbeiterverwaltung
verwenden; der CLI-Pfad verweigert dann die Wiederherstellung.

Die User-ID auf dem Server bestimmen, ohne Passwörter/Faktoren auszugeben:
`SELECT id FROM user WHERE role = 'Admin' AND blocked = false;`
Anschließend aus dem Vega-Root mit der serverseitigen Runtime-Konfiguration:

```sh
npm run auth:recover-admin -- <user-id> --confirm-identity-and-backup
```

Der Befehl widerruft alle Sitzungen, offenen Reset-/2FA-Challenges,
Authenticator und Recovery-Codes dieses einzigen aktiven Admins. Er ändert
weder Passwort noch Rolle und gibt keine Zugangsdaten aus. Danach mit dem
bestehenden Passwort anmelden, TOTP neu einrichten/verifizieren und die neuen
Recovery-Codes sicher außerhalb der App aufbewahren. Bei ebenfalls verlorenem
Passwort den normalen kurzlebigen Mailreset verwenden; ohne funktionsfähigen
Mailversand ist dies ein Betriebsblocker, kein Anlass für einen neuen Seed.

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

Die lokalen Allowlisten in `.env.example` erlauben auch `localhost` auf den
Frontend-Ports. `localhost` und `127.0.0.1` sind unterschiedliche Origins;
bei eigenen Dev-Ports den genauen Admin-Origin in
`BETTER_AUTH_TRUSTED_ORIGINS` und `CORS_ALLOWED_ORIGINS` ergänzen. Nach
Änderungen an `.env` den Dev-Server neu starten. Der Kundenformular-Origin
gehört nur in die CORS-Liste, nicht in die Auth-Liste.

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

Die Toolbar gruppiert Speichern, Angebotskopie, PDF und E-Mail gemeinsam;
vertikale Trenner mit seitlichem Abstand trennen Archivieren und den
Admin-only-Button „Rechnung aus Auftrag anlegen“. Dieser speichert offene
Änderungen vor der Rechnungserstellung und öffnet anschließend den Beleg.

Der PDF-Button im Auftragseditor lädt das vollständige Angebots-/Auftrags-/
Abrechnungsdokument im bisherigen `umzugruckzuck24`-Layout herunter. Änderungen
werden vor dem Export gespeichert; bei Speicher- oder PDF-Fehlern gibt es keinen
Download. Admins und Kundenberater mit abgeschlossener Anmeldung können das PDF
über `GET /api/admin/orders/:orderNumber/pdf` abrufen. Jeder erfolgreiche Export
wird im Auftragsjournal protokolliert; PDF-Dateien werden nur für die Antwort
erzeugt, nicht auf dem Server gespeichert. Logo, AGB, Bankdaten, feste Texte,
Seitennummerierung und Dateinamenskonvention entsprechen der Legacy-Vorlage.
Die Konditionssumme stammt ausschließlich aus gespeicherten Staff-Eingaben;
der Export ergänzt keine automatische Preiskalkulation. Die Zusatzpreisliste
verwendet die aktuellen Vega-Katalogpreise. Freitextpositionen bleiben ohne
erfundene Preise sichtbar; Angaben zu besonderen Möbeln verwenden die in Vega
gespeicherten Texte, ohne nicht erfasste Maße oder Gewichte zu ergänzen.

`/edit/-1` enthält die modulare Auftragserfassung nach dem
Legacy-Aufbau (Kunde, Adressen, Umzugsgut, Extras, Basis, Konditionen)
und das Journal. Buchhaltung hat keinen eigenen Auftragsreiter;
Rechnungen werden über den Admin-Button in der Toolbar angelegt.
Jeweils eine zweite Be-/Entladestelle lässt sich ergänzen und mit
der ersten tauschen; Speichern sitzt wie früher rechts oben in der Navigation.
Das Adminformular sendet `POST /api/orders`; das Kundenformular verwendet
`POST /api/public/orders` mit zusätzlicher Formular-/Datenschutzvalidierung.
Anonyme Einreichungen sind serverseitig
rate-limitiert und können keine Preise setzen. Der Server validiert die Daten,
vergibt die Auftragsnummer ab 1000 und antwortet nur mit dieser Nummer.
Angemeldete Mitarbeiter können auch unvollständige Entwürfe speichern, wie im
Legacy-Flow; anonyme Kundenanfragen müssen vollständig sein.

Die aktive Auftragsübersicht unter `/` entspricht der Legacy-Spaltenfolge und
paginiert mit zehn Einträgen. Mitarbeitende können Aufträge suchen, bearbeiten,
archivieren/wiederherstellen und Angebotskopien erstellen. Der Editor zeigt ein
minimalistisches Journal ohne Feld-Diffs. Die Rechnungsverwaltung ist Admin-only:
Blanco-Rechnungen unter `/blanco` bzw. `/invoices/new`, Rechnungen mit optionalem
1:1-Auftragsbezug über die Auftrags-Toolbar sowie Übersicht/Archiv unter
`/invoices` und `/invoices/archived`. Rechnungs-PDFs werden serverseitig aus dem
aktuellen Stand erzeugt und nicht gespeichert.

Gutschriften, Mahnungen, Rechnungsversand, reale Google-/GCS-Provider-Proofs und
die vollständige autoritative Angebotsberechnung sind weiterhin offen. Für alle
Tabellen müssen die versionierten Migrationen ausgerollt werden
(`npm run db:migrate:deploy`).

Migrationen nach Änderungen am Prisma-Schema versioniert erzeugen und deployen;
Produktion verwendet ausschließlich bereits geprüfte Migrationen:

```sh
npm run db:migrate:dev -- --name describe_change
npm run db:generate
npm run db:migrate:deploy
```

Prisma CLI, Client und MariaDB-Adapter sind auf `7.10.0` gepinnt.
`prisma-client` erzeugt ESM-TypeScript ausschließlich unter
`apps/server/src/generated/prisma/`; die Dateien sind nicht versioniert und
werden im Serverbuild nach `apps/server/dist/` kompiliert. `npm run dev`,
`npm run dev:server` und der Dev-Befehl im Server-Workspace generieren den
Client automatisch vor dem Serverstart; ebenso generiert `npm run build`
ihn vor dem Build. Für andere Befehle nach `npm ci` und nach Schemaänderungen
`npm run db:generate` explizit ausführen.
Migrationen generieren den Client nicht mehr automatisch und führen den
Admin-Seed nicht automatisch aus; dafür bleibt `npm run db:seed` zuständig.

`DATABASE_URL` bleibt die serverseitige MySQL-URL für CLI und Runtime.
Die CLI liest sie aus `prisma.config.ts`, der Server konfiguriert daraus
`PrismaMariaDb`. Generate und Build benötigen keine DB-Zugangsdaten; Start
und Datenbankbefehle ohne URL scheitern ausdrücklich.

| URL-Option | Runtime-Verhalten |
|---|---|
| `connection_limit` | Positive Anzahl, Standard: 5 Verbindungen |
| `connect_timeout` | Positive Sekunden, Standard: 5 |
| `pool_timeout` | Positive Sekunden, Standard: 10 |
| `sslaccept=strict` | TLS mit Zertifikatsprüfung über die vertrauenswürdigen CAs |
| `sslcert` | Pfad zur CA-Datei; aktiviert TLS mit Zertifikatsprüfung |

Der Pool gibt ungenutzte Verbindungen nach 300 Sekunden frei, hält keine
Mindestzahl offener Verbindungen und verwendet UTC. Credentials in der URL
müssen korrekt prozentkodiert sein. Doppelte, unbekannte URL-Optionen,
unbegrenzte Timeouts (`0`) und `sslaccept=accept_invalid_certs` werden
abgewiesen statt still ignoriert. Ohne TLS-Option ist TLS nicht aktiviert;
die tatsächliche Hostinger-Verbindungs-/CA-Konfiguration bleibt im
nichtproduktiven Zieltarif nachzuweisen.

Der Adapter pinnt upstream noch `mariadb@3.4.5`. Ein gezielter Override auf
`3.5.4` behebt die bekannten Treiber-Advisories; Hintergrund und geprüfte
Regressionen stehen in `docs/proof-01-integration-compatibility.md`.

Produktions-Build und Start:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:deployment
npm start
```

Der CI-Workflow `.github/workflows/ci.yml` nutzt Node 24 und eine separate
MariaDB 10.11.19. Er prüft zusätzlich frische Migrationen und
`npm run db:check-schema` auf Drift. `npm run lint` verwendet Oxlint für
Korrektheitsregeln; ungenutzte Deklarationen und bewusst verwendete
Steuerzeichen-RegEx sind nicht Teil dieses Gates. TypeScript-Typprüfung bleibt
ein eigener obligatorischer Schritt.

`npm run test:deployment` benötigt zuvor `npm run build`. Der Test startet einen
kurzlebigen kompilierten Express-Prozess auf einem freien lokalen Port und
prüft beide Frontends, Healthcheck und Loader. Synthetische Providerwerte dienen
nur der Startkonfiguration; der Test sendet keine Providerrequests.

Für echte Datenbanktests eine **separate leere Datenbank** mit einem Namen
endend auf `_test` anlegen; `DATABASE_URL` für den Migrationslauf und
`TEST_DATABASE_URL` für `npm run test:database` auf diese DB setzen. Niemals
die laufende App-Datenbank dafür verwenden. Der Testbefehl lehnt fehlende
oder nicht entsprechend benannte Ziele ab. Die Tests prüfen FK-Löschregeln,
Nummern-/Beziehungs-Eindeutigkeit, atomare Nummernvergabe, Snapshot-Überführung
und relationale Order-Operationen. Zusätzlich werden Datentyp-Roundtrips,
idempotentes Admin-Seeding und der Recovery-CLI-Pfad geprüft. DB-Testdateien
laufen seriell, damit Bootstrap und Sole-Admin-Recovery nicht mit anderen
Auth-Fixtures konkurrieren. Es werden keine Legacy-Daten importiert.

Auftragadressen und Möbel-/Service-/Verpackungspositionen werden relational
gespeichert und für Reads verwendet; übrige validierte Formularinformationen
bleiben im JSON-Snapshot. Die neue Migration führt bereits angelegte
Vega-Entwürfe additiv über. Die Tabellen für Gutschriften und Mahnungsereignisse
sind vorbereitet, ihre Fachoberflächen, PDF-/Mail-Flows und Purge aber noch
nicht implementiert. Rechnungs-Purge löscht diese Belege nicht kaskadierend;
sie behalten Snapshots und eigene Aufbewahrungszeiten.

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

## Optionen und Kundenformular

`/settings` speichert ausschließlich nicht geheime, Admin-bearbeitbare
Geschäftsoptionen. Alle neun Werte beginnen unkonfiguriert; es werden keine
Legacy-Werte oder Dummywerte übernommen.

| Gruppe | Werte und Verwendung |
|---|---|
| Kartonvolumen | `boxCbm`, `kleiderboxCbm`: Möbelrechner und serverseitige Volumenberechnung |
| Standort | `origin`: Betriebsadresse für Depot → Be-/Entladestellen → Depot |
| Formularlinks | `dataPrivacyUrl`, `successUrl`, `boxCalculatorUrl`: Datenschutzerklärung, optionale Erfolgsweiterleitung und Kartonrechner |
| Mail | `companyEmail`, `emailFromName`, `emailFromAddress`: Firmenbenachrichtigung, Anzeigename und Prüfung gegen die authentifizierte Hostinger-Mailbox |
| Globale Preise | Bestehende elf Leistungsraten; derselbe Editor wie unter Leistungen |
| Nummernkreis | Separat gespeicherte nächste `R-`-Rechnungsnummer mit Konflikt- und Belegprüfung |

Optionen werden revisionsgeschützt gespeichert. Eine zwischenzeitliche
Änderung erfordert Neuladen statt stilles Überschreiben. Ein
Gutschriftennummernkreis bleibt bis zur Umsetzung dieses Fachmoduls offen;
ungenutzte Legacy-Konstanten werden nicht als funktionslose Felder angezeigt.

Das lange Kundenformular enthält die fünf Legacy-Schritte und den ausdrücklich
freigegebenen eingebetteten Möbel-/Volumenrechner. Ohne Datenschutz-URL bleibt
das Absenden gesperrt. Fehlende Kartonvolumina erzeugen eine Warnung für die
unvollständige Volumenberechnung; sie werden nicht als konfiguriert angenommen.
Die Öffentlichkeit erhält nur die Formularlinks, Kartonvolumina und
Provider-Verfügbarkeitsflags unter `/api/customer-form/config`, keine
internen Standort-, Mail- oder Zugangsdaten.

Google Places und die auf Benutzeraktion gestartete Admin-Streckenberechnung
benötigen `GOOGLE_PLACES_API_KEY` bzw. `GOOGLE_ROUTES_API_KEY` ausschließlich
in der Server-Runtime. Die Google-Aufrufe erfolgen serverseitig; manuelle
Adresseingabe und manuelle Streckenangabe bleiben ohne Provider möglich.

Für Bilder `GCS_BUCKET`, optional `GOOGLE_CLOUD_PROJECT` und externe
Application Default Credentials konfigurieren. `GOOGLE_APPLICATION_CREDENTIALS`
kann auf eine außerhalb des Repositorys verwaltete Credential-Datei zeigen.
Der Bucket muss in einer zugelassenen EU-Region liegen, Uniform Bucket-Level
Access und erzwungene Public Access Prevention nutzen sowie genau eine
unbedingte Delete-Lifecycle-Regel nach 180 Tagen besitzen. Die CORS-Konfiguration
muss den Upload von den tatsächlich erlaubten Formular-Origins zulassen.
Ohne diese Konfiguration wird kein Ersatzspeicher verwendet.

Der Browser komprimiert zu JPEG (höchstens 2000 Pixel je Kante und 10 MiB) und
lädt über eine 15 Minuten gültige Signed-POST-Policy. Der Server prüft die
tatsächlichen Bytes und fixiert eine unveränderliche finale Objektgeneration.
24 Stunden gültige Claims werden atomar beim Anlegen der Anfrage verbraucht.
Auftragskopien behalten eigene Referenzen auf dieselben privaten Objekte;
Orderlöschung entfernt keine GCS-Objekte. Mitarbeitende erhalten kurzlebige
Leselinks. Reale GCS-/CORS-Nachweise sind noch erforderlich.

Für WordPress nach dem Produktionsbuild das von Vega ausgelieferte Script
`/customer-form/loader.js` von der tatsächlichen `APP_BASE_URL` einbinden.
Der Loader erzeugt den Mountpoint und absolute Asset-/API-Pfade ohne iframe.
Den tatsächlichen WordPress-Origin in die Runtime-Allowlist aufnehmen und
Einbettung, Styles und CSP dort prüfen; keine Domains in Vite einbrennen.

## Struktur

```text
apps/server/         Express 5, Better Auth, Prisma, Laufzeitkonfiguration
apps/admin/          React 19 / Vite / MUI Login, Passwortwechsel und TOTP
apps/customer-form/  React 19 / Vite Kundenformular
packages/domain/     Geteilte fachliche Typen und DTOs
prisma/              Auth-/Fachschema und versionierte MySQL-Migrationen
docs/                Architektur, ADRs und Umsetzungsplan
```

Der aktuelle Funktions- und Restarbeitsstand steht verbindlich in
`docs/implementation-status.md`. Hostinger-Cron, Provider-End-to-End-Proofs,
der reale GCS-Proof und die noch offenen Fachbereiche bleiben nachgelagerte Arbeitspakete.
