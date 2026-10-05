# ADR 0005: Rechnungen separat, PDF on-demand, externe Aufbewahrung

- **Status:** App-Verhalten akzeptiert; Compliance-Risiko offen
- **Datum:** 2026-10-05

## Entscheidung

- Rechnung in eigener Tabelle, Admin-only, genau eine pro Angebot/Orderkopie.
- Suchbar über Rechnungsnummer, Auftragsnummer und Kundenname. Beziehung zur Order darf bei Order-Purge nicht kaskadieren; Ordernummer/Kundenname werden als Such-Snapshot behalten.
- Rechnungsnummer separat von DB-ID, eindeutig, im Adminbereich initialisierbar und später bearbeitbar.
- Rechnung ist einfache CRUD; keine Versionshistorie. Änderungen überschreiben den aktuellen DB-Stand.
- PDF wird bei Bedarf aus dem aktuellen DB-Stand im Backend erzeugt und vom Admin lokal gespeichert. App speichert keine PDF-Dateien.
- Rechnung erhält eigene Archivansicht/Restore und wird 60 Tage nach bestätigtem Archivieren aus der App-DB entfernt.
- Externe Archivierung ausgestellter Rechnungen/Gutschriften organisiert der Betreiber. Die App zeigt nur eine allgemeine Bestätigung und prüft nicht, ob ein externes Archiv tatsächlich existiert.
- Gutschrift: separat, optional und höchstens eine je Rechnung; Nummerierungsverhalten wie Bestand. Mahnungen als Ereignisse an der Rechnung.
- Archiv-/Purge-Frist für Gutschriften und verknüpfte Mahnungsereignisse ist nicht automatisch dieselbe 60-Tage-Regel; mit Buchhaltung festlegen, bevor diese Datensätze löschbar werden.

## Kritischer Vorbehalt

§ 14b UStG verlangt grundsätzlich eine achtjährige Aufbewahrung von Rechnungen; § 147 AO kann die Aufbewahrung bei steuerlicher Relevanz beeinflussen. Die App-Regel „60 Tage bis zur Löschung“ ist nur dann mit der externen Pflicht vereinbar, wenn ein geeignetes externes Archiv die erforderlichen Belege tatsächlich aufbewahrt. Der Confirmation-Dialog allein erfüllt dies nicht. Die konkrete Ablage/Prozedur muss Steuerberatung bestätigen.

Ein bearbeiteter DB-Datensatz kann den früher ausgestellten PDF-Stand nicht rekonstruieren. Benötigte Rechnungsstände müssen vor Änderungen/Archivierung extern gesichert werden.

## Referenzen

- https://www.gesetze-im-internet.de/ustg_1980/__14b.html
- https://www.gesetze-im-internet.de/ao_1977/__147.html
