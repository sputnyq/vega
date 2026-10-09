# ADR 0004: Frische relationale Datenbank, unabhängige Orderkopien

- **Status:** Akzeptiert
- **Datum:** 2026-10-05

## Entscheidung

Eine frische MySQL-Datenbank mit Prisma. Es findet keine Migration von Kunden-/Auftrags-/Altdaten statt. Es gibt kein globales Kundenprofil; Kundendaten verbleiben pro Order.

Angebotskopien bleiben eigenständige Orders mit neuer Auftragsnummer und Bezug zum Ursprung. Auftragsnummern beginnen bei 1000. Kopien können unabhängig bearbeitet, archiviert und wiederhergestellt werden.

`edited` ist ein Bearbeitungsflag, keine Lesebestätigung: Eingang false, Kopie true, tatsächliche Änderung/erfolgreiche In-App-Mail true; Lesen allein ändert es nicht. Aktion, Benutzername und Zeitstempel werden protokolliert, aber keine Feld-Diffs. Events werden mit dem Order entfernt.

Archivieren erfolgt explizit. Restore stoppt die 60-Tage-Frist; erneutes Archivieren startet sie neu. Täglicher Hostinger-Cron entfernt nur den jeweiligen abgelaufenen Datensatz.

## Folgen

- Keine automatischen Kaskaden zwischen Geschwisterkopien.
- Rechnungen dürfen nicht per FK-Cascade mit Orders gelöscht werden.
- Startkatalog/Preise werden nach Setup manuell durch Admins angelegt.
- Das Frontend erhält keinen Zugriff auf beliebige Order-IDs/öffentliche Order-Reads.

## Umsetzungsstand (2026-10-09)

- Öffentlicher Order-POST, Staff-Bearbeitung, Angebotskopien,
  Archivieren/Wiederherstellen und minimaler Aktionsjournal-Read sind umgesetzt.
- Das Journal hält Anlage, Anpassung, Kopie, Archivierung, Wiederherstellung und
  Rechnungs-PDF-Export fest. Öffentliche Anfragen verwenden als Akteur `-`;
  Feld-Diffs werden nicht gespeichert.
- Der tägliche 60-Tage-Purge bleibt bis zum gesicherten Hostinger-Cron offen.
- Adress- und Positionskerne liegen in `OrderAddress`/`OrderPosition`;
  Anlage, Änderung, Kopie und Read verwenden diese Beziehungen transaktional.
  Bestehende Vega-Snapshots werden additiv übernommen; keine Legacy-Daten.
- Datenbanktests prüfen die Unabhängigkeit der Kopien und erhaltene Rechnungen.
  Auftragseigene Mail-Outbox-Inhalte und Mailereignisse werden ebenso wie das
  Aktionsjournal mit dem Auftrag gelöscht, nicht als personenbezogene Waisen
  weiter aufbewahrt.
