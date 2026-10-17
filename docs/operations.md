# Betrieb und Konfiguration

Betriebswissen für Entwicklung und Hostinger-Betrieb. Fachregeln stehen in
`implementation-plan.md`, `target-architecture.md` und den ADRs.

## Runtime-Konfiguration

Alle Werte sind serverseitige Runtime-Variablen (Vorlage: `.env.example`). Keine
Domains oder Secrets in Vite-Builds.

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | MySQL/MariaDB-URL für Prisma-CLI und Server |
| `APP_BASE_URL`, `BETTER_AUTH_URL` | Öffentliche Basis-URL der App |
| `BETTER_AUTH_SECRET` | Zufälliges Secret, mindestens 32 Zeichen (`openssl rand -base64 32`) |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Exakte Admin-Origins |
| `CORS_ALLOWED_ORIGINS` | Exakte Origins inkl. WordPress/Kundenformular; in Produktion HTTPS |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Nur für den einmaligen Seed, danach entfernen |
| `HOSTINGER_MAIL_API_TOKEN`, `HOSTINGER_MAILBOX_RESOURCE_ID` | Mailversand; ohne sie antwortet Versand mit `503 MAIL_NOT_CONFIGURED` |
| `HOSTINGER_MAIL_API_BASE_URL` | Optional, Standard `https://api.mail.hostinger.com` |
| `GOOGLE_MAPS_API_KEY` | Places-Proxy und Admin-Route; ohne Key bleibt manuelle Eingabe |
| `GCS_BUCKET`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS` | Bild-Uploads (siehe `gcs-bucket-setup.md`) |

`localhost` und `127.0.0.1` sind unterschiedliche Origins. Der Kundenformular-Origin
gehört nur in `CORS_ALLOWED_ORIGINS`. Nach Änderungen an `.env` den Server neu starten.

### `DATABASE_URL`-Optionen

| Option | Verhalten |
|---|---|
| `connection_limit` | Standard 5 |
| `connect_timeout` | Sekunden, Standard 5 |
| `pool_timeout` | Sekunden, Standard 10 |
| `sslaccept=strict` | TLS mit Zertifikatsprüfung |
| `sslcert` | Pfad zur CA-Datei; aktiviert TLS |

Unbekannte/doppelte Optionen, Timeouts `0` und `sslaccept=accept_invalid_certs`
werden abgewiesen. Credentials in der URL prozentkodieren.

## Datenbank

Lokal läuft **MariaDB 10.11.19** per Docker Compose auf `127.0.0.1:3307`.
Hostinger nennt MariaDB, aber keine Version
([Hostinger-Support](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/));
vor dem Deployment auf der Zieldatenbank `SELECT VERSION();` prüfen.

```sh
npm run db:migrate:dev -- --name describe_change   # neue Migration
npm run db:generate                                  # Prisma-Client nach Schemaänderung
npm run db:migrate:deploy                            # geprüfte Migrationen ausrollen
npm run db:check-schema                              # Drift-Prüfung
```

Prisma 7.10.0 generiert nach `apps/server/src/generated/prisma/` (nicht
versioniert). `dev` und `build` generieren automatisch. Migrationen seeden nicht;
dafür `npm run db:seed`. Der `mariadb@3.5.4`-Override ist in
`proof-01-integration-compatibility.md` begründet.

Die Migration `20261016150000_document_revisions` muss vor dem neuen
Serverstand ausgerollt sein. Sie ergänzt `Order.revision` und
`Invoice.revision` mit Startwert `0`; alte offene Bearbeitungsseiten müssen
neu geladen werden. PUTs ohne Revision werden mit `400`, überholte Stände
mit `409` abgewiesen.

## Erstadmin

`npm run db:seed` legt einmalig `root_user` mit `INITIAL_ADMIN_EMAIL` und
`INITIAL_ADMIN_PASSWORD` an; ein erneuter Seed ändert nichts. Beim ersten Login
Initialpasswort ändern und TOTP einrichten.

## Recovery bei Verlust des einzigen Admin-Authenticators

Nur für autorisierte Betreiber mit Server-/DB-Zugang. Vorher Identität über einen
unabhängigen Kontakt und eine aktuelle DB-Sicherung prüfen. Gibt es einen weiteren
aktiven Admin, dessen Mitarbeiterverwaltung nutzen (2FA-Reset); die CLI verweigert dann.

```sql
SELECT id FROM user WHERE role = 'Admin' AND blocked = false;
```

```sh
npm run auth:recover-admin -- <user-id> --confirm-identity-and-backup
```

Widerruft Sitzungen, Challenges, Authenticator und Recovery-Codes; Passwort und
Rolle bleiben. Danach anmelden und TOTP neu einrichten. Bei verlorenem Passwort
den Mailreset nutzen – ohne Mailversand ist das ein Betriebsblocker, kein Grund
für einen neuen Seed.

## Tests

```sh
npm run typecheck && npm run lint && npm test && npm run build
npm run test:deployment   # nach build: startet den kompilierten Server
```

DB-Tests nur gegen eine **separate leere Datenbank mit Namen auf `_test`**:
Migrationen mit `DATABASE_URL` darauf ausrollen, dann
`TEST_DATABASE_URL=… npm run test:database`. Niemals die App-Datenbank verwenden.
Die Regressionen umfassen echte konkurrierende Auftrags-/Rechnungs-PUTs:
genau ein Update muss erfolgreich sein, das andere muss `409` liefern,
ohne Teiländerungen an Beziehungen. UI-Interaktionen laufen lokal mit
jsdom; sie ersetzen keinen Browser-/WordPress-Proof.

Die Suite priorisiert Fachregeln, Berechtigungen, Datenintegrität,
Fehlerbehandlung und reale Bedienabläufe. Reine CSS-/MUI-Strukturprüfungen,
Quelltext-Regex und redundante Wrapper-Tests werden nicht gepflegt.
PDF-Tests sichern vollständige Inhalte und Seitenbegrenzungen statt exakter
Zeichenkoordinaten oder Zeichenstrom-Hashes; die globale Vorgabe kompakter
Admin-Eingabefelder bleibt separat abgesichert.

CI (`.github/workflows/ci.yml`) nutzt Node 24 und MariaDB 10.11.19 inkl. frischer
Migrationen und Drift-Prüfung.

## WordPress-Einbettung

Nach dem Produktionsbuild `<APP_BASE_URL>/customer-form/loader.js` in WordPress
einbinden (kein iframe). Den WordPress-Origin in `CORS_ALLOWED_ORIGINS` aufnehmen
und Styles/CSP dort prüfen.

## Weitere Anleitungen

- `hostinger-mail-cron.md` – Cron für Mail-Retries
- `gcs-bucket-setup.md` – GCS-Bucket, Lifecycle, CORS, Service Account
