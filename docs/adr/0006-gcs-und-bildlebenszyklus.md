# ADR 0006: Private GCS-Bilder mit Browserkomprimierung

- **Status:** Akzeptiert
- **Datum:** 2026-10-05

## Entscheidung

- Neue Bilder gehen in einen privaten Google Cloud Storage Bucket in einer EU-Region.
- Browser-Komprimierung: JPEG, längste Kante höchstens 2000 px, ca. 80 % Qualität, höchstens 10 MB je Bild.
- Es gibt keine Begrenzung der Bildanzahl je Order.
- Nur Bilddateien; keine Word-/PDF-/sonstigen Dokumente.
- Backend stellt kurzlebige, eingeschränkte Upload-/Download-Links aus. Keine GCS-Credentials im Client.
- Server verifiziert erlaubte Dateitypen/-größen und Orderzuordnung; Browserfilter ist nicht vertrauenswürdig.
- GCS Lifecycle löscht Objekte nach 180 Tagen ab Upload. Order-Purge führt keine GCS-Löschung aus; Links dürfen später ungültig sein.

## Folgen

- Vor finaler Orderanlage ist ein Upload-Session-/Staging-Verfahren erforderlich, damit Bilder sicher zugeordnet werden.
- Nicht abgeschlossene Uploads brauchen eine definierte Bereinigung; diese darf nicht versehentlich gültige Bilder vor 180 Tagen löschen.

## Lokaler Umsetzungsstand (2026-10-09)

- Signed-POST-Policy läuft nach 15 Minuten ab und bindet Objektpfad,
  JPEG-Content-Type und exakte Dateigröße. Claims sind 24 Stunden gültig;
  der Server speichert nur den Hash des zufälligen Claim-Tokens.
- Verifikation prüft GCS-Metadaten und dekodiert die tatsächlichen JPEG-Bytes.
  Sie bindet eine konkrete Generation und kopiert sie vor der Orderzuordnung
  in einen privaten, nicht browserbeschreibbaren finalen Objektpfad.
- Zuordnung wird im selben DB-Commit wie Order, Nummer und Outbox verbraucht.
  Abgelaufene, unbestätigte, fremde oder bereits verbrauchte Claims werden
  abgewiesen; Tokens werden nicht im Order-JSON gespeichert.
- Angebotskopien erhalten unabhängige Referenzen auf dasselbe GCS-Objekt.
  Das Löschen einer Order entfernt nur ihre DB-Referenzen, keine GCS-Objekte.
- Vor Uploadanbahnung wird eine EU-Region, Uniform Bucket-Level Access,
  erzwungene Public Access Prevention und genau eine unbedingte
  Delete-Lifecycle-Regel nach 180 Tagen verlangt. Das gilt auch für verwaiste
  Staging-Objekte; sie werden nicht vorzeitig gelöscht.
- Der tatsächliche Google-/Bucket-CORS-Proof bleibt mangels Providerzugängen
  offen. Eine spätere Maintenance-Erweiterung muss verwaiste DB-Claims nach
  Ablauf der Objektaufbewahrung entfernen.
- PDF-Anhänge werden on-demand erzeugt und gehören nicht in den Bildbucket.
