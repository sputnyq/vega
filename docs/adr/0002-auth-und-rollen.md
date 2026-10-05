# ADR 0002: Better Auth, verpflichtendes TOTP und zwei Rollen

- **Status:** Akzeptiert
- **Datum:** 2026-10-05

## Entscheidung

Better Auth mit E-Mail/Passwort, Passwort-Reset via Hostinger-Mail und TOTP für Admins und Kundenberater. Keine öffentliche Registrierung. Admins verwalten Konten; ein einmaliger serverseitiger Bootstrap legt den ersten Admin an. Recovery-Codes und ein dokumentierter Admin-Reset-Prozess werden vorgesehen.

Better Auth wird mit der exakt gepinnten Version und deren Prisma-Adapter-/Plugin-Schema betrieben. `twoFactor` Server- und Client-Plugin stellen TOTP bereit; Enrollment benötigt Passwortbestätigung und eine erste erfolgreiche Codeprüfung. Einmalige Recovery-Codes werden geschützt ausgegeben/gespeichert. Geschützte Kundendatenrouten verweigern Zugriff, bis 2FA aktiviert ist.

`BETTER_AUTH_SECRET` ist ein starkes, eindeutiges Runtime-Secret (mindestens 32 Zeichen/hohe Entropie). Trusted Origins bleiben eng, CSRF-/Origin-Checks aktiv und Better-Auth-Rate-Limits persistent. Login-, Passwortreset- und 2FA-Routen erhalten strengere endpoint-spezifische Limits. Da Admin-SPA und Auth-API auf Vega derselben Origin liegen, werden keine Cross-Subdomain-Cookies benötigt. Secure/HttpOnly-Cookies gelten in Produktion.

Rollen sind `Admin` und `Kundenberater`. Berechtigungen werden serverseitig auf Use-Case-/API-Ebene erzwungen.

## Berechtigungskern

- Admin: Benutzer, globale Kataloge/Preise, alle Orders und Angebote, Rechnungen, Gutschriften und Mahnungen.
- Kundenberater: Orders bearbeiten, Einzelangebote kopieren/anpassen/archivieren, individuellen Angebotspreis festlegen, E-Mail/PDF versenden, Order archivieren/wiederherstellen.
- Kundenberater dürfen keine globalen Preis-/Katalogdaten, Benutzer oder Buchhaltungsdatensätze verwalten.

## Folgen

- Kunden sind anonyme Formularnutzer und erhalten keine Sessions/Accounts.
- TOTP-Enrollment/Recovery muss vor Produktivbetrieb getestet werden.
- Rollenänderung oder Account-Sperre wirkt auf API-Zugriff, nicht nur auf sichtbare Menüs.
- Passwortreset versendet generische Antworten, nutzt kurzlebige Einmal-Token und widerruft bestehende Sessions.
- E-Mail-Verifikationsanforderung und Sessiondauer sind A0-Konfigurationsentscheidungen; Empfehlung: verifizierte Mitarbeiteradresse und maximale Sessiondauer von einem Arbeitstag.
