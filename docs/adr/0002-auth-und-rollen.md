# ADR 0002: Better Auth, verpflichtendes TOTP und zwei Rollen

- **Status:** Akzeptiert
- **Datum:** 2026-10-06
- **Fachentscheidung:** Auftraggeber, Name nicht angegeben

## Entscheidung

Better Auth mit E-Mail/Passwort, Passwort-Reset via Hostinger-Mail und TOTP für Admins und Kundenberater. Mitarbeiter-E-Mail-Adressen müssen nicht verifiziert werden. Es gibt keine öffentliche Registrierung. Ein einmaliger serverseitiger Bootstrap legt den ersten Admin an; danach können Admins Konten anlegen und ihnen auch die Rolle `Admin` zuweisen. Admins können für ein Konto eine Passwort-Reset-Mail auslösen; das neue Passwort setzt der Kontoinhaber über den kurzlebigen Reset-Link selbst. Recovery-Codes und ein dokumentierter Admin-Reset-Prozess werden vorgesehen.

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
- Eine Anmeldung ist spätestens alle 30 Tage erforderlich. Die absolute Sessiondauer beträgt höchstens 30 Tage und wird durch laufende Aktivität nicht verlängert.
- Re-Authentifizierung bei sicherheitskritischen Kontoänderungen ist noch nicht entschieden und bleibt vor deren Implementierung zu klären.
