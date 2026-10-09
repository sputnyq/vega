# Issue 01 – Integrations- und Kompatibilitäts-Proof

**Stand:** 2026-10-09
**Status:** Teilproof – lokale Node-24-Auth-/Prisma-Integration verifiziert; Hostinger-/Provider-Proofs offen.

## Lokaler Proof

Ausgeführt im Verzeichnis `vega/` mit Node.js `24.21.0` und npm `11.19.0`:

| Prüfschritt | Ergebnis |
|---|---|
| Node.js / npm | `24.21.0` / `11.19.0` |
| Typecheck (Workspaces plus Prisma-Seed) | bestanden |
| Lint | bestanden, Oxlint-Korrektheitsregeln |
| Tests | bestanden, 57/57 Unit-/API-Tests, 6/6 isolierte DB-Tests und 1/1 Produktions-Smoke-Test |
| Produktionsbuild für Domain, Server, Admin und Kundenformular | bestanden |
| `npm audit` | 0 bekannte Schwachstellen nach Behebung des unten genannten Befunds |
| Prisma-Migrationen auf lokaler MariaDB 10.11.19 | 14 versionierte Migrationen auf leerer Test-DB sowie laufender lokaler DB angewendet; inklusive relationaler Adressen/Positionen, Gutschriften, Mahnungsereignisse und A3-Kontosperrung |
| Schema-Drift | Datenbank und Prisma-Schema stimmen überein |
| Ein-Prozess-Deployment | Kompilierten Server gestartet; Healthcheck, Admin/Form/Assets, Laufzeit-Loader und API-Grenzen bestanden |
| Initialadmin/Auth-Integration | Prisma-Seed → Login → erzwungener Passwortwechsel → TOTP-Enrollment → erneuter Login mit TOTP bestanden |
| A3 Mitarbeiterverwaltung | Reale DB-/HTTP-Abläufe: Admin-Passwortbestätigung, Anlage, Sperrung/Entsperrung, Rollen-/Origin-Grenzen, Mass-Assignment-Abweisung, Sitzungs-/Challenge-Widerruf, 2FA-Reset und Sole-Admin-Recovery bestanden |
| A3 Reset-/Recovery-Proof | Verschlüsselte einmalige case-sensitive Recovery-Codes, HTML-/Text-Reset-Link, Einmal-Token und generische Self-Service-Antwort; Mock-Mailerfolg/-fehler, absolute Sessiondauer/-ablauf und persistente Auth-Limits bestanden |

Der getestete Versionssatz umfasst Better Auth `1.7.7`, Prisma `6.19.3`, TypeScript `7.0.2`, Express `5.2.1`, React/React DOM `19.3.0`, Vite `8.3.2` und MUI `9.4.0`. Der Auth-Smoke-Test nutzte eine lokale, nichtproduktive MariaDB-Testdatenbank mit synthetischem Konto.

Am 2026-10-09 wurden zusätzlich Orderverwaltung, Rechnungs-CRUD und das
serverseitige Rechnungs-PDF lokal gebaut/getestet. Der PDF-Test prüft einen
gültigen PDF-Stream; das exakte visuelle Layout bleibt bei Änderungen manuell
gegen das Legacy-PDF abzunehmen.

Kundenformular, GCS-Verifikation und Optionen wurden ebenfalls lokal gebaut
und getestet. Eine rollbackgeschützte Prüfung gegen die lokale Datenbank
bestätigt Speicherung und Abweisung veralteter Einstellungsrevisionen, ohne
Geschäftswerte zu verändern. Öffentliche Formularoptionen bleiben leer, bis
der Betreiber tatsächliche Werte speichert; keine Testwerte wurden übernommen.

Für A1/A2 besteht ein Node-24-CI-Workflow mit Lockfile-Installation, Lint,
Typecheck, frischen Migrationen, Schema-Drift-Prüfung, Tests und Build.
Die lokale DB-Prüfung verwendet eine separate, leere `_test`-Datenbank und
verifiziert eindeutige Geschäftsnummern, atomaren Rollback und parallele
Nummernvergabe, unabhängige Kopien und Finanzbelege, Mail-/Journal-Kaskaden,
relationalen Read/Edit/Copy sowie die additive Überführung von Vega-Entwürfen.
Der GitHub-gehostete Workflow wurde hier nicht ausgeführt; seine tatsächliche
Ausführung und das Hostinger-Deployment bleiben externe Nachweise.

Der A3-Proof verwendet ausschließlich synthetische Mitarbeiterkonten in einer
separaten `_test`-Datenbank und gemockte Hostinger-Antworten, keine echten
Mails. Better Auths generischer Reset-Endpunkt unterdrückt Versandfehler;
deshalb bestätigt der Admin-Resetpfad den Erfolg zusätzlich anhand des
abgeschlossenen Mailcallbacks. Die Sperrungs-Migration erhält bestehende
Konten, Aufträge und Optionen. Das Auth-/Plugin-Schema wurde mit CLI `1.7.7`
in ein separates Vergleichsartefakt generiert, nicht über das Fachschema
geschrieben. Die Admin-UI nutzt typisierte Additional Fields statt ungeprüfter
Session-Casts.

### Beim Proof gefundener Dependency-Befund

Der erste Audit-Lauf meldete zwei kritische Findings über `concurrently@9.2.4` → `shell-quote@1.9.0` (GHSA-pqg4-j6r4-53mv). `vega/package.json` pinnt nun Overrides für `shell-quote`, `mysql2` und `deepmerge-ts`; Prisma `6.19.3` wird ohne den aktuell verwundbaren Prisma-7-MariaDB-Treiber verwendet. `npm audit` meldet 0 bekannte Schwachstellen. Es wurde kein `npm audit fix --force` verwendet.

Für das Rechnungs-PDF wurde die verwundbare Legacy-Browserbibliothek `jspdf`
nicht übernommen. Stattdessen wird `pdfkit` nur serverseitig verwendet;
`npm audit --omit=dev` meldet nach der Änderung weiterhin 0 Vulnerabilities.

Bei `npm ci` meldet npm weiterhin, dass das optionale Install-Script von `fsevents@2.3.3` nicht in `allowScripts` freigegeben ist. Installation, Tests und Builds funktionieren trotzdem; das Script wurde nicht zusätzlich freigegeben.

## Noch offen – externe Proofs

| Bereich | Status / benötigter Nachweis |
|---|---|
| Hostinger Managed Node 24 | Nicht geprüft. Start, Healthcheck, Runtime-Env und Prisma-Migrationslauf müssen im tatsächlichen nichtproduktiven Tarif erprobt werden. |
| Cron | Nicht geprüft. Scheduler-Aufruf, Proxy-/IP-Header und sichere interne Ausführung im Tarif nachweisen. |
| Hostinger MySQL / Prisma-Deployment | Noch nicht im tatsächlichen Hostinger-Tarif geprüft; lokaler Migrationstest belegt keine Zieltarif-Kompatibilität. |
| Hostinger Mail API | Nicht aufgerufen. API-Anfrage, Empfänger, HTML/Text, PDF-Anhang und Fehlerantwort benötigen nichtproduktive Zugangsdaten und Mock-/Testempfänger. |
| EU-GCS | Nicht geprüft. Private Bucket-Region, Signed-URL-Beschränkung, Upload-Verifikation, Staging-Bereinigung und 180-Tage-Lifecycle benötigen Testprojekt/-bucket. |
| WordPress-Loader/CORS | Nicht geprüft. WordPress-Test-Origin und nicht eingebrannte absolute Asset-/API-Pfade benötigen eine Testseite/-Origin. |
| Google Places | Nicht geprüft. Serverseitige Keybeschränkung und DE/AT-Filter benötigen nichtproduktive Runtime-Zugänge. Der Browser erhält keinen Google-Key. |
| Google Routes | Nicht geprüft. Serverseitige Depot-/Stop-Berechnung benötigt einen nichtproduktiven Runtime-Key und den tatsächlichen Standort. |

## Weiterhin offene Punkte (Issue 00)

- Re-Authentifizierung ist entschieden und implementiert: aktuelles Admin-Passwort bei jeder Anlage, Sperrung/Entsperrung, Rollenänderung, Reset-Mail und jedem 2FA-Reset (ADR 0002). Kein offener lokaler A3-Blocker.
- Der Betreiber stellt bei Bedarf nichtproduktive Hostinger-, Mail-, GCS- und Google-Places-Zugänge sowie WordPress-Test-Origin als Runtime-Konfiguration/Umgebungsvariablen bereit; sie liegen aktuell nicht vor.
- Der Betreiber stellt bei Bedarf die nötige externe Archivkonfiguration als serverseitige Runtime-Umgebungsvariablen bereit. Die konkrete externe Sicherung/gesetzliche Aufbewahrung ist vor Go-live weiterhin nachzuweisen; die App kann sie nicht verifizieren.

Die lokalen Auth- und Finanz-Purge-Entscheidungen aus Issue 00 sind dokumentiert. Diese Teilprüfung schließt Issue 01 dennoch nicht ab und gibt weder Finanz-Purge noch Produktionsbetrieb frei. Tarif-/Provider-Proofs und externe Aufbewahrungsbestätigung bleiben Freigabegates.
