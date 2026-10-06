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
       ├─ React/Vite Admin-SPA
       ├─ Better Auth + TOTP
       ├─ Express 5 API / Domain Services
       ├─ Prisma → Hostinger MySQL
       ├─ Hostinger Mail API
       └─ Google Cloud Storage (private EU bucket)
```

WordPress bleibt CMS und Einbettungsfläche. Es ist nicht länger Order-Backend, Auth-System oder Mailer. Alte WordPress-REST-Daten und Altdaten werden nicht migriert. Das Formular-Bundle wird aus derselben Codebasis wie die Node-App gebaut; der kleine Loader auf Vega liefert absolute URLs. Die konkreten Runtime-Pfade kommen aus Konfiguration und werden nicht in Vite-Builds eingebrannt.

## Laufzeitmodule

### Express-Server

- Statische Admin- und Kundenformular-Builds ausliefern.
- Better Auth-Routen und Session-Cookies auf Vega hosten.
- Öffentliche und geschützte API-Router getrennt registrieren.
- Request-ID, strukturierte Logs, Rate-Limits, CSP und Security-Headers zentral konfigurieren.
- Tägliche interne Maintenance-Ausführung über Hostinger Cron; kein ungeschützter öffentlicher Purge-Endpunkt.

### Domain Services

- Order/Copy/Archive Service: Transaktionen für Nummernvergabe, Kopien, Bearbeitungsflag und Archivfristen.
- Catalog/Pricing Service: Server ist Preisquelle; Einzelangebotsabweichungen werden im jeweiligen Order-Datensatz gespeichert.
- Invoice/Credit Service: getrennte Finanzdatensätze, Such-Snapshots, einfache CRUD-Regeln, PDF-on-demand.
- Mail Service: Hostinger API Adapter, Outbox, Retry/Failure Handling, Actor/Event Logs.
- Upload Service: GCS URL-Signierung, Upload-Verifikation und Zuordnung von Bildreferenzen.
- PDF Service: serverseitige Erzeugung aus aktuellen DB-Daten, Vorlagen/Layout zunächst wie Bestand.

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
- E-Mail/Passwort aktiv; `sendResetPassword` nutzt den serverseitigen Hostinger-Maildienst. Reset-Antworten geben nicht preis, ob ein Account existiert; Reset-Token sind kurzlebig/einmalig und Passwortreset widerruft bestehende Sessions.
- `twoFactor` Server- und Client-Plugin für TOTP. Enrollment benötigt Passwortbestätigung und einen erfolgreichen ersten Code; nur dann gilt 2FA als aktiviert. Einmalige Recovery-Codes verschlüsselt speichern/anzeigen; 2FA-Reset erzwingt erneutes Enrollment.
- Serverseitige Middleware blockiert geschützte Kundendatenrouten, bis 2FA aktiviert ist. Kein „trusted device“-Bypass zum Start.
- `BETTER_AUTH_SECRET` ist ein zufälliges, einzigartiges Secret (mindestens 32 Zeichen/hohe Entropie) aus Hostinger Runtime-Variablen.
- Trusted Origins werden exakt aus Runtime-Konfiguration abgeleitet. Der Public-Form-Origin ist CORS-Origin, aber nicht automatisch Auth-Origin. Kein Wildcard-Origin, keine deaktivierte CSRF-/Origin-Prüfung und keine Cross-Subdomain-Cookies, da Login und Admin auf derselben Vega-Origin liegen.
- HTTPS, `Secure`, `HttpOnly` und `SameSite=Lax` Cookies. Proxy-IP-Header nur dann vertrauen, wenn der Hostinger-Reverse-Proxy verifiziert ist.
- Better-Auth-Rate-Limits bleiben aktiviert; Login, Reset und 2FA bekommen strengere endpoint-spezifische Limits mit persistenter Speicherung statt nur In-Memory-Countern. Proxy-IP-Header werden nur nach Verifikation der Hostinger-Proxykette vertraut.
- Mitarbeiter-E-Mail-Adressen müssen nicht verifiziert werden. Admins legen Konten an, können auch die Rolle `Admin` vergeben und Passwort-Reset-Mails auslösen. Sessions haben eine absolute Höchstdauer von 30 Tagen; spätestens dann ist eine erneute Anmeldung erforderlich. Re-Authentifizierung bei sicherheitskritischen Kontoänderungen bleibt noch zu entscheiden.

## Datenmodell – fachliche Beziehungen

- `Order` speichert Kunden-/Adressdaten direkt, kein `Customer`-Stamm.
- `Order.orderNumber` ist eindeutige Geschäftsnummer; DB-PK separat.
- Angebotskopie ist ein neuer Order-Datensatz mit neuer Nummer und nullable Ursprung-Relation. Die Kopie ist eigenständig; FK-Regeln dürfen keine anderen Orders löschen.
- `Order.edited` beschreibt die bestehende Bearbeitungsmarkierung, nicht „gesehen“: Kundeingang false, Kopie true, tatsächliche Änderung/erfolgreiche In-App-Mail true; Öffnen allein unverändert.
- `Order.archivedAt`/`purgeAt` bestimmen 60-Tage-Frist; Restore setzt Archivzustand zurück, Re-Archive startet Frist neu.
- `OrderImage` speichert Objekt-Key/Link-Metadaten. Order-Purge löscht nicht das GCS-Objekt.
- `Invoice` ist eigene Tabelle, unique nullable Beziehung zu genau einem Angebots-Order, plus `orderNumberSnapshot`, `customerNameSnapshot`, Rechnungsnummer und fachliche Rechnungsfelder. Beim Order-Purge `SET NULL` statt Cascade; Snapshots bleiben zum Suchen bis Invoice-Purge.
- Rechnungsnummer ist von DB-ID und Auftragsnummer getrennt; einstellbarer Nummernkreis, editierbar, DB-seitig eindeutig.
- `CreditNote` ist separater optionaler Beleg (höchstens einer je Rechnung; Nummerierungsverhalten wie bisher); `ReminderEvent` hält Versandereignisse zur Rechnung fest.
- `Invoice`, `CreditNote` und `ReminderEvent` haben jeweils eigene Archiv-/Purge-Felder. Admins archivieren die Finanzdatensätze; Purge erfolgt einheitlich nach 30 Tagen, Restore ist bis dahin möglich.
- `OrderActivityEvent` enthält nur Objekt, Aktion, Zeitstempel und Benutzername; keine Feld-Diffs. Order-Purge entfernt seine Events.
- `EmailOutbox`/`EmailEvent` hält Retry-Zustand und erfolgreichen Versand inkl. Benutzer/Aktion/Zeitpunkt.
- Katalog-/Preisstammdaten werden initial manuell gepflegt.

## API-Sicherheitsgrenze

- `public` Router enthalten ausschließlich Endpunkte, die der Gastflow tatsächlich braucht.
- Der lange Formularflow erhält validierte Katalog-/Serviceprojektionen und kann eine Anfrage erstellen; er erhält niemals Order-Read-Zugriff.
- `admin` Router verlangen gültige Better-Auth-Session plus Rollen-/Capability-Check.
- CORS Origins kommen aus Runtime-Umgebung. Origin-Prüfung begrenzt Browserzugriff, ersetzt aber keine Auth.
- Better Auth Trusted Origins sind eine separate, engere Liste als CORS und umfassen nur Vega plus ausdrücklich eingerichtete lokale/Staging-Origin.
- Rate-Limits für öffentliche GET/POST/Upload-Anbahnung; Werte werden anhand Hostinger Proxy/IP-Verhalten im A0-Proof gesetzt.
- Server-Schema validiert jedes Eingabefeld, IDs, Zahlen/Preise, Arrays, Upload-Claims und Payload-Größen.
- Keine Provider-API-Schlüssel, Mail-Tokens, GCS-Credentials oder Preise als allein browserseitige Wahrheit.

## Loader-/WordPress-Integration

- Die WordPress-Seite behält einen Script-Mountpoint/Loader; kein iframe.
- Der Loader auf Vega stellt absolute CSS-/JS-/API-Pfade zur Verfügung.
- Der Formular-Build wird aus `apps/customer-form` erzeugt und vom Node-App-Deployment ausgeliefert.
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
