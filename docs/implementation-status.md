# Implementierungsstand und offene Arbeit

**Stand:** 2026-10-09  
**Quelle:** Dieser Status konkretisiert `implementation-plan.md`; bei Konflikten
gilt der dortige Plan zusammen mit den ADRs.

## Umgesetzt

| Bereich | Stand |
|---|---|
| A1 Root, Build und Healthcheck | Lokale Grundlage vollständig: Node-24-/Lockfile-Build, Oxlint, CI-Workflow und Smoke-Test des kompilierten Ein-Prozess-Deployments einschließlich beider Frontends und Loader. GitHub-CI-/Hostinger-Nachweis noch extern offen. |
| A2 Datenmodell | Alle geplanten Modellbereiche vorhanden, einschließlich relationaler Auftragadressen/-positionen, Gutschriften und Mahnungsereignisse. 14 Migrationen einschließlich A3-Kontosperrung sowie echte DB-Tests für Nummern, Kopien, Löschregeln und Snapshot-Überführung. Fachfunktionen für Gutschriften/Mahnungen bleiben A7. |
| A3 Auth | Lokal vollständig: Better Auth 1.7.7, Rollen, verpflichtendes TOTP, Initialadmin, verschlüsselte einmalige Recovery-Codes und absolute 30-Tage-Sessions. Mitarbeiterverwaltung mit Passwortbestätigung für Anlage, Sperrung/Entsperrung, Rollenwechsel, Reset-Mail und 2FA-Reset; Sitzungswiderruf, Self-/Last-Admin-Schutz und serverseitige Sole-Admin-Recovery. Tatsächlicher Hostinger-Mailversand bleibt extern offen. |
| A4 Orders | Öffentlicher rate-limitierter Order-POST, Staff-Neuanlage, Admin-Liste/-Suche/-Bearbeitung, Angebotskopie, Archiv/Restore und Journal vorhanden. Kein öffentlicher Order-Read. |
| A4 Katalog | Safe Public-GETs und Admin-CRUD für Kategorien, Möbel, Angebote, Verpackung, Leistungen und Raten vorhanden. |
| A4 Optionen | Admin-only `/api/admin/settings` mit DB-Persistenz, Validierung und Revisionskonfliktschutz. Sechs aktive Legacy-Optionen, drei freigegebene Mailwerte, bestehende Preisraten und separater Rechnungsnummernkreis sind unter `/settings` angebunden; keine Dummywerte und keine Provider-Secrets. |
| A5 Kundenformular | Fünf lange Legacy-Schritte, eingebetteter Möbelrechner, Montserrat-/MUI-Gestaltung, Schrittvalidierung, Consent, Anfrage-POST, Fehlermeldungen und Dankeseite implementiert. WordPress-Loader vorhanden; realer Einbettungsproof offen. |
| A8 Bilder | Browser-JPEG-Komprimierung, GCS-Signed-POST, Metadaten-/Byteprüfung, EU-/Privacy-/Lifecycle-Prüfung, atomare Claimzuordnung und geschützte Admin-Leselinks implementiert. Echter GCS-Test bleibt offen. |
| A6 Admin | Legacy-nahe Auftragsübersicht mit zehn Einträgen je Seite und URL-Paginierung; Auftragseditor mit Dirty-Indikator und Save-Toast vorhanden. |
| A7 Mail | Hostinger-Adapter, codebasierte Mailhülle, Outbox, Retry-Zustand und Reset-Mailvorlage vorhanden. Provider-End-to-End-Test und Versanddialoge fehlen. |
| A7 Rechnungen | Admin-only Blanco- und Auftragsrechnungen, optionale 1:1-Order-Relation, Nummernkreis, CRUD, Archiv/Restore, Suche und serverseitiges Rechnungs-PDF im Legacy-Layout vorhanden. |

## Nächste fachliche Arbeit

1. **Autoritative Preisberechnung:** Katalog-/Ratenregeln vollständig auf dem
   Server berechnen; der Browser bleibt niemals Preisquelle.
2. **Angebots-PDF und E-Mail-Dialog:** Angebotslayout vom Legacy-PDF in das
   Backend portieren; bearbeitbaren Betreff/Text, PDF-Anhang und erfolgreichen
   Versand über die Outbox integrieren. Danach Rechnungsversand ergänzen.
3. **Gutschriften und Mahnungen:** Auf dem vorhandenen Datenmodell CRUD, PDF, Mail und
   Archiv-/Restore-Flows. Der beschlossene 30-Tage-Purge ist erst zusammen mit
   dem externen Archiv-Gate produktionsfähig.
4. **Order-Purge und Mail-Retry-Cron:** Signierten internen Maintenance-Trigger
   oder nachgewiesenen Hostinger-Cron umsetzen; 60-Tage-Order-Purge und
   30-Tage-Finanz-Purge idempotent ausführen.
5. **GCS-Provider-Proof:** Nichtproduktiven EU-Bucket, Signed-POST/CORS,
   unveränderliche finale Objekte und 180-Tage-Lifecycle mit echten Zugängen
   nachweisen; verwaiste DB-Claims in die Maintenance integrieren.
6. **Kundenformular/WordPress:** Den portierten langen Flow und Loader in
   realem WordPress mit dessen Styles, CSP und Origin-Allowlist abnehmen.
   Google Places und Google Routes benötigen serverseitige Providerzugänge.
7. **E2E/Sicherheitsprüfung:** Vollständige Order-/Copy-/Archive-/Mail-/PDF-
   Szenarien, IDOR, HTML-Mail-Editor, CORS, Rate-Limits und Uploads testen.

## Harte externe Release-Gates

- Hostinger Managed Node 24, MySQL-Migrationen, Healthcheck und Runtime-Env in
  nichtproduktiver Zielumgebung nachweisen.
- Hostinger Mail API mit Testempfänger, HTML/Text, PDF-Anhang und
  Fehlerantworten nachweisen.
- Cron-Ausführung und Proxy-IP-Verhalten im gebuchten Tarif nachweisen.
- WordPress-Loader/CORS, EU-GCS und Google Places mit nichtproduktiven
  Zugängen nachweisen.
- Vor dem Produktivbetrieb externes Rechnungs-/Gutschriftenarchiv mit
  Buchhaltung/Steuerberatung bestätigen. Die App ersetzt die gesetzliche
  Aufbewahrung nicht.

## Lokale Verifikation

Die lokale Prüfung umfasst `npm run lint`, `npm run typecheck`, `npm test`
(57 Tests), `npm run test:database` (6 DB-Tests einschließlich des vollständigen
A3-Auth-/Konto-Lifecycle), `npm run build`,
`npm run test:deployment` (1 Produktions-Smoke-Test) und Schema-Drift-Prüfung.
DB-Tests laufen nur gegen eine ausdrücklich benannte separate `_test`-Datenbank;
keine Test-Geschäftswerte werden in der laufenden App angelegt. Diese Ergebnisse
ersetzen keinen Hostinger-, GitHub-CI- oder Provider-Proof.

Die Target-Runtime bleibt Node.js 24 / npm 11. Die hier genannte lokale
Verifikation darf nicht als Zusage für andere Node-/npm-Versionen verstanden
werden.
