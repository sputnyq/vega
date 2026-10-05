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
- PDF-Anhänge werden on-demand erzeugt und gehören nicht in den Bildbucket.
