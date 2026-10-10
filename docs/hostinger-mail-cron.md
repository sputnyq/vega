# Hostinger-Cron: Mail-Outbox-Retry

**Stand:** 2026-10-10
**Geltung:** Vega `notify-customer`-Stand; Teil von `docs/notification-pland.md` (Phase 3, Schritt 14).
**Prinzip:** Öffentliche Anfragen werden sofort beantwortet (`201 { orderNumber }`);
der Versand läuft zweistufig: Sofortversuch nach dem DB-Commit plus dieser
Cron-Lauf als Retry für alles Liegengebliebene. Keine öffentliche
Wartungsroute, keine zweite Mail-App.

## Was der Lauf tut

- `apps/server/src/maintenance-cli.ts` lädt dieselbe Runtime-Konfiguration wie
  die App und ruft `deliverDueOutboxMail()` auf (`PENDING`/`FAILED` mit
  `nextAttemptAt <= now`, max. `MAIL_MAINTENANCE_LIMIT`, Default 25, Cap 200).
- Erfolg → `SENT` + genau ein `EmailEvent`. Transienter Fehler (429/5xx,
  Timeout/Netzwerk) → `FAILED` mit exponentiellem `nextAttemptAt` und späterem
  Retry. Permanente Fehler bleiben sichtbar stehen.
- Geloggt werden nur Zähler (`sent`, `failed`, `limit`), niemals Empfänger,
  Inhalte, Token oder Providerantworten.
- Exit-Code `0` = Lauf abgeschlossen (auch bei `failed > 0`, das ist bei
  transienten Fehlern normal). Exit-Code `1` = Crash oder Mailtransport nicht
  konfiguriert.

Noch **nicht** in diesem Lauf enthalten: Order-Purge (60 Tage),
Finanz-Purge (30 Tage) und `UNKNOWN`-Reconciliation. Das bleibt offen und ist
ein separates Go-live-Gate.

## Was auf Hostinger anzulegen ist

1. **Genau ein wiederkehrender Cron-Job**, mindestens täglich (z. B. früh
   morgens Europe/Berlin). Wer schnellere Mail-Retries will, darf häufiger
   laufen lassen (z. B. stündlich); der Claim (`PENDING`/`FAILED` →
   `SENDING`, `attempts+1`) macht parallele Läufe idempotent.
2. **Arbeitsverzeichnis:** das Vega-App-Verzeichnis (dort, wo nach dem
   Deployment `apps/server/dist/maintenance-cli.js` liegt).
3. **Befehl (nach `npm run build`):**
   `node apps/server/dist/maintenance-cli.js`
4. **Umgebung:** exakt dieselben serverseitigen Runtime-Variablen wie für den
   App-Prozess, mindestens:
   `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥ 32 Zeichen), `APP_BASE_URL`,
   `HOSTINGER_MAIL_API_TOKEN`, `HOSTINGER_MAILBOX_RESOURCE_ID`.
   Optional: `MAIL_MAINTENANCE_LIMIT` (1–200, Default 25).
   Keine Secrets in die Cron-Befehlszeile schreiben; keine Ausgaben mit
   Mailinhalten aufbewahren.

## Verifikation (Release-Nachweis)

1. Einmal manuell im Zielverzeichnis starten und die JSON-Zeile prüfen:
   `{"event":"mail-maintenance","sent":N,"failed":M,"limit":25}`.
2. In der Datenbank prüfen, dass fällige `EmailOutbox`-Einträge auf `SENT`
   wechseln und genau ein `EmailEvent` je Eintrag entsteht.
3. Cron-Protokoll des Hostings prüfen: regelmäßige `0`-Exits, keine `1`-Exits.
4. Einen fehlgeschlagenen Eintrag (`FAILED` + `lastErrorCode`) manuell
   korrigieren und den nächsten Lauf abwarten, statt blind zu wiederholen.

## Offene Gates

- Tatsächliche Cron-Ausführung im gebuchten Tarif ist vor Go-live
  nachzuweisen (CLI-Verfügbarkeit je nach Managed-Node-Tarif prüfen).
- Vollständige Mailkonfiguration (Firmen-/Absenderadresse) bleibt
  Go-live-Voraussetzung: Ohne sie bleiben Firmenmails als sichtbarer
  Konfigurationsfehler stehen.
