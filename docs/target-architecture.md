# Zielarchitektur

## Kontext und Grenzen

```text
Kunde
  └─ umzugruckzuck24.de (WordPress / Content)
       └─ Loader von Vega-Node-App
            ├─ langes Formular (React/Vite-Bundle)
            ├─ öffentliche API: Safe Catalog GET + Order POST
            └─ kurzlebige GCS Upload-Links

Kundenberater/Admin
  └─ vega.umzugruckzuck24.de
       ├─ React/Vite Admin-SPA am Origin-Root (`/`); Redirect zu `/login` bzw. `/two-factor`, unbekannte Pfade zeigen 404
       ├─ Better Auth + TOTP
       ├─ Express 5 API / Domain Services
       ├─ Prisma → Hostinger MySQL
       ├─ Hostinger Mail API
       └─ Google Cloud Storage (private EU bucket)
```

Die Vega-Admin-Navigation behält die Legacy-Routen für Aufträge, Bearbeitung,
Rechnungserstellung, E-Mail-Text und Einstellungen. Einstellungen sind in
Optionen (`/settings`), Content Management (`/settings/content/*`) und
User Management (`/settings/users`) gegliedert. Legacy-Content-Pfade bleiben
als Aliase verfügbar; archivierte Orders/Rechnungen und Profil haben eigene
Routen.

WordPress bleibt CMS und Einbettungsfläche. Es ist nicht länger Order-Backend, Auth-System oder Mailer. Alte WordPress-REST-Daten und Altdaten werden nicht migriert. Das Formular-Bundle wird aus derselben Codebasis wie die Node-App gebaut; der kleine Loader auf Vega liefert absolute URLs. Die konkreten Runtime-Pfade kommen aus Konfiguration und werden nicht in Vite-Builds eingebrannt.

## Laufzeitmodule

### Express-Server

- Statische Admin- und Kundenformular-Builds ausliefern.
- Admin-SPA am Origin-Root: Legacy-Pfade `/`, `/edit/:id`, `/blanco`, `/settings/*` und `/email-text/:id`; zusätzlich `/invoices`, `/invoices/archived`, `/orders/archived`, `/profile`. Unbekannte Admin-Pfade zeigen 404.
- Better Auth-Routen und Session-Cookies auf Vega hosten.
- Öffentliche und geschützte API-Router getrennt registrieren.
- Request-ID, strukturierte Logs, Rate-Limits, CSP und Security-Headers zentral konfigurieren.
- Tägliche interne Maintenance-Ausführung über Hostinger Cron; kein ungeschützter öffentlicher Purge-Endpunkt.

### Domain Services

- Order/Copy/Archive Service: implementiert Nummernvergabe, Kopien,
  Bearbeitungsflag, Archivieren/Wiederherstellen und minimales Journal;
  der 60-Tage-Purge bleibt Cron-Arbeit.
- Catalog/Pricing Service: Server ist Preisquelle; Einzelangebotsabweichungen werden im jeweiligen Order-Datensatz gespeichert.
- Invoice/Credit Service: implementiert Admin-only Rechnungs-CRUD mit optionalem
  Auftragsbezug, Such-Snapshots und Rechnungs-PDF-on-demand; Gutschriften und
  Mahnungen bleiben offen.
- Mail Service: Hostinger API Adapter, Outbox, Retry/Failure Handling,
  Actor/Event Logs; Angebots-/Rechnungs-Versanddialoge bleiben offen.
- Upload Service: GCS URL-Signierung, Upload-Verifikation und Zuordnung von Bildreferenzen.
- Settings Service: versionierter Singleton für die sechs aktiven
  Legacy-Optionen (`boxCbm`, `kleiderboxCbm`, `origin`, `dataPrivacyUrl`,
  `successUrl`, `boxCalculatorUrl`) und freigegebene Mailwerte
  (`companyEmail`, `emailFromName`, `emailFromAddress`). Änderung nur durch
  Admins, Konfliktschutz über Revision; leere Werte bleiben unkonfiguriert.
- PDF Service: Rechnungen werden serverseitig aus aktuellen DB-Daten im
  übernommenen Legacy-Layout erzeugt; Angebots-, Gutschrift- und Mahn-PDFs
  bleiben offen.

## Rollen-/Berechtigungsmatrix

| Bereich/Aktion | Admin | Kundenberater | Öffentlich |
|---|---:|---:|---:|
| Eigene Authentifizierung/2FA | ja | ja | nein |
| Kundenanfragen lesen/bearbeiten | ja | ja | nein |
| Angebotskopie erstellen/kopieren/anpassen/archivieren | ja | ja | nein |
| Preis einer einzelnen Angebotskopie anpassen | ja | ja | nein |
| Globale Preise, Services, Möbel, Kategorien ändern | ja | nein | nein |
| Mitarbeiter/Accounts verwalten | ja | nein | nein |
| Rechnungen, Gutschriften, Mahnungen | ja | nein | nein |
| Öffentliche Katalogprojektion lesen | ja | ja | ja, nur Safe DTO |
| Neue Anfrage absenden | ja | ja | ja, Rate-Limited |
| Aufträge/Kunden öffentlich lesen | nein | nein | nein |

Alle Rechte werden im Backend geprüft. `Admin` hat alle Rechte; `Kundenberater` erhält keine versteckten Admin-APIs.

### Better Auth Sicherheitskonfiguration

- Prisma-Adapter mit dem Schema, das für die gepinnte Better-Auth-Version generiert wurde. Bei Änderung von Adapter/Plugins CLI-Schema erneut generieren und Migration prüfen.
- Better-Auth-Konfiguration benennt Prisma-Modelle gemäß ORM-Modellnamen (nicht SQL-Tabellennamen); generiertes Plugin-Schema wird nicht von Hand an der CLI vorbei geändert.
- E-Mail/Passwort aktiv; neu gesetzte Passwörter erfordern mindestens 8 Zeichen sowie Großbuchstabe, Kleinbuchstabe und Zahl. `sendResetPassword` nutzt den serverseitigen Hostinger-Maildienst. Reset-Antworten geben nicht preis, ob ein Account existiert; Reset-Token sind kurzlebig/einmalig und Passwortreset widerruft bestehende Sessions.
- `twoFactor` Server- und Client-Plugin für TOTP. Enrollment benötigt Passwortbestätigung und einen erfolgreichen ersten Code; nur dann gilt 2FA als aktiviert. Einmalige Recovery-Codes verschlüsselt speichern/anzeigen; 2FA-Reset erzwingt erneutes Enrollment.
- Serverseitige Middleware blockiert geschützte Kundendatenrouten, bis 2FA aktiviert ist. Kein „trusted device“-Bypass zum Start.
- `BETTER_AUTH_SECRET` ist ein zufälliges, einzigartiges Secret (mindestens 32 Zeichen/hohe Entropie) aus Hostinger Runtime-Variablen.
- Trusted Origins werden exakt aus Runtime-Konfiguration abgeleitet. Der Public-Form-Origin ist CORS-Origin, aber nicht automatisch Auth-Origin. Kein Wildcard-Origin, keine deaktivierte CSRF-/Origin-Prüfung und keine Cross-Subdomain-Cookies, da Login und Admin auf derselben Vega-Origin liegen.
- HTTPS, `Secure`, `HttpOnly` und `SameSite=Lax` Cookies. Proxy-IP-Header nur dann vertrauen, wenn der Hostinger-Reverse-Proxy verifiziert ist.
- Better-Auth-Rate-Limits bleiben aktiviert; Login, Reset und 2FA bekommen strengere endpoint-spezifische Limits mit persistenter Speicherung statt nur In-Memory-Countern. Proxy-IP-Header werden nur nach Verifikation der Hostinger-Proxykette vertraut.
- Mitarbeiter-E-Mail-Adressen müssen nicht verifiziert werden. Admins legen Konten an, können auch die Rolle `Admin` vergeben und Passwort-Reset-Mails auslösen. Sessions haben eine absolute Höchstdauer von 30 Tagen; spätestens dann ist eine erneute Anmeldung erforderlich. Anlage, Sperrung/Entsperrung, Rollenwechsel, Passwort-Reset-Mail und 2FA-Reset erfordern jeweils serverseitig das aktuelle Admin-Passwort (ADR 0002).
- Kontoaktionen laufen ausschließlich über Admin-only Vega-Endpunkte. Sperrung, Rollenwechsel und 2FA-Reset widerrufen Sitzungen/Challenges; Sperrung verhindert neue Sitzungen. Selbst-Lockout und Verlust des letzten aktiven Admins sind geschützt. Der einzige Admin erhält einen ausdrücklich bestätigten serverseitigen TOTP-Recovery-Pfad, keinen erneuten Bootstrap. Identität und Sicherung sind vorher außerhalb der App zu prüfen.
- Der Initial-Admin `root_user` wird einmalig per Prisma-Seed aus `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` provisioniert; keine Bootstrap-Secrets im Client oder in Logs. Erstzugriff bleibt bis Passwortwechsel und TOTP-Verifizierung gesperrt.

## Datenmodell – fachliche Beziehungen

- `Order` speichert Kunden-/Adressdaten direkt, kein `Customer`-Stamm.
- `Order.orderNumber` ist eindeutige Geschäftsnummer; DB-PK separat.
- `OrderAddress` hält Straße/PLZ/Ort pro eindeutiger Adressrolle relational,
  optionale validierte Adressdetails bleiben JSON. `OrderPosition` hält
  Möbel-, Service- und Verpackungspositionen mit Reihenfolge, Menge und
  Volumensnapshot. Katalog-IDs sind historische Referenzwerte, keine
  Löschkaskaden auf Auftragspositionen. Bei Anlage, Änderung und Kopie werden
  Beziehungen transaktional geschrieben; API-Reads und Rechnungsadressen
  verwenden die relationalen Werte. Der validierte Formularsnapshot bleibt
  für die übrigen Details erhalten.
- Der Intake-Endpunkt `POST /api/orders` ist öffentlich und für abgeschlossene
  Staff-Sessions verwendbar. Er speichert validierte Kunden-, Mehrfachadress-,
  Umzugsgut-, Zusatzleistungs-, Termin- und Konditionsdaten, vergibt die Nummer
  serverseitig ab 1000 und liefert ausschließlich die neue Auftragsnummer zurück.
  Preisfelder sind bei anonymen Requests verboten; Staff-Preisangaben werden
  serverseitig typ- und wertebereichsgeprüft. Öffentliche Order-Reads bleiben
  verboten; anonyme Requests werden serverseitig limitiert.
- Öffentliche Katalogprojektionen sind getrennte, rate-limitierte GETs unter
  `/api/catalog/categories`, `/api/catalog/furniture`, `/api/catalog/offers`,
  `/api/catalog/packings`, `/api/catalog/services` und
  `/api/catalog/service-rates`. Packungen und Leistungen werden öffentlich nur
  ausgeliefert, wenn `show=true` ist. Die Admin-CRUD-Routen liegen getrennt unter
  `/api/admin/catalog/*`, verlangen eine abgeschlossene Admin-Session und geben
  nur explizit freigegebene DTO-Felder aus.
- Angebotskopie ist ein neuer Order-Datensatz mit neuer Nummer und nullable Ursprung-Relation. Die Kopie ist eigenständig; FK-Regeln dürfen keine anderen Orders löschen.
- `Order.edited` beschreibt die bestehende Bearbeitungsmarkierung, nicht „gesehen“: Kundeingang false, Kopie true, tatsächliche Änderung/erfolgreiche In-App-Mail true; Öffnen allein unverändert.
- `Order.archivedAt`/`purgeAt` bestimmen 60-Tage-Frist; Restore setzt Archivzustand zurück, Re-Archive startet Frist neu.
- `OrderImage` speichert Objekt-Key/Link-Metadaten. Order-Purge löscht nicht das GCS-Objekt.
- `Invoice` ist eigene Tabelle mit optionaler, für gesetzte Bezüge eindeutiger
  Beziehung zu einem Angebots-Order. Blanco-Rechnungen haben keinen Orderbezug.
  Sie enthält `orderNumberSnapshot`, `customerNameSnapshot`, Rechnungsnummer,
  Rechnungsadresse, Positionen, Fälligkeiten und fachliche Rechnungsfelder.
  Beim Order-Purge gilt `SET NULL` statt Cascade; Snapshots bleiben zum Suchen
  bis Invoice-Purge.
- Rechnungsnummer ist von DB-ID und Auftragsnummer getrennt; einstellbarer Nummernkreis, editierbar, DB-seitig eindeutig.
- `CreditNote` ist separater optionaler Beleg (höchstens einer je Rechnung;
  eindeutige frei gesetzte Geschäftsnummer wie im Bestand, kein erfundener
  initialer Gutschriftennummernwert). `ReminderEvent` hält Mahnungsdaten und
  einen erst bei erfolgreichem Versand zu setzenden `sentAt` fest. Beide
  Tabellen enthalten Rechnungsnummer-/Kunden-/Auftragsnummer-Snapshots;
  Rechnungs-Purge setzt ihre FK-Bezüge auf NULL, ohne sie vor ihrer eigenen
  Aufbewahrungsfrist zu löschen. Use-Cases und UI folgen unter A7.
- `Invoice`, `CreditNote` und `ReminderEvent` haben jeweils eigene Archiv-/Purge-Felder. Admins archivieren die Finanzdatensätze; Purge erfolgt einheitlich nach 30 Tagen, Restore ist bis dahin möglich.
- `OrderActivityEvent` enthält nur Objekt, Aktion, Zeitstempel und Benutzername;
  keine Feld-Diffs. Öffentliche Anfragen verwenden als Akteur `-`. Derzeitige
  Aktionen umfassen Anlage, Bearbeitung, Kopie, Archivierung, Wiederherstellung
  und Rechnungs-PDF-Export. Order-Purge entfernt seine Events.
- `EmailOutbox`/`EmailEvent` hält Retry-Zustand und erfolgreichen Versand inkl. Benutzer/Aktion/Zeitpunkt.
- Auftragseigene Outbox-Inhalte und Mailereignisse werden beim Order-Purge
  ebenfalls gelöscht. Nicht auftragsgebundene Auth-Mails sind davon unabhängig.
- Katalog-/Preisstammdaten werden initial manuell gepflegt.

## API-Sicherheitsgrenze

- `public` Router enthalten ausschließlich Endpunkte, die der Gastflow tatsächlich braucht.
- Der lange Formularflow erhält validierte Katalog-/Serviceprojektionen und kann eine Anfrage erstellen; er erhält niemals Order-Read-Zugriff.
- `admin` Router verlangen gültige Better-Auth-Session plus Rollen-/Capability-Check.
- Admin-only Finanzrouten liegen unter `/api/admin/invoices`; Kundenberater und
  öffentliche Clients erhalten keinen Finanzbeleg-Zugriff.
- CORS Origins kommen aus Runtime-Umgebung. Origin-Prüfung begrenzt Browserzugriff, ersetzt aber keine Auth.
- Better Auth Trusted Origins sind eine separate, engere Liste als CORS und umfassen nur Vega plus ausdrücklich eingerichtete lokale/Staging-Origin.
- Rate-Limits für öffentliche GET/POST/Upload-Anbahnung; Werte werden anhand Hostinger Proxy/IP-Verhalten im A0-Proof gesetzt.
- Server-Schema validiert jedes Eingabefeld, IDs, Zahlen/Preise, Arrays, Upload-Claims und Payload-Größen.
- Keine Provider-API-Schlüssel, Mail-Tokens, GCS-Credentials oder Preise als allein browserseitige Wahrheit.

## Loader-/WordPress-Integration

- Die WordPress-Seite behält einen Script-Mountpoint/Loader; kein iframe.
- Der Loader auf Vega stellt absolute CSS-/JS-/API-Pfade zur Verfügung.
- Der Formular-Build wird aus `apps/customer-form` erzeugt und vom Node-App-Deployment ausgeliefert.
- Der eingebettete Möbel-/Volumenrechner ist seit der ausdrücklichen Freigabe
  vom 2026-10-09 Teil des langen Formulars, kein eigenständiger neuer Flow.
- Formularoptionen stammen aus einer expliziten Safe-Projektion, nicht aus
  einem generischen öffentlichen Optionsendpunkt. Möbelvolumen wird beim
  Kundeneingang aus Katalog und gespeicherten Kartonvolumina serverseitig
  normalisiert. Fehlende Kartonvolumina werden als unvollständiges Volumen
  gekennzeichnet, nicht als vollständig berechnete Nullwerte dargestellt.
- Loader-Basis und Hostnamen werden zur Laufzeit aufgelöst. Kein Hostname in Vite-Variablen, die in Clientassets gebündelt werden.
- CORS erlaubt nur die konfigurierte produktive WordPress-Origin und explizite nichtproduktive Test-Origin.
- Das WordPress-Plugin soll keine alten öffentlichen Order-/Options-REST-Routen in der neuen Integration weiterverwenden.

## Privacy/Retention und unbeaufsichtigte Tasks

| Objekt | Verhalten |
|---|---|
| Neue Anfrage | `edited=false`; bleibt aktiv, bis explizit archiviert |
| Angebotskopie | eigenständiger Datensatz, eigene Nummer, `edited=true` |
| Archivierter Auftrag/Kopie | Restore-fähig; Purge nach 60 Tagen ab aktueller Archivierung |
| Audit eines Auftrags | minimaler Aktionsdatensatz; zusammen mit Order-Purge entfernt |
| GCS-Objekt | keine Order-Purge-Kaskade; Lifecycle nach 180 Tagen ab Upload |
| Rechnung, Gutschrift, Mahnungsereignis | Admin-Archivierung und Restore; einheitlicher App-Purge 30 Tage nach Archivierung. Externe gesetzliche Archivierung bleibt Betreiberprozess und Go-live-Gate. |
| Invoice PDF | bei Bedarf aus aktuellem DB-Stand; nicht persistent in App/GCS |

Hostinger Cron läuft täglich, verarbeitet abgelaufene archivierte Datensätze und Mail-Retries. Purge ist transaktional/idempotent. Vor finaler Implementierung ist zu prüfen, ob Managed Node Cron eine CLI-Ausführung erlaubt; sonst wird ein kurzlebiger, signierter interner Trigger verwendet.
