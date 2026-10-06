# Umzug Ruck Zuck – Umsetzungsplan

**Status:** abgestimmte Zielplanung für die Umsetzung durch Agents  
**Stand:** 2026-10-05  
**Wichtig:** Dieser Plan beschreibt Zielarchitektur und Arbeitspakete. Er nimmt noch keine Codeänderungen vor.

## 1. Ziel

Die heutigen zusammengehörenden Funktionen werden in **einer verwalteten Node.js-App bei Hostinger** zusammengeführt. WordPress bleibt die öffentliche Website und Einbettungsfläche des Kundenformulars. Das bisherige WordPress-Plugin, die bisherigen Daten und die alten Deployments sind keine Ziel-Backends und werden nicht migriert.

Die neue App startet mit einer **frischen Hostinger-MySQL-Datenbank**. Stammdaten wie Möbel, Kategorien, Services und Standardpreise werden vom Betreiber nach dem Start manuell angelegt.

## 2. Festgelegter Umfang

### Enthalten

- Ein öffentliches, deutschsprachiges, umfangreiches Umzugsformular auf der WordPress-Hauptseite.
- Das bestehende Script-Einbettungsmodell bleibt; WordPress ruft einen kleinen Loader auf der Vega-Subdomain auf. Der Loader stellt absolute Asset-/API-Pfade bereit.
- Das Berater-/Admin-Frontend auf der Vega-Subdomain.
- Auftragsbearbeitung, Angebotskopien, Preis-/Service-/Möbel-/Kategorieverwaltung, Buchhaltung, Rechnungen, Gutschriften, Mahnungen und E-Mail-Abläufe.
- Serverseitige Validierung, Geschäftsregeln, Preisberechnung, Berechtigungen, PDFs und E-Mail-Versand.
- Kundenbilder: lokale Vorschau und Browser-Komprimierung, danach Upload in einen privaten Google-Cloud-Storage-Bucket in einer EU-Region.

### Ausgeschlossen

- Eigenständiges Expressformular.
- Eigenständige Möbellisten-Seite.
- Möbel-/Volumenrechner, auch innerhalb des umfangreichen Formulars.
- Kundenkonten oder ein globales Kundenprofil.
- Übernahme alter Aufträge, Kunden, Bilder, Rechnungen oder sonstiger Altdaten.
- Betrieb mehrerer separater Node-/Mail-Services.

## 3. Technologievorgaben

- Hostinger verwaltete Node.js-Web-App, Node.js **24 LTS**.
- Express **5** als HTTP-Server/API.
- TypeScript **7** für Server und Frontends.
- Vite, React **19**, aktuelle Material-UI-Version zum Umsetzungszeitpunkt.
- Better Auth für Mitarbeiter-Authentifizierung.
- Prisma mit versionierten Migrationen gegen Hostinger MySQL.
- Hostinger Mail API, direkt und ausschließlich serverseitig.
- Google Cloud Storage für neue Bilder.
- Google Places für Adresssuche mit bisheriger Länderbeschränkung Deutschland/Österreich.

Vor dem Scaffold sind die exakten Paketversionen gemeinsam in Lockfile/Engines festzulegen. Hostinger dokumentiert Node 24.x als unterstützte Laufzeit; die Kompatibilität von TypeScript 7, Prisma, Better Auth, Express 5 und MUI ist trotzdem im Build-Proof zu verifizieren.

## 4. Zielverhalten

### 4.1 Kundenformular und öffentliche API

- Kunden benötigen keinen Login.
- Öffentliche API: nur POST zum Einreichen einer Anfrage sowie GET für ausdrücklich kundenrelevante Katalog-/Angebotsdaten.
- Öffentliche Datenantworten enthalten ausschließlich freigegebene Felder, beispielsweise Name, Beschreibung, Auswahloption und Kundenpreis. Es gibt keine öffentlichen Auftrags-/Kundenlese-Endpunkte und keine generischen Optionsendpunkte.
- Der Formular-POST wird serverseitig validiert und vor Mailversand dauerhaft gespeichert.
- CORS wird auf die konfigurierte WordPress-Origin begrenzt. CORS ist kein Authentifizierungs- oder Zugriffsschutz.
- Öffentliche Requests erhalten Rate-Limits. Es gibt zunächst weder CAPTCHA noch Honeypot.
- Serverseitige Feld-/Schema- und Größenprüfung ist obligatorisch. Client-Validierung bleibt nur UX-Hilfe.

### 4.2 Authentifizierung und Rechte

- Rollen: `Admin` und `Kundenberater`.
- Anmeldung mit E-Mail/Passwort; neu gesetzte Passwörter müssen mindestens 8 Zeichen einschließlich Großbuchstabe, Kleinbuchstabe und Zahl enthalten. Passwort-Reset über Hostinger-Mail; TOTP-Zwei-Faktor-Authentifizierung verpflichtend für beide Rollen. Mitarbeiter-E-Mail-Adressen müssen nicht verifiziert werden.
- Keine öffentliche Registrierung. Admins können Mitarbeiterkonten anlegen/sperren und auch die Rolle `Admin` vergeben; für ein Konto können sie eine Passwort-Reset-Mail auslösen.
- Erneute Anmeldung ist spätestens alle 30 Tage erforderlich (absolute Session-Höchstdauer; Aktivität verlängert die Session nicht).
- Erster Admin: einmaliger, serverseitiger Bootstrap, danach deaktiviert. Kein öffentliches Setup.
- Erstadmin wird über einen einmaligen Prisma-Seed als `root_user` angelegt. `INITIAL_ADMIN_EMAIL` und `INITIAL_ADMIN_PASSWORD` sind serverseitige Runtime-Variablen und nach dem Seed zu entfernen. Beim ersten Login ist Passwortwechsel plus erfolgreiches TOTP-Enrollment erforderlich, bevor geschützte Admin-Funktionen zugänglich sind.
- Wiederherstellungscodes bei 2FA-Einrichtung; Admin-Reset für andere Accounts; dokumentierter serverseitiger Recovery-Pfad für den einzigen Admin. Ob sicherheitskritische Kontoänderungen zusätzlich Re-Authentifizierung verlangen, bleibt offen.
- Admin darf alle Bereiche bedienen, darunter Mitarbeiterkonten, globale Preise, Kataloge und Buchhaltung.
- Kundenberater dürfen Anfragen/Aufträge bearbeiten, Einzelangebote erstellen/kopieren/anpassen/archivieren, individuelle Einzelangebotspreise ändern, E-Mails mit PDF versenden und Aufträge archivieren/wiederherstellen.
- Kundenberater ändern keine globalen Preisvorgaben, Möbel-/Service-/Kategorie-Stammdaten oder Benutzer und bearbeiten keine Rechnungen/Buchhaltung.
- Autorisierung wird in jedem Server-Use-Case/API-Endpunkt geprüft; UI-Ausblendung allein ist kein Schutz.

### 4.3 Aufträge, Angebotskopien und „edited“

- Eine Angebotsvariante bleibt wie bisher ein **eigener Auftragsdatensatz** mit eigener fortlaufender Auftragsnummer. Eine neue Kundenanfrage und jede Kopie erhalten eine neue Nummer; Startwert des Auftragskreises: `1000`.
- Angebotskopien werden unabhängig bearbeitet und archiviert. Änderungen/Löschen an einer Kopie kaskadieren nicht auf Ursprung oder Geschwisterkopien. Beim Erzeugen mehrerer Angebote werden mehrere PDF-Dokumente mit jeweils eigener Auftragsnummer versendet.
- Ursprungsbeziehung bleibt erhalten, solange der Ursprungsdatensatz existiert. Datenbankbeziehungen dürfen beim Löschen keine Geschwisterdatensätze löschen.
- Es gibt keinen allgemeinen Statusautomaten. Das bestehende Bearbeitungskennzeichen wird als Boolean `edited` umgesetzt:
  - Neue Kundenanfrage: `false`.
  - Angebotskopie: bei Erstellung `true`.
  - Tatsächliche Bearbeitung oder erfolgreicher In-App-Mailversand: aktueller Datensatz wird `true`.
  - Öffnen/Ansehen allein ändert das Feld nicht.
  - Änderungen an Kopien setzen weder Ursprung noch Geschwisterkopien auf `true`.
  - Extern versandte E-Mails können nicht als tatsächlicher Versand erkannt werden.
- Audit-/Aktionsprotokoll: Aktion, Zeitstempel, Benutzername und Auftrags-/Angebotsbezug. Keine Feld-Diffs oder Vorher-/Nachher-Werte. E-Mail-Versand wird nur bei Erfolg als versendet markiert. Audit-Einträge werden mit dem Auftrag gelöscht.

### 4.4 Archivierung und Aufbewahrung

- Aufträge werden nur durch ausdrückliche Benutzeraktion archiviert. Eine separate Archivansicht erlaubt Wiederherstellung.
- Kundenberater und Admins dürfen Aufträge archivieren/wiederherstellen.
- Wiederherstellen stoppt die 60-Tage-Frist; erneutes Archivieren startet sie neu.
- Ein täglicher Hostinger-Cronjob entfernt Datensätze, die seit mindestens 60 Tagen archiviert sind. Er löscht nur den ausgewählten Auftrag/die Kopie und zugehörige Aktionsprotokolle, nicht Geschwister.
- GCS-Bilder werden bei Auftragslöschung nicht aktiv gelöscht.
- Admins archivieren Rechnungen, Gutschriften und Mahnungsdatensätze/-ereignisse einheitlich; alle sind bis zur endgültigen Löschung wiederherstellbar. Ein täglicher, idempotenter Purge entfernt jeden dieser Finanzdatensätze 30 Tage nach seiner Archivierung; erneutes Archivieren startet die Frist neu.
- Die externe gesetzliche Aufbewahrung ausgestellter Rechnungen/Gutschriften liegt außerhalb der App und in der Verantwortung des Betreibers. Vor Änderungen, Archivierung oder Purge muss der externe Archivprozess durch Buchhaltung/Steuerberatung bestätigt sein; ein Confirmation-Dialog beweist keine externe Sicherung.

### 4.5 Datenmodell

- Keine zentrale Kundenkartei. Kundendaten bleiben beim jeweiligen Auftrag/Angebotsdatensatz.
- Prisma/MySQL-Modell mit relationalen, durch Migrationen versionierten Tabellen. Suchbare/identitätskritische Felder werden nicht ausschließlich als unvalidierter Blob gespeichert.
- Mindestbereiche: Auth/Benutzer/Rollen, Aufträge, Auftragsadressen/-positionen, Möbel/Kategorien/Services/Preisvorgaben, GCS-Referenzen, Aktionsprotokolle, E-Mail-Outbox/-Ereignisse, Rechnungen, Gutschriften und Mahnungsereignisse.
- Auftrags-/Rechnungsnummern sind von internen DB-IDs getrennt. Nummern werden serverseitig transaktional vergeben und eindeutig validiert.
- Rechnungen liegen in einer eigenen Tabelle, genau eine Rechnung pro Angebot/Auftragskopie. Die Rechnung ist nach Rechnungsnummer, Auftragsnummer und Kundenname suchbar.
- Rechnung verweist auf das Angebot, aber das Löschen des Auftrags löscht die Rechnung nicht. Auftragsnummer und Kundenname werden als Such-Snapshot in der Rechnung gespeichert; eine FK-Beziehung darf nur gelöst werden, nicht kaskadierend löschen.
- Rechnungsnummernkreis ist getrennt, fortlaufend, über die Admin-Oberfläche initialisier- und später editierbar. Die gedruckte Rechnungsnummer ist nicht die DB-ID.
- Rechnungen sind einfache CRUD-Datensätze ohne Versionshistorie. Änderungen überschreiben den aktuellen DB-Stand.
- PDFs werden im Backend bei Bedarf erzeugt und heruntergeladen bzw. als Mailanhang erzeugt; es gibt keine dauerhaft gespeicherten PDF-Dateien. Admins sichern benötigte externe PDF-Stände selbst.
- Gutschriften bleiben optional, eine pro Rechnung, in eigener Tabelle und mit Nummerierungsverhalten wie bisher. Mahnungen werden als Ereignisse an Rechnungen gespeichert. Rechnungen, Gutschriften und Mahnungsereignisse erhalten eigene Archiv-/Purge-Felder; Admins archivieren sie einheitlich und der App-Purge erfolgt jeweils 30 Tage danach.

### 4.6 E-Mail und PDF

- Alle bisherigen E-Mail-Flows laufen über die Hostinger Mail API: Anfragebestätigung an Firma und Kunde, Angebote, Absagen, Rechnungen und Mahnungen.
- E-Mail-Vorlagen bleiben codebasiert wie bisher. Kundenberater dürfen den konkreten Text/Betreff vor jedem Versand bearbeiten.
- Firmenempfänger, Absendername und Absenderadresse sind nicht geheime Admin-Einstellungen. Hostinger API-Token und Mailbox-ID sind ausschließlich serverseitige Umgebungsvariablen.
- Requests werden zuerst gespeichert. Mailfehler verlieren keine Anfrage; Fehler werden angezeigt/protokolliert und können erneut versucht werden.
- In-App-Mailaktionen protokollieren Actor/Aktion/Zeit. Versand gilt nur bei erfolgreicher Hostinger-API-Antwort als gesendet. Kopieren eines Texts für externen Versand protokolliert keinen tatsächlichen Versand.
- Bestehende Angebots-/Rechnungs-PDF-Layouts bleiben zunächst erhalten; PDF-Erzeugung wandert vom Browser ins Backend.

### 4.7 Bilder

- Browser komprimiert vor Upload auf JPEG, längste Kante höchstens 2000 px, Qualität ca. 80 %, höchstens 10 MB je Bild.
- **Keine Begrenzung der Bildanzahl pro Auftrag.** Nur Bilddateien; keine Word-, PDF- oder sonstigen Dokumentdateien.
- Private GCS-Bucket in EU-Region. Browser erhält nur kurzlebige, eingeschränkte Upload-/Download-Links, keine GCS-Zugangsdaten.
- Backend prüft Uploadanfrage, Dateimetadaten/-typ/-größe und die Zuordnung zum Auftrag. Clientfilter allein ist keine Sicherheitskontrolle.
- GCS-Lifecycle löscht Objekte 180 Tage nach Upload, unabhängig davon, ob der Auftrag archiviert/gelöscht wurde. Bildlinks im Datensatz dürfen danach ungültig sein.

## 5. Anwendungsschnittstellen (Planvertrag)

Die exakten DTOs werden vor paralleler API-/Frontend-Arbeit gemeinsam versioniert. Grobe Trennung:

- `GET /api/public/catalog/...`: kundensichere Listen/Preise für die tatsächlich aktiven Schritte des langen Formulars.
- `POST /api/public/orders`: Validierung, Preis-/Domänenprüfung soweit relevant, persistente Anfrageanlage und anschließende E-Mail-Outbox.
- `POST /api/public/uploads/...`: Upload-Sitzung/kurzlebige GCS-Berechtigungen; Uploadobjekte müssen dem finalen Auftrag zuordenbar sein.
- `/api/auth/*`: Better Auth.
- `/api/admin/orders`, `/api/admin/catalog`, `/api/admin/invoices`, `/api/admin/credits`, `/api/admin/reminders`: ausschließlich autorisierte Bereiche.
- Keine Alt-WordPress-REST-Route als Zielvertrag übernehmen.

## 6. Empfohlene Code-/Deployment-Struktur

Ein Root-Repository mit npm Workspaces, ein Build-/Releaseprozess und ein Hostinger-Prozess. Vorgeschlagene Grenzen:

```text
apps/
  server/          Express 5, Better Auth, API, Prisma, Mail, PDF, GCS
  admin/           React 19 / Vite / MUI – Berater/Admin-SPA
  customer-form/   React 19 / Vite – nur langes Formular
packages/
  domain/          geteilte DTOs, Validierung und fachliche Typen
prisma/            schema.prisma und versionierte Migrationen
docs/              Architektur, ADRs, Glossar, Betriebsanweisungen
```

Express liefert Admin-SPA, öffentlichen Formular-Loader/-Bundles und APIs aus. WordPress enthält nur den Embed-Aufruf/Loader-Kontext und bleibt Content-CMS. Domains, Auth-Basis-URL, CORS-Origins und Geheimnisse kommen aus Hostinger-Runtime-Variablen, nicht aus dem Vite-Build.

## 7. Arbeitspakete für Agents

Die Reihenfolge ist verbindlich. Parallelisierung erst nach festgelegten API-/Prisma-Verträgen.

### A0 – Integrations- und Kompatibilitäts-Proof

**Abhängigkeit:** keine.  
Prüfen: Hostinger Node 24/Build-/Start-/Cron-Verhalten; TypeScript 7/Prisma/Better Auth Paketkompatibilität; Hostinger Mail API Attachment-Vertrag; GCS Signed-URL-/Lifecycle-Konfiguration; WordPress-Loader mit absolut aufgelösten Pfaden und CORS. Genaue Werte dokumentieren, keine Produktionsdaten migrieren.

**Abnahme:** Minimaler End-to-End-Proof läuft in nicht-produktiver Umgebung; bekannte Plan-/Tarifgrenzen sind notiert.

### A1 – Root-App und Build

**Abhängigkeit:** A0.  
Root npm workspace, feste Engines/Lockfile, TypeScript-Konfiguration, Lint/Test/Build, Express-Startpunkt und Hostinger Healthcheck. Frontends als getrennte Vite-Builds, ein Node-Prozess.

**Abnahme:** sauberer CI-Build; ein Deployment startet API und liefert Admin-/Formularassets aus.

### A2 – Prisma-Schema und Migrationen

**Abhängigkeit:** A1.  
Fresh MySQL schema für Auth, Rollen, Aufträge/Kopien, Kataloge/Preisvorgaben, Bilderreferenzen, Events, Rechnungen, Gutschriften und Mahnungen. Uniqueness, FK-Regeln ohne unerwünschte Kaskaden, Indexe für Suchfelder, Nummernkreise, Archivfelder und `edited` definieren.

**Abnahme:** Migrationen bauen eine leere DB vollständig auf; Löschtests belegen, dass Auftrag/Kopie keine Geschwister oder Rechnungen kaskadierend entfernen.

### A3 – Better Auth und Rollen

**Abhängigkeit:** A2.  
Better Auth Version pinnen; Prisma-Schema mit der passenden Better-Auth-CLI-Version und aktivierten Plugins generieren/aktualisieren. E-Mail/Passwort, Reset-Mail, TOTP-Plugin plus Client-Plugin, verschlüsselte Recovery-Codes, Admin-Einladung/-Sperrung, zwei Rollen, Berechtigungs-Middleware und einmaliger First-Admin-Bootstrap.

**Abnahme:** kein öffentlicher Signup; Admin/Kundenberater-Matrix serverseitig getestet; Bootstrap nach Einrichtung nicht erneut nutzbar; 2FA ist vor Zugriff auf Kundendaten aktiviert; CSRF/Origin-Checks und Auth-Rate-Limits bleiben aktiv.

### A4 – Geschäftslogik und API

**Abhängigkeit:** A2; A3 für geschützte Routen.  
Servervalidierung und autoritative Preise, Order-/Copy-/Archive-/Restore-Use-Cases, Nummernvergabe, `edited`, safe public DTOs, Rate-Limits, CORS, Upload-Sitzungen und Audit-/Email-Events.

**Teilstatus:** `POST /api/orders` und die Legacy-nahe Admin-Neuanlage sind
umgesetzt: validierte Kunden-, Mehrfachadress-, Umzugsgut-, Zusatzleistungs-,
Termin- und Konditionsdaten können anonym oder mit abgeschlossener Staff-Session
gespeichert werden; anonyme Aufrufe sind rate-limitiert und können keine
Preisfelder setzen. Abgeschlossene Staff-Sessions dürfen wie im Legacy-Flow auch
unvollständige Auftragsentwürfe speichern; öffentliche Anfragen müssen vollständig
sein. Staff-Preisfelder werden serverseitig auf Typ und Wertebereich geprüft.
Dies schließt A2/A4 nicht ab; Katalog-CRUD und öffentliche Safe-GET-Projektionen
sind inzwischen implementiert. Vollständige autoritative
Orderpreisberechnung, Finanzbeleg-API, Audit-Events und Upload-Sitzungen bleiben
offen.

**Abnahme:** kein öffentlicher Order-Read; Manipulation von Browserpreisen wird abgewiesen/neu berechnet; Kopien und Archive wirken nur auf den jeweiligen Datensatz.

### A5 – Kundenformular und WordPress-Loader

**Abhängigkeit:** A0 und A4 API-Vertrag.  
Nur langes deutsches Umzugsformular portieren; Möbel-/Volumenrechner, Express und eigenständige Möbelliste nicht portieren. Bestehende Nutzerführung weitgehend bewahren. Loader auf Vega stellt alle absoluten Pfade bereit; Formbundle enthält keine fest codierten Domains.

**Abnahme:** WordPress-Seite lädt den Loader; Formular liest nur benötigte freigegebene Daten und speichert Anfrage ohne Login; Privacy Consent und Success/Failure UX bleiben funktionsfähig.

### A6 – Admin-SPA

**Abhängigkeit:** A3 und A4 API-Vertrag.  
Auftragsliste/-suche, Bearbeitung, unabhängige Kopien, Preis-/Katalogpflege für Admin, individuelle Einzelangebotspreise, Archivansicht/Restore, `edited`-Anzeige, Rollen-/Benutzerverwaltung.

**Abnahme:** Rollenrechte greifen auf API-Ebene; Kundenberater können keine globalen Preis-/Katalogdaten ändern; Admin kann alle Bereiche bedienen.

### A7 – Mail, PDFs und Buchhaltung

**Abhängigkeit:** A2/A4.  
Hostinger Mail API Adapter, DB-Outbox/Retry, Anfrage-E-Mails, Angebot/Absage/Rechnung/Mahnung, editierbarer Einzelmailtext, Backend-PDFs und bestehende Layouts. Rechnungen separat, 1:1 zu Angebot, Nummer/DB-ID getrennt, Suche nach Rechnungsnummer/Auftragsnummer/Kundenname. CRUD ohne Versionshistorie.

**Abnahme:** Mailfehler verlieren keine Anfrage; erfolgreiche Sendungen protokollieren Benutzer/Aktion/Zeit; PDF kann jederzeit aus aktuellem Datensatz erzeugt werden; keine PDF-Dateien werden persistent in der App gespeichert.

### A8 – GCS-Bilder

**Abhängigkeit:** A0/A4/A5.  
Clientkomprimierung, private EU-Bucket, Signed URLs, Serververifikation, Bildreferenzen am Auftrag und 180-Tage-Lifecycle. Kein Count-Limit pro Auftrag.

**Abnahme:** keine GCS-Credentials im Browser; Bilddateien werden geprüft; Hard-Delete eines Auftrags löst kein GCS-Delete aus; Lifecycle und Ablauf sind nachweisbar getestet.

### A9 – Integration, Sicherheit und Qualität

**Abhängigkeit:** A3–A8.  
Unit-/Integration-/E2E-Tests für vollständigen Formularflow, Roles, copy/edited/archive, Nummernkreise, Rechnungs-Suche, PDF, Mail-Retry, Upload und Cron. Security Review für Rate-Limits, CORS, IDOR, XSS, Secrets, HTML-Mail-Editor, Uploads und PDF-Inhalte.

**Abnahme:** keine bekannten öffentlichen Datenlesewege; alle sicherheitskritischen Checks serverseitig; Restore-/Purge-/Mailfehlerszenarien abgedeckt.

### A10 – Betrieb und Übergabe

**Abhängigkeit:** A9.  
Hostinger-Deployment, Runtime-Variablen, Prisma-Migrationen, täglicher Cron, Logs, Healthcheck, Erstadmin, manuelle Katalogeinrichtung und Betriebs-Runbook. Betreiber richtet Backups, externes Rechnungsarchiv und finalen Go-live selbst ein.

**Abnahme:** Deployment-/Rollback- und Cron-Anleitung vorhanden; Betreiber kennt die explizit außerhalb der App liegenden Aufgaben.

## 8. Konfigurations- und Betriebsgrenzen

### Hostinger Runtime

Mindestens erforderlich (konkrete Namen dürfen die implementierenden Agents vereinheitlichen):

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `APP_BASE_URL`, `PUBLIC_SITE_ORIGIN`, `CORS_ALLOWED_ORIGINS`
- `HOSTINGER_MAIL_API_TOKEN`, `HOSTINGER_MAILBOX_RESOURCE_ID`
- GCS-Projekt-/Bucket-/Credentials über sichere Serverkonfiguration
- Externe Archiv- und nichtproduktive Providerzugänge ausschließlich als serverseitige Runtime-Umgebungsvariablen; Variablennamen erst mit Auswahl der konkreten Integration festlegen.
- optionaler Secret/Signatur für interne Cron-Aufrufe
- Einmalige Bootstrapwerte nur für ersten Start; nach Anlage entfernen/deaktivieren.

`BETTER_AUTH_SECRET` muss ein eindeutiges, zufälliges Secret mit mindestens 32 Zeichen/hoher Entropie sein. Better Auth erhält ausschließlich die produktive Vega-Origin und explizite lokale/Staging-Origins als Trusted Origins; keine Wildcard und keine Subdomain-Cookies, solange kein Login über mehrere Subdomains erforderlich ist. HTTPS-, `HttpOnly`-, `Secure`- und CSRF-/Origin-Schutz bleiben aktiviert. Auth-Rate-Limits werden persistent konfiguriert und für Login, Passwort-Reset und 2FA separat gesetzt. Proxy-IP-Header werden nur nach Verifikation der Hostinger-Proxykette vertraut.

Nicht geheime Mailwerte (Firmenempfänger, Absendername, Absenderadresse) sind Admin-Einstellungen. Keine API-Tokens oder GCS-Keys dürfen im Admin-/Formularbundle erscheinen.

### Betreiberaufgaben außerhalb der App

- Hostinger-Backup und Restore selbst konfigurieren/testen.
- Startkatalog und Preisvorgaben in der Admin-App manuell einrichten.
- Go-live-Abnahme und finale Umschaltung selbst durchführen.
- Externes Rechnungs-/Gutschriftenarchiv und dessen gesetzliche Aufbewahrung organisieren; benötigte technische Konfiguration/Zugänge bei Integration ausschließlich als serverseitige Runtime-Umgebungsvariablen bereitstellen.
- Erforderliche Google-Maps- und GCS-Projekte/Buckets/Schlüssel freischalten.

## 9. Nicht verhandelbare Risiken / Release-Gates

1. **Rechnungsaufbewahrung:** § 14b UStG verlangt grundsätzlich acht Jahre Aufbewahrung von Rechnungen, Fristbeginn ist grundsätzlich das Ende des Ausstellungsjahres; § 147 AO kann bei steuerlicher Relevanz weitere Aufbewahrung bewirken. Die App löscht archivierte Rechnungen, Gutschriften und Mahnungsdatensätze/-ereignisse nach 30 Tagen und hat weder PDF-Archiv noch Versionierung. Der Betreiber stellt benötigte technische Archivkonfiguration bei Bedarf serverseitig als Runtime-Umgebungsvariablen bereit. Die tatsächliche externe Aufbewahrung muss vor Produktivbetrieb durch Buchhaltung/Steuerberatung bestätigt sein. Ein allgemeiner Confirmation-Dialog oder Runtime-Wert ersetzt keine Aufbewahrung.
2. **Rechnungsänderungen:** Die App überschreibt Rechnungsdaten als einfache CRUD-Operation. Vor Änderung/Archivierung muss der Betreiber benötigte ausgestellte PDF-Stände extern sichern; die App kann frühere PDFs nicht rekonstruieren.
3. **Node-/Paketkompatibilität:** Hostinger unterstützt Node 24.x. TypeScript 7, Prisma, Better Auth und MUI-Versionen sind vor Implementierung gemeinsam in CI zu verifizieren.
4. **Cron:** Die 60-Tage-Order-Bereinigung, 30-Tage-Finanzbeleg-Bereinigung und Mail-Retries benötigen einen verlässlichen Hostinger-Scheduler. A0 muss nachweisen, wie der Managed-Node-Tarif den täglichen Task sicher startet.
5. **WordPress-Loader:** Sicherstellen, dass WordPress nur den Loader enthält und die Formbuild-URLs zur Laufzeit absolut aufgelöst werden; die Domains dürfen nicht in Vite-Builds fest codiert sein.
6. **Better Auth-Konfiguration:** Mitarbeiter-E-Mail-Verifikation ist nicht erforderlich; Admins legen Konten an und können Passwort-Reset-Mails auslösen. Sessions laufen spätestens nach 30 Tagen absolut ab. Adapter-/Plugin-Schema muss zur exakt gepinnten Better-Auth-Version passen. Re-Authentifizierung für sicherheitskritische Kontoänderungen bleibt vor deren Implementierung zu entscheiden.
7. **Finanzbeleg-Purge:** Die einheitliche 30-Tage-Frist für Rechnungen, Gutschriften und Mahnungen ist entschieden; der Betreiber stellt benötigte technische Archivkonfiguration bei Bedarf als Runtime-Umgebungsvariablen bereit. Die tatsächliche externe Aufbewahrung der gesetzlich erforderlichen Belege muss vor Produktivbetrieb dennoch bestätigt sein.

## 10. Verifikation / Referenzen

- Hostinger unterstützt Node.js 18/20/22/24: https://www.hostinger.com/support/how-to-select-the-node-js-version-for-your-application/
- Node.js-Web-Apps auf Business/Cloud-Hosting: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- Hostinger Cron Jobs: https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/
- Hostinger Mail API/OpenAPI: https://api.mail.hostinger.com/ und Repository-Datei `api-1.json` (vor Implementierung Attachment-Vertrag verifizieren).
- UStG § 14b: https://www.gesetze-im-internet.de/ustg_1980/__14b.html
- AO § 147: https://www.gesetze-im-internet.de/ao_1977/__147.html
- Aktuelle WP-Einbettung: öffentliche Seite referenziert CSS/JS unter `/konfigurator/form/`; das Ziel verwendet stattdessen den abgestimmten Loader auf der Vega-Subdomain.
