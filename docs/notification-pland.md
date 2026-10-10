# Umsetzungsplan: Benachrichtigungen bei öffentlichen Anfragen

**Stand:** 2026-10-10  
**Status:** Plan, nicht implementiert  
**Einordnung:** Arbeitspaket A7; untergeordnet zu `implementation-plan.md`, `target-architecture.md` und ADR 0007.

## 1. Ziel

Bei jeder erfolgreich gespeicherten Anfrage aus dem öffentlichen Kundenformular werden zwei voneinander unabhängige E-Mails vorgemerkt:

1. eine Benachrichtigung an die konfigurierte Firmenadresse;
2. eine Eingangsbestätigung an die Kundenadresse.

Betreff und Nachrichtentext orientieren sich an den aktiven E-Mail-Vorlagen des Legacy-Plugins. Versand und Wiederholungen erfolgen ausschließlich serverseitig über die vorhandene Hostinger-Integration und persistente Outbox. Ein Versandfehler darf eine gespeicherte Anfrage nicht verlieren oder den erfolgreichen Formular-POST rückwirkend fehlschlagen lassen.

## 2. Umfang und Grenzen

### Enthalten

- Legacy-kompatible Betreffzeilen und Nachrichtentexte für Firmen- und Kundenmail.
- Zwei getrennte, idempotent vorgemerkte Outbox-Einträge pro öffentlicher Anfrage.
- Sichtbarer Status, kontrollierte Wiederholung und Behandlung unklarer Versandresultate.
- Tests der Vorlagen, Speicherung, Berechtigungen, Fehlerfälle und Hostinger-Integration.

### Nicht enthalten

- Änderungen am Legacy-Plugin, an WordPress-Routen oder Übernahme von Legacy-Daten.
- Benachrichtigungen für Mitarbeiter-Neuanlage, Bearbeitung, Kopie, Archivierung oder Wiederherstellung.
- Angebote, Absagen, Rechnungen, Mahnungen, PDFs, Mail-Editor oder ein allgemeiner Mail-Posteingang.
- Öffentliche Order-Lesezugriffe, neue Kundenzugänge oder neue Mail-Provider.
- Zusage von Inbox-Zustellung oder technisch garantierter Exactly-once-Zustellung.

## 3. Befund aus Legacy und Vega

### Legacy-Verhalten

Der öffentliche Legacy-Order-Endpunkt speichert die Anfrage und ruft danach `umconf_send_order_email()` auf. Diese Funktion lädt `email.php` sowie die beiden Betreffvorlagen, verwendet denselben Nachrichtentext für beide Empfänger und versendet zwei getrennte Nachrichten. Die Firmenmail erhält zusätzlich einen `Reply-To`-Header mit der Kundenadresse. Anhänge werden für diesen Ablauf nicht versendet; Fehler von `wp_mail()` werden nicht zuverlässig in der Auftragsanlage abgebildet.

Aktive Legacy-Vorlagen:

- `old-app/um-configurator/src/app-dist/messages/templates/email.php`
- `old-app/um-configurator/src/app-dist/messages/templates/subject_company.php`
- `old-app/um-configurator/src/app-dist/messages/templates/subject_customer.php`

`backup.php` ist in diesem Ablauf nicht eingebunden und wird nicht als Vorlage übernommen. Sie hat abweichende Texte/Branding und eine Datentabelle.

Der aktive Nachrichtentext enthält die Anrede, den Dank für die Anfrage, die Anfrage-ID, die Rückmeldeankündigung sowie die vollständige Legacy-Signatur und Kontaktangaben. Die Betreffzeilen sind:

- Firma: `Neue Umzugsanfrage #{orderNumber} für {movingDate} - {lastName}, {firstName}`
- Kunde: `Ihre Umzugsanfrage {orderNumber} ist bei uns angekommen`

In Vega muss `{orderNumber}` die fachliche Auftragsnummer sein, nicht die interne Datenbank-ID oder die frühere WordPress-ID. Das Umzugsdatum wird als gespeicherter Wert eingesetzt, ohne eine Zeitzonenumrechnung.

### Vega-Bestand und Lücken

- `apps/server/src/orders/order-service.ts` legt im selben Datenbank-Transaktionsablauf bereits getrennte Firmen- und Kunden-Outbox-Einträge an. Der Firmen-Eintrag fehlt derzeit vollständig, wenn keine Firmenadresse konfiguriert ist.
- `apps/server/src/orders/order-routes.ts` startet nach dem Commit einen unmittelbaren Best-Effort-Versand und gibt den erfolgreichen Request mit der Auftragsnummer zurück. Öffentliche Antworten enthalten keine Outbox-Details. Mitarbeiter-Neuanlagen sind vom öffentlichen Versand getrennt.
- `apps/server/src/mail/email-template.ts` stellt derzeit vereinfachte Inquiry-Texte bereit. `MailService.send()` wendet die Vega-Branded-Mailhülle einschließlich Logo und zusätzlicher Signatur an; dies würde bei unverändertem Legacy-Text zu doppeltem Branding bzw. doppelter Signatur führen.
- `apps/server/src/mail/mail-outbox-service.ts` enthält persistente Outbox-Zustände und idempotente Schlüssel. Wartungsversand und sichere Status-/Retry-Bedienung sind noch nicht vollständig integriert; abgebrochene `SENDING`-Zustände und unklare Providerresultate benötigen eine explizite Behandlung.
- `prisma/schema.prisma` speichert Empfänger, Betreff, HTML-Inhalt und Retry-/Erfolgsdaten. Plain-Text, Layoutmodus und Empfängerrolle sind nicht als explizite Snapshotfelder vorhanden.
- Das Admin-Journal zeigt Versandereignisse erst nach Erfolg, aber keine ausstehenden oder fehlgeschlagenen Benachrichtigungen.

### Verbindliche Providergrenze

Die maßgebliche Spezifikation `hostinger-email-api-definition.json` beschreibt `POST /api/v1/mailboxes/{mailboxResourceId}/send`, Bearer-Authentifizierung, JSON sowie `204` als Erfolg ohne Antwortkörper. Das Sendeschema kennt keinen `Reply-To`-Header und keinen Idempotency-Key. `inReplyTo` bezeichnet eine existierende Nachricht anhand Mailbox-Ordner und UID und ist kein Ersatz für `Reply-To`.

Die Firmenmail kann daher den Legacy-`Reply-To` nicht portabel beibehalten. Keine undokumentierten Felder senden. Kundenkontakt bleibt über den geschützten Auftragsdatensatz erreichbar.

## 4. Bestätigte Entscheidungen

1. **Fehlende Firmenadresse:** Anfrage trotzdem speichern und die Firmenbenachrichtigung als sichtbaren Konfigurationsfehler markieren. Die öffentliche Anfrage nicht blockieren; vollständige Mailkonfiguration bleibt Go-live-Voraussetzung.
2. **Vorlagen:** Aktive Legacy-Texte, Betreffzeilen und Signatur übernehmen, nicht die aktuelle Vega-Branded-Hülle darüberlegen. `backup.php` nicht übernehmen.
3. **Zustellgarantie:** Pro akzeptierter öffentlicher Anfrage zwei dauerhafte Benachrichtigungsplätze und nachvollziehbare Fehler garantieren, nicht die Inbox-Zustellung oder Exactly-once beim Provider.

## 5. Umsetzungsschritte

### Phase 1 – Vertrag, Vorlagenregeln und Datenmodell

1. Diesen Plan als A7-Teilplan führen und später im Implementierungsplan/-status referenzieren, ohne den Umsetzungsstand vorzeitig als erledigt zu markieren.
2. Typisierte, serverseitige Vorlageneingabe definieren: fachliche Auftragsnummer, Anrede, Vorname, Nachname und gespeichertes Umzugsdatum. Für `Herr` und `Frau` Legacy-Anrede beibehalten. Bei `Divers` oder leerer Anrede neutral formulieren, z. B. `Guten Tag {Vorname} {Nachname},` statt eine fehlerhafte Legacy-Form zu reproduzieren.
3. Alle Einsetzungen HTML-sicher escapen. Betreffwerte von CR/LF und Steuerzeichen bereinigen bzw. ungültige Werte ablehnen; Längen validieren. Keine ungeprüften Formularwerte in HTML oder Header übernehmen.
4. Für Inquiry-Mails einen minimalen Layoutmodus vorsehen. Bestehende Mails behalten den aktuellen Vega-Layoutstandard als Default. Plain-Text und Layoutmodus müssen als Snapshot gespeichert werden, damit Retry denselben Inhalt rendert und bestehende Outbox-Einträge unverändert kompatibel bleiben.
5. Outbox-Einträge neuer Inquiry-Mails um eine unveränderliche Empfängerrolle (`CUSTOMER`/`COMPANY`) und erforderliche Retry-/Lease-Metadaten ergänzen. Bestehende Datensätze erhalten kompatible Defaults. Nur additive Prisma-Migrationen verwenden; keine Legacy-Daten einlesen und historische Vega-Mails nicht umschreiben.
6. Auch bei fehlender Firmenadresse einen Firmenplatz anlegen: leere Empfängerliste, Status `FAILED`, nicht retrybar und maschineller Fehlercode `COMPANY_EMAIL_NOT_CONFIGURED`. Kein Provideraufruf, bevor eine autorisierte Korrektur eine gültige Firmenadresse einsetzt. Die öffentliche Kundenadresse bleibt gemäß Formularvalidierung erforderlich. Automatisch erzeugte Nachrichten verwenden `actorName: "-"`.

**Abnahme:** Vertrag und Migrationsdefaults sind dokumentiert; synthetische Vorlagenfälle und Schema-/Driftprüfungen bestehen.

### Phase 2 – Vorlagen und transaktionale Anfrageanlage

7. Einen serverseitigen Renderer für Legacy-Betreff und Legacy-Nachricht erstellen. Aus dem gemeinsamen Nachrichtentext sowohl escaped HTML mit passenden Absätzen/Zeilenumbrüchen als auch Plain-Text ableiten. Firmen- und Kundenmail nutzen denselben Text, aber unterschiedliche Betreffzeilen. Keine zusätzliche Logo-/Footerhülle und keine Anhänge.
8. Den Renderer in `createOrder()` erst nach Normalisierung der akzeptierten Eingabe und Zuteilung der fachlichen Auftragsnummer verwenden. Genau zwei Outbox-Einträge mit getrennten Rollen, Empfängern und Idempotency-Keys im bestehenden Auftragstransaktionsablauf persistieren. Keine Netzwerkoperation innerhalb der Datenbanktransaktion.
9. Rollback muss Anfrage, Uploadzuordnung, Nummernvergabe und beide Mailplätze gemeinsam zurückrollen. Outbox-Einträge werden nur bei öffentlichen Anfragen angelegt, nicht bei Mitarbeiter-Neuanlage, Bearbeitung, Kopie oder Archivierung.
10. Nach Commit den unmittelbaren Best-Effort-Versand beibehalten, aber weiterhin mit HTTP `201` und ausschließlich `{ orderNumber }` antworten, auch wenn ein oder beide Mailversuche fehlschlagen. Der Fehler eines Empfängers darf die Verarbeitung des anderen nicht unterdrücken. Wenn der Mailtransport nicht konfiguriert ist, bleibt die Outbox dauerhaft nachvollziehbar; Logs enthalten nur sichere Fehlercodes und notwendige IDs, niemals Empfänger, Inhalt, Token oder Providerantwort.
11. Formular-Erfolg bedeutet „Anfrage gespeichert“, nicht „E-Mail zugestellt“. Erfolgstext/Weiterleitung prüfen und nur dann ändern, wenn eine Inbox-Zustellung behauptet wird.

**Abnahme:** Eine gültige öffentliche Anfrage speichert genau einen Auftrag und zwei Mailplätze; beide gerenderten Nachrichten entsprechen den aktiven Vorlagen. Andere Mailvorlagen bleiben unverändert.

### Phase 3 – Zustellung, Wiederholungen und Betrieb

12. Outbox-Zustellung mit typisierten Fehlern härten. Versuche genau einmal je tatsächlichem Versuch zählen. Für nachweislich vorübergehende Providerfehler und Rate-Limits exponentielle, begrenzte Wiederholungen vorsehen. Permanente Authentifizierungs-, Konfigurations- und Validierungsfehler bleiben sichtbar und werden nicht mit einem künstlichen Jahres-Timer als Retry getarnt. Compare-and-set-Claim und genau ein Erfolgsevent pro Outbox-Eintrag beibehalten.
13. Mehrdeutige Ausgänge gesondert behandeln: Timeout/Netzwerkabbruch nach Beginn des Sendens, ein veralteter `SENDING`-Lease oder erfolgreicher Provider-`204` mit fehlgeschlagener Datenbankfinalisierung können trotz lokaler Fehlermeldung bereits zugestellt sein. Diese Fälle als `UNKNOWN` zur manuellen Klärung markieren und nicht blind wiederholen. Sicher vor dem Sendeversuch gescheiterte Vorgänge dürfen normal retrybar bleiben. Lease-Ablauf und Versions-/Tokenprüfung müssen verspätete Worker daran hindern, einen inzwischen übernommenen Zustand zu überschreiben.
14. `deliverDueOutboxMail()` und Lease-Reconciliation über einen serverseitigen Wartungseinstieg ausführen. Hostinger-Cron/CLI zuerst im gebuchten Tarif verifizieren; falls nicht verfügbar, einen signierten internen Trigger mit Zeitstempel und Replay-Schutz verwenden. Keine öffentliche Wartungsroute, keine zweite Mail-App und keine alleinige Fire-and-forget-Zustellung. Tatsächliche Scheduler-Ausführung ist Release-Nachweis.
15. Geschützte Admin-API für Status und gezielte Wiederholung je Auftrag/Empfängerrolle ergänzen. DTOs enthalten nur Rolle, Status, Versuchszahl, Zeitstempel, bereinigten Fehlercode und erlaubte Aktionen. Keine Mailinhalte oder Empfängeradressen unnötig offenlegen. Admin- und Kundenberaterrechte anhand bestehender Auftragsrechte, vollständiger Sitzung/TOTP und Origin-Schutz prüfen. `SENT` und aktiv `SENDING` dürfen nicht wiederholt werden. Eine fehlende Firmenkonfiguration darf nach autorisierter Korrektur die Rolle auf eine aktuell validierte Firmenadresse setzen. `UNKNOWN` verlangt eine ausdrückliche Bestätigung des Duplikatrisikos. Erfolgsereignis ausschließlich nach erfolgreicher Providerbestätigung schreiben.
16. Im vorhandenen Auftragsjournal Firmen- und Kundenstatus mit verständlichen Bezeichnungen und eingeschränkten Retry-/Klärungsaktionen anzeigen. Admin-only Hinweis auf fehlende Firmenkonfiguration mit Link zu bestehenden Einstellungen. Bestehende MUI-Dichte und Authentifizierungsmuster beibehalten; keinen allgemeinen Mail-Editor oder neue Inbox bauen.
17. Öffentliche Neuanfragen behalten `edited=false`. Vor Implementierung die Architekturformulierung, wonach erfolgreicher In-App-Mailversand `edited=true` setzt, so präzisieren, dass automatische Eingangsbestätigungen nicht als Mitarbeiterbearbeitung gelten. Bestehendes Fachverhalten nicht stillschweigend ändern.

**Abnahme:** Vorgemerkte Mails überstehen Neustarts; sichere Fehler werden wiederholt; permanente/unklare Fälle bleiben sichtbar; nicht autorisierte Wiederholung schlägt fehl; normale Aktionen versenden keine erneute Nachricht.

### Phase 4 – Tests, Abnahme und Dokumentation

18. Unit-Tests für beide Betreffzeilen, Nachrichtentext und Signatur, fachliche Nummer, Datum, Anreden, Umlaute, HTML-Escaping/XSS, CR/LF-Injection, Plain-Text-Parität und fehlende doppelte Hülle. Absichern, dass die ungenutzte Backup-Vorlage nicht geladen wird und Reset-/Angebots-/Rechnungsmails ihren bisherigen Layoutdefault behalten.
19. Datenbank-/HTTP-Tests gegen eine ausdrücklich getrennte `_test`-Datenbank: genau zwei Einträge, atomarer Rollback, fehlende Firmenadresse mit erfolgreichem Request und sichtbarem Firmenfehler, ungültige Anfragen ohne Einträge, öffentliche Route trotz Staff-Cookie, keine Benachrichtigung aus Staff-Neuanlage/Bearbeitung/Kopie, unabhängige Zustellfehler, konkurrierende Claims, Erfolgsevent, Attempts/Backoff, permanente Fehler, Neustart/Lease/`UNKNOWN`, Retry-Rollenbindung, Berechtigung/Origin/TOTP, Konfigurationskorrektur, Löschregeln und `edited=false`.
20. Frontend-Tests für Status, Fehler, Retry/Bestätigung und erhaltene Formularerfolgsanzeige. Sicherstellen, dass keine Mail-Secrets oder Empfängerdetails ins Browserbundle gelangen.
21. Mit Node 24 und Installation aus `package-lock.json` mindestens `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:database`, `npm run build` und `npm run test:deployment` ausführen. Frische Migration und Schema-Drift prüfen. Provider-Proof in nichtproduktiver Umgebung mit Firmen- und Kunden-Testpostfächern für HTML/Text, 204-ohne-Body, Fehlercodes, Absenderprüfung, Teilausfall, Neustart und Scheduler durchführen. Keine Produktivkundendaten in Tests verwenden.
22. Nach erfolgreicher Implementierung Umsetzungsplan, Implementierungsstatus und bei Bedarf ADR 0007 sowie Betriebsanleitung aktualisieren. Mailstatus, Recovery, Scheduler und Einschränkungen zur Duplikat-/Zustellgarantie dokumentieren; offene Provider- und Hosting-Gates ausdrücklich offen lassen.

**Abnahme:** Alle lokalen Prüfungen sind erfolgreich, Migrationen bauen eine leere Datenbank auf, Staging-Versand ist nachgewiesen und offene externe Gates sind dokumentiert.

## 6. Betroffene Dateien

### Bestehende Dateien (voraussichtliche Änderungen)

- `apps/server/src/orders/order-service.ts` – transaktionale Anfrage- und Outbox-Anlage.
- `apps/server/src/orders/order-routes.ts` – Post-Commit-Zustellung und sichere öffentliche Antwort.
- `apps/server/src/mail/email-template.ts` – Layout-/Sanitizer-Regression; keine Änderung bestehender Maildefaults ohne Bedarf.
- `apps/server/src/mail/mail-service.ts` – pro Mail wählbarer Layoutmodus und Plain-Text.
- `apps/server/src/mail/mail-outbox-service.ts` – Versandzustände, Retry, Claims und Lease-Reconciliation.
- `apps/server/src/mail/hostinger-mail-client.ts` – Transport-/Fehlerklassifizierung ohne undokumentierte Header.
- `apps/server/src/orders/admin-order-routes.ts` – geschützte Status- und Retry-API.
- `apps/server/src/app.ts` – Service-Wiring bzw. nur bei Bedarf interner Wartungseinstieg.
- `apps/admin/src/orders/JournalTab.tsx` – Firmen-/Kundenstatus und Recovery-Aktionen.
- `apps/admin/src/settings/OptionsPage.tsx` – falls erforderlich Admin-Hinweis auf Versandkonfiguration.
- `packages/domain/src/index.ts` – geschützte Status-DTOs; bestehenden öffentlichen Auftragserfolg nicht erweitern.
- `prisma/schema.prisma` – additive Outbox-Felder und kompatible Defaults.
- `apps/server/test/mail-service.test.ts` und `apps/server/test/database/schema.test.ts` – Renderer-, Transaktions- und Retention-Regressionen.
- `apps/customer-form/src/FinalSteps.tsx` – nur falls derzeit Zustellung statt Speicherung versprochen wird.
- `docs/implementation-plan.md`, `docs/implementation-status.md`, `docs/adr/0007-hostinger-mail-und-pdf.md`, `README.md` – nach Umsetzung Status und Betrieb aktualisieren.

### Vorgeschlagene neue Dateien

- `apps/server/src/mail/inquiry-email-template.ts` – aktiver Legacy-Renderer.
- `apps/server/src/mail/mail-maintenance.ts` – serverseitiger Wartungseinstieg, falls die vorhandene Struktur keinen geeigneten besitzt.
- `apps/server/test/database/inquiry-notifications.test.ts` – Ende-zu-Ende-Verträge für Anfragen, Outbox und Recovery.
- Eine neue, additive, zeitgestempelte Migration unter `prisma/migrations/`.

## 7. Risiken und Release-Gates

- **Kein Reply-To-Vertrag:** Die aktuelle Hostinger-OpenAPI erlaubt keinen `Reply-To`-Header. Nicht durch `inReplyTo` oder undokumentierte Felder ersetzen.
- **Keine Exactly-once-Garantie:** Die Provider-API dokumentiert keinen Idempotency-Key. Bei unklarem Ausgang kann ein erneuter Versand doppelte E-Mails erzeugen; deshalb `UNKNOWN` und manuelle Bestätigung.
- **Fehlende Firmenadresse:** Anfrage bleibt gespeichert, aber die Firmenbenachrichtigung ist nicht versandbar. Vollständige, gültige Firmen-/Absenderkonfiguration ist Go-live-Gate.
- **Scheduler:** Retry-Verhalten ist ohne regelmäßig ausgeführten, nachgewiesenen Wartungslauf nicht zuverlässig. Hostinger-Tarif und tatsächliche Ausführung vor Go-live prüfen.
- **Datenschutz/Logging:** E-Mail-Adressen und Nachrichtentexte nicht protokollieren. Status-API nur für autorisierte Mitarbeiter und nur mit minimal erforderlichen Daten.
- **Fachstatus:** Automatische Anfragebestätigung darf neue Anfragen nicht als bearbeitet markieren. Architekturtext hierzu vor Implementierung abstimmen.
