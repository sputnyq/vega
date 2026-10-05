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
