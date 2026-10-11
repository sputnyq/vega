# GCS-Bucket anlegen (Betriebsanweisung)

Step-by-Step-Anleitung zum Anlegen des privaten Google-Cloud-Storage-Buckets
für Kundenbilder (ADR 0006, Arbeitspaket A8). Die Vorgaben sind bindend:
der Upload-Service in `apps/server/src/uploads/upload-service.ts` prüft die
Bucket-Konfiguration und lehnt den Betrieb sonst mit
`UNSAFE_BUCKET_CONFIGURATION` (503) ab.

## Voraussetzungen

- Google Cloud Account mit aktiviertem Billing.
- Ein GCP-Projekt (für den nichtproduktiven EU-Proof laut A0 zuerst ein
  separates Staging-Projekt, danach ein Produktionsprojekt).

## Schritt 1 – APIs aktivieren

In der Google Cloud Console unter *APIs & Services*:

- **Cloud Storage API** aktivieren.
- **IAM Service Account Credentials API** aktivieren (für die Schlüssel-
  verwaltung des Service Accounts).

## Schritt 2 – Bucket anlegen

Console → Cloud Storage → *Buckets* → *Create*:

| Feld | Wert |
| --- | --- |
| Name | global eindeutig, z. B. `vega-eu-images`; wird als `GCS_BUCKET` konfiguriert |
| Location type | **Region** (keine Multi-Region) |
| Location | EU-Region, z. B. `europe-west1` oder `europe-west3`; Multi-Region `EU` ist ebenfalls zulässig |
| Storage class | Standard |
| Public access | **Enforce public access prevention** (erzwungen) |
| Access control | **Uniform bucket-level access** (keine Objekt-ACLs) |
| CMEK | aus; Standard-Verschlüsselung genügt |

Das Backend erwartet eine der folgenden Location-Werte (Groß-/Kleinschreibung
egal): `EU`, `EUR4`, `EUROPE-WEST1`, `EUROPE-WEST3`, `EUROPE-WEST4`,
`EUROPE-WEST8`, `EUROPE-WEST9`, `EUROPE-WEST10`, `EUROPE-WEST12`,
`EUROPE-NORTH1`, `EUROPE-CENTRAL2`, `EUROPE-SOUTHWEST1`.

## Schritt 3 – Lifecycle-Regel (genau eine, unbedingt)

Bucket → *Lifecycle* → *Add rule*:

- **Action:** Delete objects
- **Condition:** Age = **180** Tage; keine weitere Bedingung (kein Prefix,
  kein `IsLive` usw.)

Das Backend verlangt **genau eine** unbedingte Delete-Regel mit
`age: 180`. Jede zusätzliche Lifecycle-Regel (auch eine Staging-
Bereinigungsregel) führt zu `UNSAFE_BUCKET_CONFIGURATION`. Verwaiste
Staging-Objekte werden daher nicht vorzeitig gelöscht; ihre Bereinigung
erfolgt ausschließlich über die 180-Tage-Regel.

## Schritt 4 – CORS für Signed-POST-Uploads

Bucket → CORS-Konfiguration, z. B. per `gcloud`:

```bash
gcloud storage buckets update gs://vega-eu-images \
  --cors='{"origin":["https://ihre-domain.at"],"method":["GET","POST","HEAD"],"responseHeader":["Content-Type","x-goog-*"],"maxAgeSeconds":3600}"
```

- `origin` ist der exakte WordPress-/Formular-Origin (Scheme + Host, ggf.
  Port); kein Wildcard-Origin in der Produktion.
- Der tatsächliche CORS-Proof mit echtem Provider ist Teil von A0 und in
  `proof-01-integration-compatibility.md` als offen dokumentiert.

## Schritt 5 – Service Account für den Server

Console → IAM & Admin → *Service Accounts* → *Create*, z. B.
`vega-server-gcs`:

- Rolle: **Storage Object Admin** (der Server signiert URLs, kopiert
  Staging- in finale Objektpfade und liest Objektmetadaten zur Verifikation).
- Bevorzugt ohne langlebigen JSON-Schlüssel arbeiten (Workload Identity /
  Application Default Credentials). Falls ein JSON-Schlüssel erforderlich
  ist: ausschließlich serverseitig in der Hostinger-Runtime speichern.
- Keine Zugangsdaten im Repository, in Vite-Builds, in Tests, in Logs oder in
  Beispielen (Zielregel: Secrets bleiben in serverseitiger
  Runtime-Konfiguration).

## Schritt 6 – Runtime-Konfiguration des Servers

Die Konfiguration in `apps/server/src/config.ts` erwartet:

| Variabale | Wert |
| --- | --- |
| `GCS_BUCKET` | Bucket-Name aus Schritt 2, z. B. `vega-eu-images` |
| `GOOGLE_CLOUD_PROJECT` | Projekt-ID (optional, empfohlen) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Pfad zum Schlüssel, sofern verwendet |

Ohne `GCS_BUCKET` bleibt der Upload-Service bewusst deaktiviert (siehe
Implementierungsplan, A8). Die Bucket-Prüfung läuft alle 5 Minuten erneut
beim ersten Upload.

## Schritt 7 – Verifikation (Abnahme-Check)

1. Server starten und Upload-Sitzung anfordern: keine
   503-Antwort `UNSAFE_BUCKET_CONFIGURATION`.
2. Kleines Test-JPEG (längste Kante ≤ 2000 px, ≤ 10 MB) über die
   Signed-POST-URL hochladen: Antwort `201`.
3. Objekt in der Konsole: liegt unter `customer-images/staging/` und ist
   **nicht öffentlich lesbar**.
4. Nach erfolgter Order-Zuordnung: Objekt wurde vom Server in den privaten
   finalen Pfad unter `customer-images/...` kopiert.
5. Lifecycle prüfen (Console oder `gsutil lifecycle`): genau eine
   Delete-Regel mit Age 180, keine weiteren Regeln.
6. Anonymen Zugriff testen: Download ohne Signatur muss fehlschlagen.
7. Werte des Checks in `proof-01-integration-compatibility.md`
   nachtragen (EU-GCS-Proof).

## Bezug zu anderen Dokumenten

- ADR 0006 (`adr/0006-gcs-und-bildlebenszyklus.md`): fachliche Entscheidung
  zu Speicherort, Lifecycle und Signed-URLs.
- `implementation-plan.md` § 4.7 und A8: Anforderungen an Bilder und
  Uploadanbahnung.
- `proof-01-integration-compatibility.md`: offener Provider-Proof
  (EU-GCS, CORS, Signed-URL-Verhalten).
