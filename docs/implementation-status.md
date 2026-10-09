# Implementierungsstand und offene Arbeit

**Stand:** 2026-10-09  
**Quelle:** Dieser Status konkretisiert `implementation-plan.md`; bei Konflikten
gilt der dortige Plan zusammen mit den ADRs.

## Umgesetzt

| Bereich | Stand |
|---|---|
| A1 Root, Build und Healthcheck | npm-Workspaces, Express, Admin-/Form-Builds und `/health` vorhanden. |
| A2 Datenmodell | Auth, Katalog, Orders, Order-Journal, E-Mail-Outbox sowie Rechnungen mit versionierten Prisma-Migrationen vorhanden. |
| A3 Auth | Better Auth, Rollen, verpflichtendes TOTP, Initialadmin, Passwort-Reset per Hostinger-Adapter, Profil-E-Mail-Änderung mit Passwortbestätigung vorhanden. Benutzerverwaltung für weitere Accounts bleibt offen. |
| A4 Orders | Öffentlicher rate-limitierter Order-POST, Staff-Neuanlage, Admin-Liste/-Suche/-Bearbeitung, Angebotskopie, Archiv/Restore und Journal vorhanden. Kein öffentlicher Order-Read. |
| A4 Katalog | Safe Public-GETs und Admin-CRUD für Kategorien, Möbel, Angebote, Verpackung, Leistungen und Raten vorhanden. |
| A6 Admin | Legacy-nahe Auftragsübersicht mit zehn Einträgen je Seite und URL-Paginierung; Auftragseditor mit Dirty-Indikator und Save-Toast vorhanden. |
| A7 Mail | Hostinger-Adapter, codebasierte Mailhülle, Outbox, Retry-Zustand und Reset-Mailvorlage vorhanden. Provider-End-to-End-Test und Versanddialoge fehlen. |
| A7 Rechnungen | Admin-only Blanco- und Auftragsrechnungen, optionale 1:1-Order-Relation, Nummernkreis, CRUD, Archiv/Restore, Suche und serverseitiges Rechnungs-PDF im Legacy-Layout vorhanden. |

## Nächste fachliche Arbeit

1. **Autoritative Preisberechnung:** Katalog-/Ratenregeln vollständig auf dem
   Server berechnen; der Browser bleibt niemals Preisquelle.
2. **Angebots-PDF und E-Mail-Dialog:** Angebotslayout vom Legacy-PDF in das
   Backend portieren; bearbeitbaren Betreff/Text, PDF-Anhang und erfolgreichen
   Versand über die Outbox integrieren. Danach Rechnungsversand ergänzen.
3. **Gutschriften und Mahnungen:** Datenmodell, CRUD, PDF, Mail und
   Archiv-/Restore-Flows. Der beschlossene 30-Tage-Purge ist erst zusammen mit
   dem externen Archiv-Gate produktionsfähig.
4. **Order-Purge und Mail-Retry-Cron:** Signierten internen Maintenance-Trigger
   oder nachgewiesenen Hostinger-Cron umsetzen; 60-Tage-Order-Purge und
   30-Tage-Finanz-Purge idempotent ausführen.
5. **GCS-Bilder und Upload-Sitzungen:** EU-Bucket, Browser-Komprimierung,
   servergeprüfte Signed URLs und 180-Tage-Lifecycle.
6. **Kundenformular/WordPress:** Vollständigen langen Legacy-Flow, Loader und
   reale WordPress-Origin/CORS-Integration abnehmen.
7. **Mitarbeiterverwaltung:** Admin-Anlage, Sperrung, Rollenwechsel und
   Admin-initiierter Passwortreset für weitere Accounts.
8. **E2E/Sicherheitsprüfung:** Vollständige Order-/Copy-/Archive-/Mail-/PDF-
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

Die aktuelle Implementierung wurde mit `npm run typecheck`, `npm test` (31
Tests), `npm run build` und `npm audit --omit=dev` (0 Vulnerabilities)
verifiziert. Diese Ergebnisse ersetzen keinen Hostinger- oder Provider-Proof.

Die Target-Runtime bleibt Node.js 24 / npm 11. Die hier genannte lokale
Verifikation darf nicht als Zusage für andere Node-/npm-Versionen verstanden
werden.
