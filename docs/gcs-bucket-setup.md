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

In der Google Cloud Console unter _APIs & Services_:

- **Cloud Storage API** aktivieren.
- **IAM Service Account Credentials API** aktivieren (für die Schlüssel-
  verwaltung des Service Accounts).

## Schritt 2 – Bucket anlegen

Console → Cloud Storage → _Buckets_ → _Create_:

| Feld           | Wert                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| Name           | global eindeutig, z. B. `vega-eu-images`; wird als `GCS_BUCKET` konfiguriert                  |
| Location type  | **Region** (keine Multi-Region)                                                               |
| Location       | EU-Region, z. B. `europe-west1` oder `europe-west3`; Multi-Region `EU` ist ebenfalls zulässig |
| Storage class  | Standard                                                                                      |
| Public access  | **Enforce public access prevention** (erzwungen)                                              |
| Access control | **Uniform bucket-level access** (keine Objekt-ACLs)                                           |
| CMEK           | aus; Standard-Verschlüsselung genügt                                                          |

Das Backend erwartet eine der folgenden Location-Werte (Groß-/Kleinschreibung
egal): `EU`, `EUR4`, `EUROPE-WEST1`, `EUROPE-WEST3`, `EUROPE-WEST4`,
`EUROPE-WEST8`, `EUROPE-WEST9`, `EUROPE-WEST10`, `EUROPE-WEST12`,
`EUROPE-NORTH1`, `EUROPE-CENTRAL2`, `EUROPE-SOUTHWEST1`.

## Schritt 3 – Lifecycle-Regel (genau eine, unbedingt)

Bucket → _Lifecycle_ → _Add rule_:

- **Action:** Delete objects
- **Condition:** Age = **180** Tage; keine weitere Bedingung (kein Prefix,
  kein `IsLive` usw.)

Das Backend verlangt **genau eine** unbedingte Delete-Regel mit
`age: 180`. Jede zusätzliche Lifecycle-Regel (auch eine Staging-
Bereinigungsregel) führt zu `UNSAFE_BUCKET_CONFIGURATION`. Verwaiste
Staging-Objekte werden daher nicht vorzeitig gelöscht; ihre Bereinigung
erfolgt ausschließlich über die 180-Tage-Regel.

// TODO hier

## Schritt 4 – CORS für Signed-POST-Uploads

Bucket → CORS-Konfiguration, z. B. per `gcloud`. `gcloud storage buckets
update` erwartet eine JSON-Datei über `--cors-file`; `--cors=...` ist kein
gültiges Flag. Die CORS-Datei muss ein JSON-Array mit einem Eintrag pro Regel
sein:

```bash
cat > /tmp/vega-gcs-cors.json <<'EOF'
[
  {
    "origin": [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175"
    ],
    "method": ["GET", "POST", "HEAD"],
    "responseHeader": ["Content-Type", "x-goog-*"],
    "maxAgeSeconds": 3600
  }
]
EOF

gcloud storage buckets update gs://vega-eu-images-dev \
  --cors-file=/tmp/vega-gcs-cors.json
```

- Für lokale Entwicklung die exakten Origins verwenden, einschließlich Scheme
  und Port. `localhost` und `127.0.0.1` sind verschiedene Origins; letzteres
  muss zusätzlich eingetragen werden, wenn der Browser damit geöffnet wird.
- Die obigen localhost-Origins sind ausschließlich für einen Dev-/Staging-Bucket.
  Im Produktionsbucket nur die exakten WordPress-/Formular-Origins (Scheme +
  Host, ggf. Port) eintragen; keine Wildcard-Origin.
- Die CORS-Konfiguration anschließend prüfen, z. B. mit
  `gcloud storage buckets describe gs://vega-eu-images-dev`.
- Der tatsächliche CORS-Proof mit echtem Provider ist Teil von A0 und in
  `proof-01-integration-compatibility.md` als offen dokumentiert.

## Schritt 5 – Service Account für den Server

Für Dev/Staging und Produktion jeweils einen **eigenen** Service Account
verwenden, z. B. `vega-server-gcs-dev` im Dev-Projekt und
`vega-server-gcs-prod` im Produktionsprojekt. So erhält der Dev-Server keinen
Zugriff auf Produktionsbilder.

1. Console → **IAM & Admin → Service Accounts → Create service account**.
   Namen und ID vergeben, z. B. `vega-server-gcs-dev`. Eine Beschreibung wie
   „Vega-Serverzugriff auf den Dev-Bildbucket“ hilft bei der Zuordnung.
2. Im optionalen Schritt **Grant this service account access to project** keine
   Projektrolle vergeben. Abschließen und die E-Mail-Adresse des Service
   Accounts kopieren.
3. **Cloud Storage → Buckets → `vega-eu-images-dev` → Permissions → Grant
   access** öffnen. Die kopierte Service-Account-E-Mail als Principal
  hinzufügen und **beide** Rollen direkt auf diesem Bucket zuweisen:
  **Storage Object Admin** für Lesen/Schreiben/Kopieren von Objekten sowie
  **Storage Legacy Bucket Reader** für `storage.buckets.get` (der Server liest
  damit die Bucket-Metadaten, um Region, Public-Access-Prevention,
  Uniform-Bucket-Level-Access und Lifecycle-Regel zu prüfen). Nur
  `Storage Object Admin` reicht für diese Bucket-Metadatenabfrage nicht aus
  und führt zu `403 storage.buckets.get denied`. Nicht stattdessen Rollen auf
   Projektebene vergeben. Falls die Console-Rollensuche die Rolle nicht
   anbietet, kann die Bucket-Bindung mit der vordefinierten Rollen-ID gesetzt
   werden (Service-Account-Adresse ersetzen):

   ```sh
   gcloud storage buckets add-iam-policy-binding gs://vega-eu-images-dev \
     --member=serviceAccount:vega-server-gcs-dev@DEINE_DEV_PROJEKT_ID.iam.gserviceaccount.com \
     --role=roles/storage.legacyBucketReader
   ```

   Die Rollen-ID `roles/storage.legacyBucketReader` ist die vordefinierte
   **Storage Legacy Bucket Reader**-Rolle und enthält `storage.buckets.get`.
4. Authentifizierung bevorzugt ohne herunterladbaren Schlüssel einrichten,
   sofern die Serverumgebung Workload Identity/ADC unterstützt. Für einen
   lokalen Dev-Server oder Hostinger, wenn keine solche Integration verfügbar
   ist, kann ein JSON-Schlüssel erforderlich sein: Service Account → **Keys →
   Add key → Create new key → JSON**. Datei direkt an einem sicheren Ort
   außerhalb des Repositorys speichern, z. B. unter
   `~/.config/vega/gcs-dev-service-account.json`; restriktive Dateirechte
   setzen. Google zeigt den privaten Schlüssel nur beim Erstellen zum Download
   an. Verlorene Schlüssel nicht aus Backups/Chats kopieren, sondern einen
   neuen erstellen und den alten nach Umstellung löschen.
5. Wenn **Create new key** durch eine Organisationsrichtlinie gesperrt ist,
   nicht versuchen, diese zu umgehen. Projektadministrator fragen, ob eine
   genehmigte keyless-Identität verfügbar ist oder eine Ausnahme benötigt wird.

Für Produktion dieselben Schritte mit eigenem Produktions-Service-Account und
Produktionsbucket wiederholen. Niemals den Dev-Schlüssel für Produktion nutzen.
Keine Schlüsseldateien oder Zugangsdaten in das Repository, in Vite-Builds,
Tests, Logs oder Beispiele legen und Schlüssel weder in Chat noch Tickets
kopieren.

## Schritt 6 – Runtime-Konfiguration des Servers

Die Konfiguration in `apps/server/src/config.ts` erwartet:

| Variabale                        | Wert                                              |
| -------------------------------- | ------------------------------------------------- |
| `GCS_BUCKET`                     | Bucket-Name aus Schritt 2, z. B. `vega-eu-images` |
| `GOOGLE_CLOUD_PROJECT`           | Projekt-ID (optional, empfohlen)                  |
| `GOOGLE_APPLICATION_CREDENTIALS` | Pfad zum Schlüssel, sofern verwendet              |

Für den lokalen Dev-Server müssen diese Werte in dessen Prozessumgebung
gesetzt sein. Bei Verwendung des JSON-Schlüssels zeigt
`GOOGLE_APPLICATION_CREDENTIALS` auf die außerhalb des Repositories liegende
Datei; die Variable enthält **nicht** den JSON-Inhalt. Zum Beispiel:

```sh
export GCS_BUCKET=vega-eu-images-dev
export GOOGLE_CLOUD_PROJECT=DEINE_DEV_PROJEKT_ID
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/vega/gcs-dev-service-account.json"
npm run dev
```

`DEINE_DEV_PROJEKT_ID` durch die tatsächliche Dev-Projekt-ID ersetzen. Ein bereits
laufender Server übernimmt geänderte Variablen nicht; nach der Konfiguration
den Serverprozess neu starten. Für Hostinger dieselben Variablen in der
serverseitigen Runtime-Konfiguration setzen und den Produktions-Schlüssel
sicher bereitstellen, falls keyless ADC nicht unterstützt wird. Keine dieser
Variablen gehört in `VITE_*`-Konfigurationen oder Client-Bundles.

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
