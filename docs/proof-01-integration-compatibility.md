# Issue 01 – Integrations- und Kompatibilitäts-Proof

**Stand:** 2026-10-06
**Status:** Teilproof – lokale Node-24-Auth-/Prisma-Integration verifiziert; Hostinger-/Provider-Proofs offen.

## Lokaler Proof

Ausgeführt im Verzeichnis `vega/` mit Node.js `24.21.0` und npm `11.19.0`:

| Prüfschritt | Ergebnis |
|---|---|
| Node.js / npm | `24.21.0` / `11.19.0` |
| Typecheck (Workspaces plus Prisma-Seed) | bestanden |
| Tests | bestanden, 10/10 |
| Produktionsbuild für Domain, Server, Admin und Kundenformular | bestanden |
| `npm audit` | 0 bekannte Schwachstellen nach Behebung des unten genannten Befunds |
| Prisma-Migrationen auf lokaler MariaDB 10.11.19 | 2 versionierte Migrationen angewendet |
| Initialadmin/Auth-Integration | Prisma-Seed → Login → erzwungener Passwortwechsel → TOTP-Enrollment → erneuter Login mit TOTP bestanden |

Der getestete Versionssatz umfasst Better Auth `1.7.7`, Prisma `6.19.3`, TypeScript `7.0.2`, Express `5.2.1`, React/React DOM `19.3.0`, Vite `8.3.2` und MUI `9.4.0`. Der Auth-Smoke-Test nutzte eine lokale, nichtproduktive MariaDB-Testdatenbank mit synthetischem Konto.

### Beim Proof gefundener Dependency-Befund

Der erste Audit-Lauf meldete zwei kritische Findings über `concurrently@9.2.4` → `shell-quote@1.9.0` (GHSA-pqg4-j6r4-53mv). `vega/package.json` pinnt nun Overrides für `shell-quote`, `mysql2` und `deepmerge-ts`; Prisma `6.19.3` wird ohne den aktuell verwundbaren Prisma-7-MariaDB-Treiber verwendet. `npm audit` meldet 0 bekannte Schwachstellen. Es wurde kein `npm audit fix --force` verwendet.

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
| Google Places | Nicht geprüft. Key-/Domainbeschränkung und DE/AT-Filter benötigen eine nichtproduktive Browserkonfiguration. |

## Weiterhin offene Punkte (Issue 00)

- Re-Authentifizierung bei sicherheitskritischen Kontoänderungen ist noch nicht entschieden.
- Der Betreiber stellt bei Bedarf nichtproduktive Hostinger-, Mail-, GCS- und Google-Places-Zugänge sowie WordPress-Test-Origin als Runtime-Konfiguration/Umgebungsvariablen bereit; sie liegen aktuell nicht vor.
- Der Betreiber stellt bei Bedarf die nötige externe Archivkonfiguration als serverseitige Runtime-Umgebungsvariablen bereit. Die konkrete externe Sicherung/gesetzliche Aufbewahrung ist vor Go-live weiterhin nachzuweisen; die App kann sie nicht verifizieren.

Die lokalen Auth- und Finanz-Purge-Entscheidungen aus Issue 00 sind dokumentiert. Diese Teilprüfung schließt Issue 01 dennoch nicht ab und gibt weder Finanz-Purge noch Produktionsbetrieb frei. Tarif-/Provider-Proofs und externe Aufbewahrungsbestätigung bleiben Freigabegates.
