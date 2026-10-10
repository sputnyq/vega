# Vega-Code-Review und Refactoring-Plan

Plan zu `docs/references/issue.md`.
Dieser Plan umfasst ausschließlich Analyse, keine Umsetzung.

**Bezugsstand:** Commit `41fb783dbe4f45f6be9a30a1ca42dfc8a0319d60`;
Arbeitskopie bei Beginn und abschließender Kontrolle sauber.

**Grundlagen:** `AGENTS.md`, `README.md`, `docs/references/review.md`,
`docs/implementation-plan.md`, `docs/target-architecture.md`,
`docs/implementation-status.md` sowie ADR 0001, 0002, 0004, 0005 und 0007.
Die im Issue erwähnten `.opencode/agents/review*.md` sind nicht vorhanden;
die vorhandene Review-Referenz wurde verwendet. Die Ausgabe bleibt gemäß
Auftrag auf Deutsch.

## 1. Gesamteindruck

Die Workspace- und Modulgrenzen passen zum dokumentierten modularen Monolithen;
Katalog, Mitarbeiterverwaltung, Settings, Mail und Uploads haben bereits
erkennbare Verantwortlichkeiten. Das größte Wartbarkeitsrisiko sind einzelne
verdichtete Stellen, insbesondere Rechnungsrouten, Auftragsvalidierung und
Rechnungseditor, deren Verhalten nicht durchgehend hinreichend charakterisiert
ist. Sinnvoll sind kleine lokale Refactorings, nicht ein neues Framework,
eine Repository-Schicht oder eine Neuordnung des gesamten Projekts.

**Review-Grenze:** Modulweise statische Prüfung mit Vertiefung der unten
belegten Stellen und ihrer Aufrufer/Tests, keine vollständige Prüfung jeder
UI-Komponente oder jeder historischen Migration. Es wurden keine Tests oder
Builds ausgeführt, keine Provider aufgerufen und keine Datenbanken verändert.
Die in `docs/implementation-status.md` genannten früheren Testergebnisse sind
kein Nachweis aus diesem Review. Der Sicherheits-Kurzcheck ersetzt keinen
dedizierten Security-Review.

## 2. Bestandsaufnahme

| Bereich | Verantwortung und Einordnung |
|---|---|
| Root, Workspaces und CI | Node 24/npm 11, TypeScript, Oxlint, Tests und Ein-Prozess-Build. `package.json` und `.github/workflows/ci.yml` definieren die vorhandenen Gates; kein neues Lint-/Formatter-System vorschlagen. |
| `apps/server/src/app.ts` | HTTP-Komposition, Header/Logging/CORS, Auth, API-Mounts und statische Frontends/Loader; enthält zusätzlich einzelne Profil-/Auth-/Bildrouten. Die Middleware-Reihenfolge ist relevant und bleibt unangetastet. |
| Auth und `staff/` | Better Auth, Passwortpolicy, TOTP-/Rollengates, Konto-Lifecycle und Recovery. Die Lifecycle-Transaktionen und Last-Admin-Prüfungen sind begründete Struktur, keine pauschalen YAGNI-Kandidaten. |
| `orders/` | Intake, Staff-Bearbeitung, Liste, Kopie, Archiv/Restore, Journal, Validierung und relationale Rekonstruktion. Snapshot und relationale Daten erfüllen unterschiedliche dokumentierte Aufgaben; nicht zusammenstreichen. |
| `catalog/` und `settings/` | Katalog-CRUD, explizite DTO-Projektionen, öffentliche Sichtbarkeit, revisionierte Optionen und Rechnungsnummernkreis. Der wiederverwendbare Katalogeditor bedient mehrere konkrete Seiten und ist keine nutzlose Einmal-Abstraktion. |
| `invoices/` und `pdf/` | Rechnungs-CRUD, Nummernvergabe, Auftragsübernahme und PDF-on-demand. Die Rechnungsroute vermischt HTTP, Validierung, Persistenz und Mapping. |
| `mail/` | Hostinger-Adapter, Mailvorlagen und persistente Outbox. Provider-Fehlercodes und Speicherung vor Versand sind zu erhalten; Versand-/Retry-Änderungen sind kein Refactoring. |
| `uploads/`, `maps/`, Kundenformular-API | GCS-Policies, JPEG-Verifikation, Claims und Leselinks sowie Google-Adress-/Routenanbindung. Prüfung und explizite Providerfehler dürfen nicht durch Browservalidierung ersetzt werden. |
| `apps/admin/` | Auth-/Routenauswahl, Aufträge, Rechnungen, Katalog, Settings und Mitarbeiterverwaltung. Die Rechnungsoberfläche ist besonders verdichtet; die Admin-Tests prüfen derzeit die Routenauflösung. |
| `apps/customer-form/` | Eingebetteter Formularflow, Draft/Payload-Modell, Katalogladen, Bilder und Schrittvalidierung. Eigenständige öffentliche Request-Semantik mit `credentials: "omit"`; nicht mit dem Admin-HTTP-Helper zusammenlegen. |
| `packages/domain/` | Gemeinsame DTOs, Rollen und Katalogverträge. Geeigneter bestehender Ort für eine tatsächlich identische, reine Passwortprüfung. |
| `prisma/` und Tests | Schema, versionierte Migrationen, Bootstrap/Recovery sowie Unit-, HTTP-, DB- und Deployment-Tests. Keine Schemaänderung, Migration oder Datenbereinigung Bestandteil dieses Plans. |

`old-app/` ist nicht Gegenstand dieses Reviews: Es wird keine Funktion portiert
und kein neues Legacy-Sollverhalten abgeleitet.

## 3. Findings

Sortierung nach Schweregrad, innerhalb der Gruppen nach Aufwand.
Kein kritisches Wartbarkeits-Finding aus der durchgeführten Prüfung.
Verhaltensberührende Auffälligkeiten stehen ausschließlich in Abschnitt 6.

| ID | Schweregrad | Aufwand | Fundstelle | Problem und Empfehlung |
|---|---|---|---|---|
| F1 | Wichtig | klein | `apps/server/test/invoice-pdf.test.ts:5-12` | Der Test trägt einen Layoutanspruch im Namen, prüft aber nur `%PDF` und den Dateinamen; `as any` umgeht zusätzlich die Fixture-Typprüfung. Ein PDF mit falschem Kunden, falschen Beträgen oder fehlendem Rechnungstext könnte weiter bestehen. Typisierte Fixture ergänzen. `pdfkit` komprimiert Content-Streams standardmäßig und schreibt Text als Glyph-Codes; Kunde, Beträge oder Rechnungstext sind daher nicht direkt in den PDF-Bytes prüfbar. Inhalt über die an den Renderer übergebenen Daten bzw. extrahierte reine Berechnungs-/Formatierungsfunktionen prüfen und das Layout per manuellem Vergleich sichern; kein PDF-Parser als neue Dependency, keine geänderten Renderer-Optionen. |
| F2 | Wichtig | mittel | `apps/server/src/invoices/invoice-routes.ts:11-95` | HTTP-Antworten, DB-Operationen/Nummerntransaktion, Eingangsvalidierung und DTO-Mapping liegen zusammen. Das erschwert isolierte Charakterisierung und macht Änderungen am Validator unnötig abhängig vom Router. Erst reine Input-/Mapping-Funktionen, danach zusammenhängende Schreiboperationen auslagern; die vorhandenen `*-input.ts`-/`*-service.ts`-Muster nutzen, ohne zusätzliche generische Schichten. |
| F3 | Wichtig | mittel | `apps/server/src/orders/order-input.ts:148-277` | `validateDetails` behandelt Nebenadressen, Möbel, Leistungen, Angebotsbasis und Konditionen in einem Ablauf mit vielen Zwischenvariablen und mehrfachen Flags. Kleine fachlich benannte private Validatoren im selben Modul extrahieren. Reihenfolge der Fehler, Defaultwerte, erlaubte Entwürfe und Staff-/Public-Unterschiede müssen identisch bleiben. |
| F5 | Hinweis | klein | `apps/admin/src/password-policy.ts:4-10`; `apps/server/src/password-policy.ts:5-11` | Dieselbe Prüfung auf Länge (8–128) sowie Großbuchstabe, Kleinbuchstabe und Ziffer (jeweils `[A-Z]`, `[a-z]`, `[0-9]`) ist zweimal implementiert. Die reine Prüfung samt Längenkonstanten über das vorhandene Domain-Package teilen; die bisherigen Exporte und die unterschiedlichen Texte (Admin-Hilfetext, Server-Fehlermeldung) erhalten. Keine Änderung an erlaubten Zeichen, Passwortgrenzen oder Better-Auth-Konfiguration. |
| F6 | Hinweis | klein | `apps/admin/src/catalog/catalog-api.ts:6-18`; `apps/admin/src/settings/UserManagementPage.tsx:5,32,50-53`; `apps/admin/src/settings/OptionsPage.tsx:4,49,57,97`; `apps/admin/src/orders/RouteDistance.tsx:3,18`; `apps/admin/src/orders/BasisTab.tsx:5,23`; `apps/admin/src/orders/ExtrasTab.tsx:5,23-24`; `apps/admin/src/orders/FurnitureTab.tsx:5,24` | Der generische Admin-Request-Helper heißt `catalogRequest` und liegt im Katalogmodul, obwohl Settings, Mitarbeiterverwaltung und Auftragsbearbeitung ihn ebenfalls nutzen. Das suggeriert eine fachliche Abhängigkeit, die die Funktion nicht hat. In einen neutralen Admin-API-Ort verschieben und treffend benennen; Credentials, Envelope-Verarbeitung und auch bestehende Fallbacktexte unverändert übernehmen. Keine flächendeckende Umstellung anders arbeitender Fetch-Aufrufer. |
| F4 | Hinweis | mittel | `apps/admin/src/invoices/InvoiceEditorPage.tsx:31` | Kundendaten, Rechnungsdaten, Positionsliste, wiederholte Positionsupdates und Aktionen sind in einem einzigen JSX-Ausdruck verschachtelt. Gemeint ist nicht nur Formatierung: lokale benannte Render-/Update-Helper trennen konkrete Verantwortlichkeiten. State und Hooks bleiben in der bestehenden Komponente; keine neue Form-Engine, kein neuer DOM-Wrapper und keine geänderten Keys. |

Positiv: Explizite öffentliche Projektionen, echte DB-Tests für Beziehungen und
Nummern sowie die serverseitigen Auth-/Rollengates liefern bereits wichtige
Sicherungsanker. Vorhandene generische Katalogbausteine und Provider-Adapter
haben konkrete Verbraucher; sie werden nicht allein wegen ihrer Abstraktion
zum Umbau vorgeschlagen.

## 4. Umsetzungsplan für spätere, separat freizugebende Arbeit

Alle Schritte sind Todos, keine Umsetzung in diesem Auftrag. Jeder Schritt
wird einzeln geprüft. **Risiko für UI und Business-Logik: keines** bezeichnet
hier den zugelassenen Umfang: Es ist keine Verhaltensänderung vorgesehen.
Es ist keine Garantie gegen Implementierungsfehler. Fehlt die genannte
Absicherung oder zeigt sie eine Abweichung, ist der jeweilige Schritt blockiert
und darf nicht durch eine stillschweigende neue Sollregel ersetzt werden.

### 1. Passwort- und Auftragsvalidierung charakterisieren

- **Ziel/Dateien:** `apps/server/test/password-policy.test.ts`,
  `apps/server/test/order-input.test.ts` und ein neuer Test für
  `apps/admin/src/password-policy.ts` unter `apps/admin/test/`. Beide
  Verzeichnisse laufen bereits in `npm test`; dieselbe Testmatrix belegt die
  Parität der Admin- und Server-Passwortfunktionen.
- **Begründung:** Voraussetzung für F3/F5. Vollständige Rückgabewerte und
  geordnete Fehlerlisten prüfen, nicht lediglich `ok` oder einzelne Felder.
  Public, Staff mit Preisen und unvollständige Staff-Entwürfe unterscheiden.
- **Aufwand:** mittel. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Bestehende Tests zunächst unverändert ausführen; neue
  Charakterisierungstests müssen gegen den unveränderten Code bestehen.
  Grenzfälle in Abschnitt 5 verwenden.

### 2. Rechnungs-HTTP- und PDF-Verhalten charakterisieren

- **Ziel/Dateien:** `apps/server/test/database/schema.test.ts`,
  `apps/server/test/app.test.ts`, `apps/server/test/invoice-pdf.test.ts`;
  bei Bedarf eine gezielte Rechnungs-Testdatei im bestehenden Testmuster.
- **Begründung:** F1/F2. Die vorhandene DB-Prüfung unter
  `apps/server/test/database/schema.test.ts:149-226` deckt relationale
  Auftragsoperationen und die Rechnungsadresse ab, aber nicht den vollständigen
  Rechnungs-Lifecycle. HTTP-Status, Envelope, Fehlertexte, Nummern,
  Archiv/Restore und PDF-Export/Journaleffekt vor dem Umbau festhalten.
- **Aufwand:** mittel. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Nur die ausdrücklich separate `_test`-Datenbank verwenden.
  PDF-Fixture ohne `as any`. Inhalt/Beträge nicht in den komprimierten
  PDF-Bytes suchen, sondern über Renderer-Eingaben bzw. reine
  Berechnungs-/Formatierungsfunktionen prüfen; Erscheinungsbild per
  dokumentiertem manuellem Vergleich sichern. Kein PDF-Parser als neue
  Dependency, keine geänderten `pdfkit`-Optionen. Keine Produktionsdaten oder
  realen Providerzugänge.
  Keinen Vergleich instabiler vollständiger PDF-Bytes einführen.

### 3. Identische Passwortprüfung teilen

- **Ziel/Dateien:** `packages/domain/src/index.ts` und beide bestehenden
  `password-policy.ts`-Module; zugehörige Tests aus Schritt 1.
  `apps/admin/package.json` deklariert `@vega/domain` bisher nicht, obwohl
  der Admin es bereits importiert (funktioniert nur über das Hoisting der
  npm-Workspaces). Die Workspace-Abhängigkeit im selben Schritt explizit
  eintragen und `package-lock.json` per npm aktualisieren.
- **Begründung:** F5; eine einzige Implementierung verhindert Drift.
  Bestehende Modul-Exporte können auf die gemeinsame Funktion verweisen,
  damit nicht sämtliche Verbraucher gleichzeitig geändert werden müssen.
- **Aufwand:** klein. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Schritt 1; beide Oberflächen liefern für dieselbe
  Testmatrix exakt die bisherigen Ergebnisse und Texte.
  Backend bleibt die autoritative Prüfungsstelle.

### 4. Rechnungsinput und Mapping isolieren

- **Ziel/Dateien:** `apps/server/src/invoices/invoice-routes.ts`,
  ein kleines `invoice-input.ts` und bei Bedarf ein lokaler Mapping-Helper
  im Rechnungsmodul.
- **Begründung:** Erster Teil von F2. Vorhandene reine Funktionen verschieben,
  nicht durch ein neues Schemaframework ersetzen oder Regeln vereinheitlichen.
  Keine vorsorgliche DTO-/Repository-Hierarchie.
- **Aufwand:** klein. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Schritt 2; Validator-Ausgabe, Kürzung/Trim, optionale Werte,
  serialisierte DTO-Felder und bisherige Fehlerreaktionen bleiben exakt gleich.
  Auffällige bestehende Datumsregeln nicht im selben Schritt korrigieren.

### 5. Rechnungs-Schreiboperationen aus dem Router lösen

- **Ziel/Dateien:** `apps/server/src/invoices/invoice-routes.ts`,
  neu `apps/server/src/invoices/invoice-service.ts` (existiert noch nicht).
- **Begründung:** Zweiter Teil von F2. Zusammenhängende Persistenzoperationen
  mit benannten Funktionen kapseln; der Router bleibt für HTTP und das
  bestehende Error-Mapping verantwortlich. Einzeilige Listen-/Lesefunktionen
  nicht allein für eine formale Schicht durchreichen.
- **Aufwand:** mittel. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Schritte 2 und 4. Gleiche Transaktionsgrenzen, Reihenfolge,
  Nummernvergabe einschließlich manuell gesetzter Nummern, Konflikte,
  Archivzeiten und PDF-/Journal-Reihenfolge nachweisen. Keine Änderungen an
  Auth-Mounts, Schema oder Archivregeln.

### 6. Auftragsdetails in private Teilvalidatoren zerlegen

- **Ziel/Dateien:** `apps/server/src/orders/order-input.ts` und Tests aus
  Schritt 1.
- **Begründung:** F3. Möbel, Extras, Basis und Konditionen einzeln aus dem
  bestehenden Ablauf extrahieren; die Orchestrierung bleibt sichtbar.
  Keine generische Validator-DSL und kein automatisches Zusammensammeln
  aller Fehler in anderer Reihenfolge.
- **Aufwand:** mittel. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Schritt 1 sowie vorhandene Relationstests. Gültige
  Payloads, normalisierte Werte und ungültige Payloads samt geordneter
  `issues`-Liste müssen unverändert sein.

### 7. Admin-Request-Helper neutral benennen und verschieben

- **Ziel/Dateien:** `apps/admin/src/catalog/catalog-api.ts` und dessen
  vorhandene Importstellen in Katalog, Orders und Settings.
- **Begründung:** F6. Fachlich falsche Abhängigkeitsrichtung entfernen,
  ohne eine neue Abstraktion einzuführen.
- **Aufwand:** klein. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Request-Charakterisierung für GET/POST/PUT/DELETE,
  Body-Abwesenheit, `credentials: "same-origin"`, fehlendes `data`,
  HTTP-Fehler, Feldfehler und JSON-/Netzwerkfehler. Exakte bestehende
  Fallbacktexte erhalten. Öffentlichen Kundenformular-Client nicht anfassen.

### 8. Rechnungseditor lokal entflechten

- **Ziel/Dateien:** `apps/admin/src/invoices/InvoiceEditorPage.tsx`.
- **Begründung:** F4. Kleine lokale Helper für Formularabschnitte und
  Positionsupdates, keine globale Formularabstraktion. State, Hook-Reihenfolge,
  elementare DOM-Struktur und Mount-Verhalten bleiben erhalten.
- **Aufwand:** mittel. **Risiko für UI und Business-Logik:** keines.
- **Absicherung:** Vorher-/Nachher-Prüfung aus Abschnitt 5. Entschieden ist
  ein dokumentierter manueller Browservergleich plus vorhandene Checks, ohne
  neue Dependencies und ohne automatisierten Browser-Test-Runner
  (`apps/admin/package.json:6-10` enthält keinen). Die unveränderte
  Oberfläche ist vorab als Referenz zu sichern; ohne diese Referenz keine
  Umsetzung.
  Lade-/Fehlerzustände und Speichern dürfen nicht nebenbei verbessert werden.

## 5. Absicherungsstrategie

| Oberfläche | Vor dem betreffenden Refactoring nachzuweisendes Verhalten |
|---|---|
| Passwort | Länge 7/8/128/129, fehlende Zeichenklassen, ASCII-/Nicht-ASCII-Zeichen, Leerzeichen und identische Ergebnisse beider vorhandenen Funktionen. Keine neue Passwortregel. |
| Auftragsvalidator | Vollständiger Kunde und Staff-Entwurf; fehlende, leere und falsch typisierte Werte; ausgeblendete/eingeblendete Nebenadressen; Möbel-/Service-/Konditionsgrenzen; öffentliche Preisverbote; Daten/Uhrzeiten. Die vollständige normalisierte Ausgabe und Fehlerreihenfolge sind die Referenz. |
| Rechnungs-API | Blanco und Auftragsübernahme; bestehende 1:1-Beziehung; automatische/manuelle Nummern und Rollback; PUT, Konflikte, Suche, Archiv/Restore und fehlende IDs; identische Statuscodes, Header, JSON-Antworten und Journalaktionen. Bestehende, möglicherweise ungewollte Fehlerantworten nicht als Teil des Refactorings korrigieren. |
| PDF | Kunde/Adresse, Nummer/Datum, Positionen, Netto/Steuer/Gesamt, Rechnungstext und Dateiname; kurze und lange Texte sowie mehrere Positionen. Inhalte über Renderer-Eingaben bzw. reine Funktionen prüfen, nicht in komprimierten PDF-Bytes. Layout per manuellem Vergleich anhand des unveränderten Vega-Renderers festhalten, nicht anhand eines neu interpretierten Legacy-Solls. Keine Änderung von Rundung, Zeitformat oder Pagination. |
| Admin-Request-Helper | Fetch-Argumente und Rückgabe-/Fehlerverhalten mit dem vorhandenen `node:test`-Runner charakterisieren. Nicht nur Importnamen oder Quelltext prüfen. |
| Rechnungseditor | Neu/Bearbeiten, ausgefüllte Felder, Positionsanlage/-änderung/-löschung, Lade-/Fehler-/Erfolgzustände, Save-Payload, Weiterleitung und PDF-Link. Vorher-/Nachher-Browserprüfung bei schmalem und breitem Viewport; DOM-Reihenfolge, Texte, `sx`, Props und kompakte MUI-Defaults bleiben identisch. |

Die vorhandene Admin-Testsuite `apps/admin/test/routes.test.ts:1-43`
prüft Routenauflösung, nicht den gerenderten Rechnungseditor. Sie ist daher
allein kein ausreichendes Gate für Schritt 8.

Für jede spätere Codeänderung gelten mindestens `npm run typecheck`,
`npm test` und `npm run build` unter Node 24. Ergänzend `npm run lint`;
für DB-betroffene Schritte `npm run test:database` gegen die separate Test-DB
und für Auslieferung/Loader `npm run test:deployment` nach dem Build.
Installation aus dem vorhandenen Lockfile; keine Dependencies vorsorglich
hinzufügen.

## 6. Offene Fragen und ausdrücklich ausgeschlossene Verhaltensänderungen

| Punkt | Beleg | Einordnung |
|---|---|---|
| Rechnungsvalidierung | `apps/server/src/invoices/invoice-routes.ts:83-93`; zum Vergleich `apps/server/src/orders/order-input.ts:141-146` | Rechnungsdatum wird nur über sein Format geprüft, Positionen/Fälligkeiten haben andere Zahlen-/Datumsprüfungen als Orders. Strengere Annahmeregeln würden das Verhalten ändern. Separat prüfen und als Fehlerbehebung freigeben, nicht bei der Extraktion angleichen. |
| Fehlgeschlagenes Archiv/Restore im Rechnungsfrontend | `apps/admin/src/invoices/InvoicesPage.tsx:8` | Der Mutation-Response wird nicht auf `ok` geprüft; anschließend wird neu geladen. Eine neue Fehlermeldung oder geänderte Reload-Regel verändert die UI und gehört in einen separaten Fehlerbehebungsauftrag. |
| Outbox nach Prozessabbruch und Retry-Zählung | `apps/server/src/mail/mail-outbox-service.ts:42-48,75,83-89` | Ein Claim setzt `SENDING`; der Due-Scan selektiert nur `PENDING`/`FAILED`. Außerdem wird nach bereits erhöhtem `attempts` nochmals `+ 1` für die Retry-Zeit verwendet. Crash-Recovery, Retry-Timing und Doppelversand müssen separat gegen die gewünschte Mailsemantik geprüft werden. Kein automatisches Zurücksetzen oder Retry-Umbau im Refactoring. |
| Breite Auth-Fehlerabbildung | `apps/server/src/app.ts:141-155,217-223`; Vergleich `apps/server/src/staff/staff-routes.ts:39-43` | Profil/Initialpasswort bilden jeden Fehler der betreffenden Auth-Operation als 400 ab, während Staff bekannte API-Fehler differenziert. Eine Vereinheitlichung verändert Statuscodes und Meldungen; separat entscheiden, nicht globales Catch-Cleanup. |
| Veralteter DTO-Kommentar | `packages/domain/src/index.ts:102-103`; Preisfelder `packages/domain/src/index.ts:95-97` | „Prices are deliberately absent“ beschreibt den heutigen Vertrag nicht vollständig, weil Staff-Preise in `details.basis` existieren. Den Kommentar später an den belegten bestehenden Vertrag anpassen, nicht Preisfelder entfernen oder den öffentlichen Vertrag erweitern. |

Für mögliche Sicherheitsfolgen dieser Robustheitsauffälligkeiten ist bei Bedarf
ein dedizierter Security-Review anzusetzen. Dieser Bericht behauptet weder
nachgewiesene Exploitability noch vollständige Sicherheit.

Autoritative Preisberechnung, Cron/Purge, Provider-Proofs, gesetzliche externe
Belegaufbewahrung und noch offene Fachfunktionen bleiben in den dokumentierten
Arbeitspaketen. Sie werden nicht als Refactoring oder neues Review-Gate
eingeschmuggelt.

## Abhängigkeiten der späteren Todos

- Schritt 3 benötigt Schritt 1.
- Schritt 4 benötigt Schritt 2.
- Schritt 5 benötigt Schritte 2 und 4.
- Schritt 6 benötigt Schritt 1.
- Schritt 7 ist fachlich unabhängig; sein eigener Charakterisierungstest ist
  Teil dieses Schritts und muss vor dem Verschieben bestehen.
- Schritt 8 benötigt eine geprüfte manuelle Vorher-Referenz, nicht die
  Backend-Refactorings. Die Absicherungsstrategie ist entschieden.
- Schritte 1 und 2 sind unabhängig.

**Ergebnis:** Nur dieser Plan. Die spätere Umsetzung benötigt einen
eigenen Auftrag.
