# ADR 0005: Rechnungen separat, PDF on-demand, externe Aufbewahrung

- **Status:** App-Verhalten akzeptiert; Compliance-Risiko offen
- **Datum:** 2026-10-06
- **Fachentscheidung:** Auftraggeber, Name nicht angegeben

## Entscheidung

- Rechnung in eigener Tabelle, Admin-only, genau eine pro Angebot/Orderkopie.
- Suchbar über Rechnungsnummer, Auftragsnummer und Kundenname. Beziehung zur Order darf bei Order-Purge nicht kaskadieren; Ordernummer/Kundenname werden als Such-Snapshot behalten.
- Rechnungsnummer separat von DB-ID, eindeutig, im Adminbereich initialisierbar und später bearbeitbar.
- Rechnung ist einfache CRUD; keine Versionshistorie. Änderungen überschreiben den aktuellen DB-Stand.
- PDF wird bei Bedarf aus dem aktuellen DB-Stand im Backend erzeugt und vom Admin lokal gespeichert. App speichert keine PDF-Dateien.
- Admins können Rechnungen, Gutschriften und Mahnungsdatensätze/-ereignisse explizit archivieren und bis zur endgültigen Löschung wiederherstellen. Für alle drei Finanzdatentypen gilt dieselbe Frist: 30 Tage nach Archivierung werden sie aus der App-Datenbank gelöscht; erneutes Archivieren startet die Frist neu.
- Externe Archivierung ausgestellter Rechnungen/Gutschriften organisiert der Betreiber. Benötigte technische Konfiguration/Zugänge werden bei Bedarf ausschließlich serverseitig als Runtime-Umgebungsvariablen bereitgestellt. Die App zeigt nur eine allgemeine Bestätigung und prüft nicht, ob ein externes Archiv tatsächlich existiert.
- Gutschrift: separat, optional und höchstens eine je Rechnung; Nummerierungsverhalten wie Bestand. Mahnungen als Ereignisse an der Rechnung.

## Kritischer Vorbehalt

§ 14b UStG verlangt grundsätzlich eine achtjährige Aufbewahrung von Rechnungen; § 147 AO kann die Aufbewahrung bei steuerlicher Relevanz beeinflussen. Die App-Regel „30 Tage bis zur Löschung“ erfüllt diese externe Aufbewahrungspflicht nicht. Vor Produktivbetrieb muss ein geeignetes externes Archiv die erforderlichen Belege tatsächlich aufbewahren; die konkrete Ablage/Prozedur muss Steuerberatung bestätigen. Der Confirmation-Dialog allein erfüllt dies nicht.

Ein bearbeiteter DB-Datensatz kann den früher ausgestellten PDF-Stand nicht rekonstruieren. Benötigte Rechnungsstände müssen vor Änderungen/Archivierung extern gesichert werden.

## Umsetzungsstand (2026-10-09)

- Admin-only Rechnungs-CRUD, Blanco-Rechnungen, optionale eindeutige
  Auftragsbezüge, Such-Snapshots, Archivierung/Wiederherstellung und
  serverseitiger PDF-Download sind umgesetzt.
- `CreditNote` und `ReminderEvent` sind als A2-Datenmodell mit eigenen
  Archiv-/Purge-Feldern und Such-Snapshots vorhanden. `SET NULL` beim
  Rechnungs-Purge schützt ihre unabhängige Aufbewahrung. Gutschriftennummern
  sind eindeutig, ohne eine neue Nummerierungsregel oder Dummy-Startwerte
  vorzugeben.
- Die 30-Tage-Finanzbereinigung, Gutschriften-/Mahnungs-Fachfunktionen und externe
  Archivintegration bleiben offen. Dieser ADR-Vorbehalt ist daher unverändert
  ein Produktiv-Release-Gate.

## Referenzen

- https://www.gesetze-im-internet.de/ustg_1980/__14b.html
- https://www.gesetze-im-internet.de/ao_1977/__147.html
