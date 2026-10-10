# Code-Review des Bestands: Analyse und Refactoring-Plan (keine Codeänderungen)

## Ziel

Der bestehende Code soll von einem KI-Agenten analysiert werden. Ergebnis ist ein **Plan als Kommentar in diesem Issue**, der beschreibt, wie der Code lesbarer, einfacher und langfristig wartbar wird. Der Code wurde größtenteils von KI-Agenten geschrieben und ist bereits committet.

## Harte Grenzen (müssen eingehalten werden)

- **Keine Änderungen am Code.** Dieses Issue ist reine Analyse. Keine Commits, keine Branches, keine Pull Requests.
- **Die UI darf nicht verändert werden.** Weder Layout, Texte, Styles noch Verhalten für Nutzer.
- **Die Business-Logik darf nicht verändert werden.** Fachliches Verhalten, Berechnungen, Regeln, Datenformate und öffentliche Schnittstellen bleiben identisch.
- Der Plan darf nur **verhaltensneutrale** Maßnahmen vorschlagen (z. B. Umbenennen, Aufteilen, Entfernen von totem Code, Vereinfachen von Struktur, Tests ergänzen).
- Erscheint eine Maßnahme als verhaltensverändernd oder unklar, **nicht in den Plan aufnehmen**, sondern separat unter „Offene Fragen“ aufführen.

## Vorgehen

1. Projektstruktur, README, `AGENTS.md`, Linter-/Formatter-Konfiguration und bestehende Konventionen lesen. Bestehende Konventionen haben Vorrang vor allgemeinen Regeln.
2. Den Bestand modulweise durchgehen und anhand der Checkliste unten bewerten. Nur Findings melden, die sich mit **Datei:Zeile** belegen lassen.
3. Findings nach Schweregrad und Aufwand sortieren.
4. Daraus einen umsetzbaren Plan in kleinen, einzeln prüfbaren Schritten ableiten.
5. Den Plan als **Kommentar in diesem Issue** veröffentlichen.

Die ausführlichen Review-Anweisungen stehen im Agenten `.opencode/agents/review.md` (bzw. `review-en.md`). Der Agent soll ihnen folgen. Kurzfassung der Checkliste:

- **Zu viel Struktur:** unnötige Abstraktionen, Interfaces mit nur einer Implementierung, durchreichende Schichten, Konfigurierbarkeit ohne Nutzen (YAGNI)
- **Duplikate und Inkonsistenz:** kopierte Logik (DRY), uneinheitliche Namens-, Fehler- und Logging-Stile, neue Helper trotz vorhandener
- **Lesbarkeit:** unklare Namen, lange Funktionen, tiefe Verschachtelung, mehrere Verantwortlichkeiten (SRP), magische Werte, Boolean-Flags als Parameter, überflüssige oder veraltete Kommentare
- **Toter Code:** ungenutzte Funktionen, Parameter, Imports, auskommentierter Code
- **Fehlerbehandlung:** zu breite `try/catch`, verschluckte Fehler, stille Fallbacks, Meldungen ohne Kontext
- **Architektur:** SOLID, Trennung von Fachlogik und Infrastruktur, Abhängigkeitsrichtung, globaler Zustand, enge Kopplung
- **Tests:** fehlende Tests für bestehende Logik und Fehlerfälle, Tests auf Implementierungsdetails, Tests, die nie fehlschlagen
- **Sicherheit (Kurzcheck):** hartcodierte Secrets, ungeprüfte Eingaben, Injection-Risiken, unsichere Defaults. Bei Auffälligkeiten dedizierten Security-Review empfehlen.

## Erwartetes Ergebnis: Kommentar mit folgendem Aufbau

1. **Gesamteindruck:** 2 bis 3 Sätze zur Wartbarkeit und zum größten Risiko.
2. **Bestandsaufnahme:** kurze Übersicht der Module und ihrer Verantwortung.
3. **Findings**, sortiert nach Schweregrad (Kritisch / Wichtig / Hinweis), je mit Fundstelle `pfad/datei:zeile`, Problem und Empfehlung.
4. **Umsetzungsplan:** nummerierte Schritte in sinnvoller Reihenfolge, jeweils mit
   - Ziel und betroffenen Dateien
   - Begründung
   - geschätztem Aufwand (klein / mittel / groß)
   - Risiko für UI und Business-Logik (muss „keines“ sein)
   - Absicherung (welche Tests oder Checks vorher vorhanden sein müssen)
5. **Absicherungsstrategie:** welche Tests ergänzt werden sollten, bevor refactored wird (z. B. Charakterisierungstests), damit Verhalten nachweislich gleich bleibt.
6. **Offene Fragen:** alles, was unklar ist oder das Verhalten berühren könnte.

## Akzeptanzkriterien

- [ ] Es wurde kein Code geändert (keine Commits, Branches oder PRs).
- [ ] Der Plan steht als Kommentar in diesem Issue.
- [ ] Jedes Finding hat eine Fundstelle (Datei:Zeile).
- [ ] Jeder Planschritt ist verhaltensneutral begründet und einzeln umsetzbar.
- [ ] Verhaltensberührende Punkte stehen unter „Offene Fragen“, nicht im Plan.
- [ ] Der Kommentar ist auf Deutsch, sachlich und ohne Floskeln.

## Nicht Teil dieses Issues

- Umsetzung der Maßnahmen (folgt in separaten Issues nach Freigabe des Plans)
- Neue Features oder Fehlerbehebungen
- Änderungen an UI, Design oder fachlichem Verhalten
