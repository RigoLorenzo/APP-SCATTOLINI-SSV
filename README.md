# DEPRECATO — Firebase Cloud Functions (sistema email legacy)

Questo codice **non è più deployato/attivo**. È stato sostituito dal commit
`d5cb503` ("feat: sostituisce Cloud Functions con Vercel API + GitHub
Actions cron").

## Perché è considerato non deployato

Il workflow `.github/workflows/deploy-functions.yml` (nome storico
fuorviante: si chiama "deploy-functions" ma il job è "Deploy Firestore
Rules") esegue solo:

```
firebase deploy --only firestore:rules --project scattolini-ssv-manager-cf17b
```

Non deploya mai `functions/`. Non essendoci altro workflow né history di
deploy verificabile da CLI in questo ambiente, si assume — come da
commit `d5cb503` — che le funzioni definite qui (`notifyVehicleReady`,
`weeklyReportCOC`) non siano più in esecuzione su Firebase.

## Sistema attivo (dove intervenire oggi)

| Funzione legacy (qui) | Sostituita da |
|---|---|
| `notifyVehicleReady` (trigger `onDocumentUpdated` su `veicoli`) | `api/sendVehicleReady.js` (Vercel serverless, chiamato client-side dal frontend dopo il cambio status) |
| `weeklyReportCOC` (`onSchedule`, lunedì 08:00) | `.github/workflows/weekly-report.yml` → `scripts/sendWeeklyReport.js` (cron GitHub Actions, lunedì 07:00 UTC) |

Entrambi i sistemi condividono la stessa struttura di config
(`config/emailNotifications`, `config/weeklyReport`) e template HTML
concettualmente equivalenti (qui in `templates/`, replicati nel sistema
attivo).

**Se serve modificare la logica di invio email, non toccare questa
cartella**: modificare `api/sendVehicleReady.js` e/o
`scripts/sendWeeklyReport.js` (vedi commento in cima a ciascun file).

Questa cartella è conservata solo come riferimento storico/di
implementazione. Se in futuro si conferma che nessun progetto Firebase
ha più queste funzioni deployate, può essere eliminata definitivamente.
