# ADR 0007: Servermail über Hostinger, Backend-PDFs

- **Status:** Akzeptiert
- **Datum:** 2026-10-05

## Entscheidung

- Hostinger Mail API wird serverseitig für alle Mailflows verwendet.
- Firmenempfänger, Absendername/-adresse sind nicht geheime Admin-Einstellungen. API-Token und Mailbox-ID sind Runtime-Secrets.
- Templates bleiben codebasiert wie aktuell. Kundenberater können den konkreten E-Mail-Text/Betreff bearbeiten.
- Anfrage wird in MySQL gespeichert, bevor E-Mailversand erfolgt. Mailfehler verlieren keine Anfrage und können erneut versucht werden.
- Erfolgreicher In-App-Mailversand protokolliert Aktion, Benutzername und Zeit. Externe Sendungen nach Textkopie sind nicht nachweisbar.
- PDF-Layouts bleiben zunächst wie Bestand. PDF-Erzeugung erfolgt im Backend on-demand; Dateien werden nicht dauerhaft gespeichert.

## Folgen

- Hostinger API-Attachmentspezifikation muss gegen offizielle API/`api-1.json` verifiziert werden.
- Browser erhält keinen Mail-API-Schlüssel.
- Mail Outbox/Retry muss idempotent sein, um Doppelversand zu verhindern.
