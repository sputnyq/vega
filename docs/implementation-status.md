# Implementierungsstand und offene Arbeit

**Stand:** 2026-10-15  
Konkretisiert `implementation-plan.md` §7; bei Konflikten gelten Plan und ADRs.

## Umgesetzt (lokal)

| Bereich | Stand |
|---|---|
| Build | Node-24-Monorepo, Oxlint, CI-Workflow, Deployment-Smoke-Test des kompilierten Ein-Prozess-Servers. |
| Datenmodell | Versionierte Prisma-Migrationen für alle Modellbereiche inkl. Gutschriften/Mahnungsereignisse, echte DB-Tests. |
| Auth | Better Auth 1.7.7, zwei Rollen, TOTP (Pflicht für Admins, optional für Kundenberater), Initialadmin, Recovery-Codes, 30-Tage-Sessions, Mitarbeiterverwaltung mit Passwortbestätigung, Sole-Admin-Recovery. |
| Profil | E-Mail- und Passwortänderung, TOTP-Verwaltung, persönlicher Signaturname für Mails. |
| Aufträge | Öffentlicher Order-POST, Admin-Neuanlage/-Liste/-Suche/-Bearbeitung, Angebotskopien mit Familienlinks, Archiv/Restore, Journal, Auftrags-PDF im Legacy-Layout. |
| Katalog/Optionen | Safe Public-GETs, Admin-CRUD, revisionsgeschützte Optionen unter `/settings`. |
| Kundenformular | Fünf Legacy-Schritte, Möbelrechner, Consent, WordPress-Loader, Google-Places-Vorschläge. |
| Bilder | JPEG-Komprimierung, GCS-Signed-POST, Byteprüfung, Claims, kurzlebige Leselinks. |
| Rechnungen | Admin-only Blanco-/Auftragsrechnungen, Nummernkreis, Archiv/Restore, Rechnungs-PDF. |
| Gutschriften/Mahnungen | Admin-only in Tabs des Rechnungseditors (Rechnung, 1.–3. Mahnung, Gutschrift): eine Gutschrift je Rechnung (Snapshot der Rechnung), Mahnstufen 1–3 nur in Reihenfolge (Standard: +10 Tage, 10 € Gebühr, Legacy-Texte), PDF im Legacy-Layout, Mailversand; Gutschrift mit eigenem Archiv/Restore, Mahnungen werden mit ihrer Rechnung archiviert und wiederhergestellt, nur die höchste Stufe ist endgültig löschbar; `ReminderEvent.sentAt` wird beim erfolgreichen Outbox-Versand gesetzt. |
| Mail | Hostinger-Adapter, Outbox mit PDF-Anhängen und Retry-CLI, Anfrage-Benachrichtigung an Firma und Kunde, Versanddialoge für Angebot, „2 Angebote" (nur Kopien), Absage, Rechnung, Gutschrift und Mahnung. |
| Google Routes | Admin-Depot-Rundreise auf Klick, gerundete Kilometer in den Entwurf. |

## Offene fachliche Arbeit

1. **Autoritative Preisberechnung** auf dem Server; der Browser bleibt niemals Preisquelle.
2. **Purge-Läufe:** 60-Tage-Order-Purge und 30-Tage-Finanz-Purge idempotent per Cron.
3. **E2E/Sicherheitsprüfung:** Order-/Copy-/Archive-/Mail-/PDF-Szenarien, IDOR,
   HTML-Mail-Editor, CORS, Rate-Limits, Uploads.
4. **Offene Fachfrage:** Bestätigung der Mehrfachadress-Reihenfolge bei der Route.

## Externe Release-Gates

- Hostinger Managed Node 24, MySQL-Migrationen, Healthcheck, Runtime-Env und Cron
  in nichtproduktiver Umgebung.
- Hostinger Mail API mit Testempfänger, HTML/Text, PDF-Anhang und Fehlerantworten.
- WordPress-Loader/CORS/CSP, EU-GCS, Google Places/Routes mit echten Testzugängen.
- Externes Rechnungs-/Gutschriftenarchiv mit Buchhaltung/Steuerberatung bestätigen;
  die App ersetzt die gesetzliche Aufbewahrung nicht.

## Lokale Verifikation

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run test:deployment` sowie `npm run test:database` gegen eine separate
`_test`-Datenbank (siehe `operations.md`). Lokale Ergebnisse ersetzen keinen
Hostinger-, CI- oder Provider-Proof.
