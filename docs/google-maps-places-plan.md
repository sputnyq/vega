# Plan: Google-Streckenberechnung und Adressvorschläge

**Stand:** 2026-10-11  
**Status:** Lokal umgesetzt und charakterisiert (Schritte 1, 3–5 lokal); der echte Google-/Hostinger-Proof (Schritt 2, Staging) bleibt offen.

## 1. Ziel

Google-Dienste sollen zwei klar begrenzte Aufgaben unterstützen:

1. Im geschützten Admin-Auftragseditor auf ausdrückliche Benutzeraktion die Fahrstrecke vom Betriebsstandort über die eingetragenen Umzugsadressen zurück zum Betriebsstandort ermitteln und in den Auftragsentwurf übernehmen.
2. Im öffentlichen Kundenformular beim Eingeben von Auszugs- und Einzugsadressen Vorschläge liefern und nach einer Auswahl Straße, Postleitzahl und Ort vorausfüllen.

Beide Funktionen bleiben nutzbar, wenn Google nicht konfiguriert oder nicht erreichbar ist: Adressen und Entfernung können manuell eingegeben werden. Google-Ergebnisse sind Hilfen, keine Autorität für Speicherung, Preisberechnung oder Validierung.

## 2. Schlüsselentscheidung

**Entscheidung (Betreiber, 2026-10-11): ein einziger Google-Maps-API-Schlüssel in der
serverseitigen Runtime-Variablen `GOOGLE_MAPS_API_KEY`.** Abweichend von der ursprünglichen
Empfehlung zweier getrennter Schlüssel (je API begrenzt, separat überwachbar und rotierbar)
wird bewusst nur ein Schlüssel verwendet. Er wird nicht als `VITE_*`-Variable in
Frontend-Builds eingebettet.

| Variable              | Verwendung                                                                                                   | Google-API-Einschränkung          |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `GOOGLE_MAPS_API_KEY` | Serverseitiger Places-Proxy im Kundenformular und serverseitige Fahrstreckenermittlung aus dem Admin         | Places API (New) **und** Routes API |

Der Schlüssel liegt in einem Google-Cloud-Projekt, in dem beide APIs aktiviert und
Abrechnung/Nutzungsgrenzen passend eingerichtet sind. Für serverseitige Web-Service-Aufrufe
ist laut Google eine IP-Anwendungseinschränkung vorgesehen. Vor Aktivierung muss daher
geprüft werden, ob Hostinger eine feste ausgehende IP bereitstellt. Wenn nicht, bleibt der
Schlüssel trotzdem ausschließlich serverseitig, wird auf genau diese zwei APIs beschränkt
und mit Quoten-/Nutzungsmonitoring betrieben; eine nicht unterstützte oder unbekannte IP
darf nicht als Beschränkung eingetragen werden. Konsequenz der Einzel-Key-Wahl: Places-
und Routes-Nutzung teilen sich Quoten/Monitoring und können nicht unabhängig rotiert werden.

## 3. Bestandsaufnahme Vega-Zielsystem

Die nachfolgende Funktionalität existiert bereits im aktuellen Vega-Arbeitsbaum:

| Bereich               | Vorhandener Stand                                                                                                                                                                     | Offener Nachweis / Abgleich                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Runtime-Konfiguration | Die Variable `GOOGLE_MAPS_API_KEY` wird als optionaler serverseitiger Wert geladen; ohne Key bleiben Funktionen verfügbar, aber deaktiviert. | Produktives/Staging-Secret im Hostinger-Runtime-Panel einrichten und nachweisen, dass es nicht in Builds gelangt. |
| Kundenformular        | Serverproxy für Places-Autocomplete und anschließendes Abrufen der Adresskomponenten; DE/AT-Filter, Feldmasken, Session-Token, Timeout, Rate-Limit und manuelle Eingabe als Fallback. | Provider-Proof, Rate-/Kostenmonitoring und Test im echten WordPress-Origin.                                         |
| Admin                 | Geschützte UI mit ausdrücklichem Button, geprüftem Adresssatz, Status-/Fehleranzeige und Übernahme von Kilometern in den Formularentwurf. Adressvorschläge über den mitarbeitergebundenen Proxy `/api/admin/places/*` (gleicher Service wie öffentlich, aber mit Staff-Session und Admin-Rate-Limit) im Auftragseditor, im Optionen-Standort und in der Rechnungsadresse; ein shared Hook bündelt Debounce, Abbruch und Session-Rotation. | Autorisierungs-/Rollentest, manuelle Speicherung des geänderten Auftrags sowie Provider-Proof.                      |
| Serverstrecke         | Routes-API-Aufruf mit Betriebsstandort als Start und Ziel, Umzugsadressen als Zwischenstopps; begrenzte Antwortprojektion und Eingabevalidierung.                                     | Fachliche Reihenfolge mit Mehrfachadressen sowie Ergebnis/Rundung gegen reale Testfälle abnehmen.                   |
| Einstellungen         | Betriebsstandort ist eine nicht geheime Admin-Option und wird nicht an das öffentliche Formular ausgegeben.                                                                           | Korrekte, normalisierte Geschäftsadresse einrichten.                                                                |

Konkrete Einstiegspunkte sind [Serverkonfiguration](../apps/server/src/config.ts), [Places-Routen](../apps/server/src/customer-form-routes.ts), [Routes-Routen](../apps/server/src/maps/route-routes.ts), [Admin-Streckenkomponente](../apps/admin/src/orders/RouteDistance.tsx), [Formular-Adressfelder](../apps/customer-form/src/AddressFields.tsx), [Optionenansicht](../apps/admin/src/settings/OptionsPage.tsx) und [.env.example](../.env.example).

## 4. Legacy-Prüfung

### Admin (`old-app/um-admin`)

- [Distance.tsx](../old-app/um-admin/src/components/edit-order-components/Distance.tsx) lud Maps JavaScript im Browser und rief `DistanceMatrixService` auf. Es wurden Betriebsstandort und bis zu vier Adressen als Origins/Destinations verwendet; die Komponente leitete daraus eine Gesamtstrecke ab und schrieb sie automatisch in den Order-Store. Die getrennten Origin-/Destination-Arrays und die diagonale Summierung sind bei optionalen Zwischenadressen nicht offensichtlich deckungsgleich mit der gewünschten Reihenfolge und müssen daher charakterisiert statt blind portiert werden. Providerfehler wurden im Wesentlichen nur in der Konsole behandelt.
- [OrderField.tsx](../old-app/um-admin/src/components/OrderField.tsx) nutzte Places-Autocomplete im Browser und übernahm eine formatierte Adresse. Die Länderbeschränkung im Admin war DE/AT/CH.
- Der Deploy-Workflow injizierte ein gemeinsames `VITE_GOOGLE_API_KEY` aus `GOOGLE_API_KEY` in den Frontend-Build ([Deploy-Workflow](../old-app/um-admin/.github/workflows/deploy.yml)). Damit war der Schlüssel im veröffentlichten Client-Bundle auffindbar; das ist keine serverseitige Secret-Verwendung. Die Einschränkung des Keys wäre daher besonders wichtig gewesen.

### Kundenformular (`old-app/um-forms`)

- [AddressAutocomplete.tsx](../old-app/um-forms/src/shared/components/AddressAutocomplete.tsx) nutzte ebenfalls die browserseitige Maps-JavaScript-Places-Library. Es beschränkte auf DE/AT und füllte Straße, Hausnummer, PLZ und Ort aus ausgewählten Address Components.
- Auch das Formular baute den gleichen Variablennamen `VITE_GOOGLE_API_KEY` ein ([Deploy-Workflow](../old-app/um-forms/.github/workflows/deploy.yml)); in der Legacy-Deploykonfiguration teilten Admin und Formular somit einen Google-Key.
- Beide Legacy-Pakete hängen vom Maps-JavaScript-Loader ab. Das neue Vega-Ziel verwendet stattdessen serverseitige Web-Service-Aufrufe und braucht diesen Browser-Key/Loader für die angefragten Funktionen nicht.

**Portierungsentscheidung:** Verhalten und Datenfelder übernehmen, nicht den Legacy-Transport. Insbesondere keine Google-Keys an React/Vite ausliefern, keine direkte Google-Abfrage aus dem Kundenbrowser und keinen automatischen Aufruf der Streckenberechnung bei jedem Adresswechsel.

## 5. Geplanter Ablauf und noch notwendige Arbeit

### Schritt 1 – Architekturvertrag vervollständigen

Die bestehende Dokumentation begrenzt die öffentliche API grundsätzlich auf sichere Katalog-GETs, Order-POST und begrenzte Upload-Anbahnung. Das öffentliche Places-Proxy-Verhalten ist darin nicht ausdrücklich als zusätzliche, enge Ausnahme beschrieben. Vor dem Provider-Proof sind [ADR 0003](adr/0003-wordpress-einbettung-und-public-api.md), [Implementierungsplan](implementation-plan.md) und [Implementierungsstatus](implementation-status.md) konsistent zu ergänzen:

- ausdrücklich nur die zwei benötigten Places-Aktionen als minimale öffentliche Service-API freigeben;
- keinen Place-/Auftragsspeicher-Endpunkt, generischen Google-Proxy oder öffentlichen Order-Read hinzufügen;
- Ursprung/CORS, Rate-Limit, Schema- und Payload-Grenzen sowie Provider-Ausfall-Fallback dokumentieren;
- Admin-Routenberechnung als authentifizierte Admin-API benennen.

### Schritt 2 – Google-Projekt und Runtime-Zugänge

1. Nichtproduktives Google-Cloud-Projekt mit aktivierten Places API (New) und Routes API einrichten.
2. Einen API-Key anlegen und auf Places API (New) und Routes API beschränken.
3. Die Möglichkeit einer stabilen Hostinger-Egress-IP verifizieren und, falls möglich, als Anwendungsbeschränkung setzen.
4. Den Schlüssel ausschließlich als Hostinger-Server-Runtime-Wert `GOOGLE_MAPS_API_KEY` konfigurieren. Keine Secrets in `.env.example`, GitHub-Artefakte, Vite-Variablen, Browserantworten oder Logs aufnehmen; Beispieldateien enthalten nur leere Platzhalter.
5. Quoten, Nutzungsberichte und Warnungen für unerwartete Nutzung/Kosten einrichten. Verfügbarkeitsflags dürfen höchstens anzeigen, ob die Funktion konfiguriert ist, niemals Schlüsselwerte liefern.

### Schritt 3 – Places-Vorschläge im Kundenformular abnehmen

- Straße/Hausnummer in den Adressfeldern „Auszug“ und „Einzug“ mit Vorschlägen ergänzen; ab drei Zeichen anfragen, Eingaben entprellen und veraltete Requests abbrechen.
- Nur DE/AT zulassen (Kundenformular). Mitarbeiter-Proxy (`/api/admin/places/*`) zusätzlich CH, wie der Legacy-Admin. Vorschläge und ausgewählte Adresse über den Server abrufen; mit einem Session-Token die Autocomplete- und anschließende Detailabfrage verbinden und nach Auswahl ein neues Token verwenden.
- Nur `street`, `postalCode` und `city` zurückgeben. Google-Response, API-Key oder nicht benötigte Ortsdetails nicht an den Browser geben.
- Manuelle Eingabe bleibt vollständig möglich, auch bei fehlendem Key, leerer Trefferliste, Timeout oder Google-Fehler. Der Server validiert die letztlich eingereichten Adressdaten weiterhin unabhängig von der Vorschlagsauswahl.
- Sicherstellen, dass öffentliche Antworten keine interne Betriebsadresse, Mitarbeiterdaten oder Providerdetails enthalten. Alle Responses nicht cachen, falls sie session-/eingabebezogen sind.

### Schritt 4 – Admin-Streckenberechnung abnehmen

- Nur im geschützten Order-Editor für Admin/Kundenberater anzeigen. Die Berechnung startet ausschließlich nach explizitem Klick.
- Stoppreihenfolge fachlich festlegen und testen: Betriebsstandort → Auszug → optionale weitere Auszugsadresse → Einzug → optionale weitere Einzugsadresse → Betriebsstandort. Inaktive/ausgeblendete Nebenadressen dürfen nicht in die Route gelangen.
- Serverseitig 2–4 nichtleere Adressstrings mit Typ-/Längenlimits annehmen; die UI verlangt Straße, PLZ und Ort. Origin aus Admin-Einstellungen lesen und Request-Limits pro Mitarbeiter durchsetzen. Client darf keinen anderen Google-Aufruf oder Key wählen.
- Routes-API-Feldmaske minimal halten: `routes.distanceMeters`, `routes.duration` sowie je Leg `distanceMeters`/`duration`. Kilometer (gerundet) fließen in den Auftragsentwurf, Dauern und Teilstrecken sind reine Anzeige im Editor (Stopp → Pfeil mit km + Zeit → Stopp …, Gesamtzeile) und werden nicht gespeichert. Timeout, Providerfehler, fehlende Route und ungültige Distanz als maschinenlesbare Fehler mit sicheren UI-Meldungen abbilden. Keine Adressen oder API-Key-Werte in Logs schreiben.
- Gerundete Kilometer nur in den aktuellen ungespeicherten Auftragsentwurf übernehmen. Der normale Speichervorgang bleibt maßgeblich; manuelle Korrektur bleibt möglich. Einen Providerfehler nicht als `0 km` oder erfolgreiche Berechnung darstellen.

### Schritt 5 – Tests und Zielumgebungs-Proof

- Unit-Tests: Adressvalidierung/Anzahl/Größenlimits, DE/AT-Konfiguration, Feldprojektion, Rundung und ungültige Providerantworten.
- API-Tests mit gemocktem Google-Fetch: Erfolg, Timeout, HTTP-Fehler, leere Route, Rate-Limit, fehlender Key, keine Secret-Leaks in Antwort/Logs.
- Autorisierungstests: Gäste können die Admin-Routenberechnung nicht aufrufen; Admin und Kundenberater dürfen gemäß Rollenmatrix; öffentliche Places-Routen geben nur die festgelegten Safe DTOs zurück.
- Frontend-Tests: Vorschläge für Auszug/Einzug, Session-Token-Rotation, Abbruch alter Requests, manuelle Eingabe bei Fehlern, Route nur auf Klick, geänderte Strecke bleibt bis zum Speichern im Dirty-Entwurf.
- Danach im Staging mit WordPress-Test-Origin und echten, beschränkten Google-Testzugängen Place-Auswahl, vollständige Route, Quotenverhalten und Kostenmetriken prüfen. Providerzugänge oder lokales Mocking ersetzen diesen externen Proof nicht.
- Anschließend `npm run typecheck`, `npm test` und `npm run build` ausführen; Status-/Proof-Dokumente und bei geänderter API-Freigabe ADR 0003 aktualisieren.

## 6. Abnahmekriterien

- Keine Google-API-Schlüssel in Admin-/Kundenformular-JavaScript, HTML, sourcemaps oder öffentlichen API-Antworten.
- Places schlägt nur Adressen in DE/AT vor und füllt die erwarteten Adressfelder; manuelle Eingabe funktioniert jederzeit.
- Routes berechnet die fachlich bestätigte Stoppreihenfolge vom Betriebsstandort zurück zum Betriebsstandort und füllt Kilometer nur nach erfolgreicher Berechnung ein.
- Admin-API ist serverseitig autorisiert, öffentliche Places-Endpunkte sind eng begrenzt und rate-limitiert.
- Ausfälle sind erkennbar, führen nicht zu falschen Nullwerten und blockieren weder manuelle Eingabe noch Auftragsspeicherung.
- Der Schlüssel ist auf Places API (New) und Routes API eingeschränkt, wenn möglich zusätzlich IP-eingeschränkt, und Nutzung/Quoten werden überwacht.
- Nichtproduktiver Proof für Hostinger-Runtime und echten Google-Aufruf ist dokumentiert.

## 7. Fachliche Bestätigung

**Bestätigt (Betreiber, 2026-10-11): Die Kilometerzahl wird auf ganze Kilometer gerundet.**
Die Routes-Anfrage rechnet Meter in Kilometer um (`Math.round(distanceMeters / 1000)`),
mit Tests fixiert (1499 m → 1 km, 1500 m → 2 km). Offen bleibt vor dem
Staging-Abnahmetest nur die Bestätigung der Stoppreihenfolge bei Aufträgen mit
optionalen Mehrfachadressen (Betriebsstandort → Auszug → optionale weitere
Auszugsadresse → Einzug → optionale weitere Einzugsadresse → Betriebsstandort).
Bis dahin wird keine abweichende Preisregel angenommen.

## 8. Quellen

- [Google Maps Platform: Best Practices für API-Sicherheit](https://developers.google.com/maps/api-security-best-practices) – separate Schlüssel pro Anwendung, Anwendungs-/API-Einschränkungen, serverseitige Webdienst-Schlüssel und IP-Einschränkungen, wenn praktikabel.
- [Google Places API (New): Einrichtung](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Google Routes API: Einrichtung](https://developers.google.com/maps/documentation/routes/get-api-key)
- [Google Routes API: Compute Routes](https://developers.google.com/maps/documentation/routes/compute-route-over)
- Vega-Anforderungen: [Umsetzungsplan](implementation-plan.md), [Zielarchitektur](target-architecture.md), [ADR 0003](adr/0003-wordpress-einbettung-und-public-api.md), [Implementierungsstatus](implementation-status.md), [Integrations-Proof](proof-01-integration-compatibility.md) und [README](../README.md).
