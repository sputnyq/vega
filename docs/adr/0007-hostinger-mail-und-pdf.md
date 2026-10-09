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

## Umsetzungsstand (2026-10-09)

- Der Hostinger-Adapter, die persistente Outbox und die Reset-Mailvorlage sind
  implementiert. Echte Provider-Calls bleiben bis zu nichtproduktiven
  Zugangsdaten ein Proof-Gate.
- Rechnungs-PDFs werden serverseitig aus `Invoice` im übernommenen Legacy-Layout
  erzeugt und als Download ausgeliefert. Der PDF-Renderer ist serverseitig;
  die verwundbare Legacy-Browserbibliothek `jspdf` wird nicht übernommen.
- Angebots-, Gutschrift- und Mahn-PDFs sowie editierbare Versanddialoge bleiben
  offen.

## Folgen

- Hostinger API-Attachmentspezifikation muss gegen offizielle API/`api-1.json` verifiziert werden.
- Browser erhält keinen Mail-API-Schlüssel.
- Mail Outbox/Retry muss idempotent sein, um Doppelversand zu verhindern.
