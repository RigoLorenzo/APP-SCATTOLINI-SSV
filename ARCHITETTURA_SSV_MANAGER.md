# SSV Manager — Mappa Architetturale Completa

---

## 1. STACK EFFETTIVO

|Livello|Tecnologia|Note|
|-|-|-|
|Framework UI|**React 19.2**|Nessun TypeScript, solo `.jsx`|
|Build tool|**Vite 7.1**|`vite.config.js` fa manual chunking (vendor-react, vendor-firebase, vendor-xlsx)|
|Routing|**Nessun router** (no react-router). Navigazione a stato singolo: `currentPage` in `App.jsx` decide quale pagina renderizzare tramite if/else in JSX. Nessuna URL profonda, nessun back-button support||
|State management|**Nessuno store globale (no Redux/Zustand).** Solo React Context API (3 provider) + prop-drilling + hook locali||
|Styling|**Tailwind CSS 3.4** (utility-first, inline nelle className). `postcss.config.js` + `tailwind.config.js` di default (nessun tema custom)||
|Icone|`lucide-react`||
|Backend/DB|**Firebase** (Firestore + Auth + Storage), SDK client `firebase@12.5` in tutta l'app||
|Backend serverless|**Vercel Serverless Function** (`api/sendVehicleReady.js`, runtime Node con `firebase-admin`) — invio email "veicolo pronto"||
|Automazioni schedulate|**GitHub Actions cron**, non più Firebase Cloud Functions (vedi §7)||
|Export dati|`xlsx` (SheetJS, da CDN) solo per **lettura** (import CSV/XLSX); `exceljs` (npm) per **scrittura** XLSX (export "Excel" + Backup Locale) — SheetJS community non scrive stili sulle celle, vedi §5 "Export XLSX"||
|Grafici|`ChartCanvas.jsx` — **canvas 2D scritto a mano**, nessuna libreria (no Chart.js/Recharts)||
|Deploy|Vercel per hosting SPA + API; Firebase per Firestore/Storage/Auth||

**Non c'è TypeScript, non c'è test runner configurato, non c'è Storybook.**

---

## 2. FLUSSO GENERALE — COME FUNZIONA L'APP DA A a Z

1. `main.jsx` monta `<App />` dentro `React.StrictMode`.
2. `App.jsx` avvolge tutto in 3 Provider annidati: `AuthProvider` → `NotificationProvider` → `UserProvider` → `AppContent`.
3. `AuthProvider` ascolta `onAuthStateChanged` di Firebase Auth. Finché `loading=true` non renderizza nulla (children nascosti).
4. Se `currentUser` è `null` → `AppContent` mostra `<LoginPage />` (email+password, nessuna registrazione self-service: "gli utenti vengono creati dall'amministratore").
5. Se autenticato, `UserProvider` fa un **listener realtime** (`onSnapshot`) sul documento `users/{uid}` per leggere il campo `role`. Da questo derivano 4 booleani globali: `isAdmin`, `isReadOnly`, `isOmologatore`, più `userName` (da `displayName` o `email`).
6. `useVehicles()` apre un **listener realtime unico e globale** su tutta la collection `veicoli` (ordinata per `dataConsegna`), che alimenta **tutte le pagine** con lo stesso array `vehicles` passato via props. Non esistono fetch separate per pagina: un solo snapshot Firestore nutre l'intera app.
7. `useVehicleCrud(vehicles)` centralizza tutte le operazioni di scrittura sui veicoli (create/update/delete/copy/deleteAll) e gestisce lo stato dei modali collegati (VehicleModal, CopyDateModal, DeleteAllModal, ImportCSVModal).
8. La navigazione tra le 9 pagine è uno **switch di stato locale** (`currentPage`, `useState`) nell'header — non ci sono URL diverse per pagina. Il ruolo `omologatore` forza `currentPage='riepilogo'` all'avvio e filtra il menu a sole 3 pagine.
9. Ogni pagina riceve `vehicles` (e in alcuni casi altre collection lette con `onSnapshot` locali, es. `parkingSpots`, `kits`, `messages`, `actions`) e li filtra/deriva localmente (nessuna cache/selector condiviso: ogni pagina ricalcola i propri filtri).
10. Le scritture (update di stato veicolo, assegnazioni, ecc.) vengono fatte con chiamate dirette Firestore (`updateDoc`/`addDoc`/`setDoc`) dentro le singole pagine o negli hook — non passano sempre da `useVehicleCrud`. Ogni scrittura logga un'azione nella collection `actions` tramite `logAction()`.
11. Grazie ai listener realtime, ogni scrittura di un utente si propaga a tutti i client connessi senza refresh (Firestore push).
12. Alcune transizioni di stato **triggerano side-effect automatici** (vedi §6 — "Regole di business").
13. Il layout globale (header, tab di navigazione, alert scadenze, toast, modali globali) vive in `App.jsx`; le pagine sono lazy-loaded con `React.lazy` + `Suspense` (eccetto quelle importate eager come componenti/modali condivisi).

---

## 3. PAGINE / MODULI DELL'APP

Tutte lazy-loaded da `App.jsx` tranne dove indicato. Tab visibili nel menu: **Officina, File Montaggi, Pianificazione Ritiri, Collaudi, Riepilogo, Chat & Azioni, Parcheggio, Telai in Attesa di Ordine, Materiale LDK a Stock, Analisi, Backup Locale (solo admin)**.

|#|Pagina|File|ID pagina|Funzione|
|-|-|-|-|-|
|1|**Officina**|`src/pages/OfficinaPage.jsx`|`officina`|Vista operativa quotidiana: liste "Da Allestire" / "In Allestimento" con filtri (tipo allestimento, senza telaio/SAP, non consegnati, COC mancante), toggle urgenza, cambio stato rapido (Inizia/Completa), ricerca. È la **home page di default**|
|2|**File Montaggi**|`src/pages/FileMonitaggiPage.jsx`|`file-montaggi`|Calendario mensile basato su `dataConsegna`. Filtri per committente/tipologia/vista. Apre `DayDetailModal` al click su un giorno. Esclude veicoli `ritirato`|
|3|**Pianificazione Ritiri**|`src/pages/PianificazioneRitiriPage.jsx`|`pianificazione-ritiri`|Calendario basato su `dataRitiro`. Gestisce 3 modalità: Ritiro mezzo / Consegna (bisarca o driver) / Appuntamento Montaggio (con ora). Ha un **effect di auto-transizione**: appuntamenti montaggio scaduti diventano automaticamente `status: ritirato` (vedi §6). **Assegnazione rapida da calendario** (vedi §11): click su un giorno apre il day-detail modal, che include una sezione "Assegna un veicolo pronto a questo giorno" (pool = veicoli `status: 'pronto'` senza `dataRitiro`, tutte e 3 le modalità sempre proponibili — vedi §12)|
|4|**Collaudi**|`src/pages/CollaudiPage.jsx`|`collaudi`|Calendario basato su `dataCollaudo`, mostra veicoli con `collaudo` in `da-collaudare`/`pianificato`/`collaudo-eseguito`. Sezione separata per veicoli senza data collaudo pianificata. **Assegnazione rapida da calendario** (vedi §11): click su un giorno apre il day-detail modal, che include una sezione "Assegna un veicolo a questo giorno" (pool = veicoli `collaudo: 'da-collaudare'` senza `dataCollaudo`)|
|5|**Riepilogo**|`src/pages/RiepilogoPage.jsx`|`riepilogo`|Vista aggregata di tutti i veicoli raggruppati per `status` (4 colonne). Ricerca full-text estesa (include campi admin come dealer/Ford). Unica pagina visibile di default all'`omologatore`|
|6|**Chat & Azioni**|`src/pages/ChatAzioniPage.jsx`|`chat`|Feed unico che fonde in ordine cronologico `messages` (chat libera) e `actions` (log automatico di ogni azione CRUD). Notifiche browser native su nuovo messaggio|
|7|**Parcheggio (P2)**|`src/pages/ParcheggioPage.jsx`|`parcheggio`|Mappa a griglia di 162 posti auto (layout hardcoded in `src/constants/parking.js`, lati SX/DX). Ogni posto è un doc in `parkingSpots`. Colore posto = stato live del veicolo assegnato|
|8|**Telai in Attesa di Ordine**|`src/pages/TelaiPage.jsx`|`telai`|**Reintrodotta, vedi §13.** Gestisce numeri di telaio noti prima dell'arrivo del relativo ordine SAP (collection `telai`: `numeroTelaio*`, `committente`, `dataArrivoVeicolo`, `chiaviDoppioParcheggio`, `note`). Include conversione 1-click **Telaio → nuova Scheda Veicolo** (componente interno `ConvertToVehicleModal`, stesso pattern di Kits sotto): `numeroTelaio`, `chiaviDoppioParcheggio` e `note` si riportano identici sui campi omonimi del veicolo, `dataArrivoVeicolo` diventa `dataArrivo` del veicolo, `committente` è precompilato ma resta modificabile nel modale di conversione. Il doc `telai` di origine viene **sempre** cancellato dopo la conversione (nessuna opzione per tenerlo)|
|9|**Materiale LDK a Stock (Kits)**|`src/pages/KitsPage.jsx`|`kits`|Gestione magazzino kit Liderkit (collection `kits`), separata dai veicoli. Include conversione 1-click **Kit → nuova Scheda Veicolo** (componente interno `ConvertToVehicleModal`) e filtro per **Categoria** (`BOX`/`BOX Isotermico`/`ricambi Liderkit`, opzionale) con contatore automatico dei materiali per categoria|
|10|**Analisi e Statistiche**|`src/pages/AnalisiStatistichePage.jsx`|`analisi`|Dashboard con filtri (anno/tipo/committente/date) e grafici via `ChartCanvas`: consegne/mese, tempo medio allestimento, completamenti/mese, distribuzione stato/tipo, top committenti|
|11|**Backup Locale**|`src/components/BackupExport.jsx`|`backup`|**Solo admin.** Export XLSX multi-sheet di tutte le collection su cartella locale (File System Access API, Chrome/Edge) o download. Backup automatico schedulabile lato client (6/12/24h)|
|—|**Login**|`src/components/LoginPage.jsx`|—|Form email/password, nessuna registrazione self-service|

**Nota storica su `telai`**: vedi §13 per la ricostruzione di come funzionava la pagina originale e la decisione di reintegrazione.

### Componenti condivisi rilevanti (non pagine)

* `src/components/modals/VehicleModal.jsx` — **il form più importante dell'app**: crea/modifica un veicolo, 5-6 tab (Generale, Allestimento, Liderkit [condizionale], Ritiri & Consegne, Documenti, Admin [solo admin])
* `src/components/modals/KitModal.jsx` — form kit LDK con upload immagini/PDF
* `src/components/modals/EmailNotificationsModal.jsx` — gestione destinatari email (2 tab: notifica "veicolo pronto" realtime, report settimanale COC)
* `src/components/modals/ImportCSVModal.jsx`, `CopyDateModal.jsx`, `DeleteAllModal.jsx`, `ConfirmModal.jsx`, `DayDetailModal.jsx`
* `src/components/Common/Modal.jsx` — shell condiviso per i modali (overlay + card + header opzionale a gradiente/"white" + footer), usato da tutti i modali sopra tranne `KitModal.jsx` (non ancora migrato)
* `src/components/Common/Dropdown.jsx` — menu a tendina generico (trigger render-prop + item), usato dal menu impostazioni in `App.jsx`
* `src/components/Common/VehiclePickerList.jsx` — lista veicoli con ricerca (search input + `<select size>`), estratta dal blocco che prima era duplicato inline in `PianificazioneRitiriPage.jsx`. Riusata in: sezione "Assegna veicolo" del day-detail modal di `CollaudiPage.jsx`, sezione "Assegna veicolo pronto" del day-detail modal di `PianificazioneRitiriPage.jsx`, e nel modale "Assegna Ritiro/Consegna" (`showAssignModal`) della stessa pagina (che prima duplicava lo stesso markup). Vedi §11. La ricerca interna ora usa l'helper full-field centralizzato `src/utils/searchUtils.js` (vedi §12)
* `src/components/Common/UniversalSearch.jsx` — ricerca globale nell'header (solo desktop, esclusa per omologatore), full-field via `src/utils/searchUtils.js` (vedi §12)
* `src/components/Common/ExpiringVehiclesAlert.jsx` — banner veicoli in ritardo (esclude box/isotermico), visibile solo su Officina/File Montaggi/Pianificazione Ritiri
* `src/components/VehicleCard.jsx` — card veicolo unica con 3 varianti (`detail`/`row`/`compact`), sostituisce le implementazioni duplicate storiche (ex `VehicleDetailCard.jsx`, ex `CompactVehicleCard` interna a Officina, ex blocco inline in Riepilogo)
* `src/constants/vehicleStatus.js` — colori/icone di stato veicolo centralizzati (usati da `VehicleCard.jsx`)
* `src/components/ChartCanvas.jsx` — motore grafici canvas custom (bar/pie)
* `src/components/Common/Toast.jsx`, `ErrorBoundary.jsx`

---

## 4. COME LE PAGINE SONO COLLEGATE (routing, navigazione, dati condivisi)

* **Routing**: nessuno. `currentPage` (stato in `App.jsx`) determina il render condizionale. Nessun deep-link, nessun back-button, refresh pagina = torna a `officina` (o `riepilogo` per omologatore).
* **Navigazione dati tra pagine**: quasi tutte le pagine ricevono le stesse props da `App.jsx`: `vehicles`, `onEditVehicle` (= `handleEditVehicle` di `useVehicleCrud`, apre sempre lo stesso `VehicleModal` globale). Questo è il meccanismo cardine: **qualsiasi pagina può aprire la scheda veicolo completa cliccando un'icona "occhio"/"impostazioni"**, e il salvataggio passa sempre dallo stesso `handleSaveVehicle`.
* **Dati condivisi cross-pagina più importanti**:

  * `vehicles` (array intero, realtime) — passato a Officina, FileMontaggi, Parcheggio, PianificazioneRitiri, Riepilogo, Collaudi, Analisi, e ai modali (VehicleModal, UniversalSearch, ExpiringVehiclesAlert).
  * `parkingSpots` — letto **solo** da `ParcheggioPage` (listener locale), ma referenziato in scrittura da `useVehicleCrud` (libera il posto quando un veicolo passa a `ritirato`) e da `PianificazioneRitiriPage` (stesso comportamento per gli appuntamenti montaggio scaduti).
  * `kits` — isolato in `KitsPage`, tocca `veicoli` solo nel flusso di conversione.
  * `messages`/`actions` — isolati in `ChatAzioniPage`.
* **Un solo VehicleModal globale**: montato in `App.jsx`, condiviso da tutte le pagine tramite `showVehicleModal`/`editingVehicle` di `useVehicleCrud`. Questo evita duplicazione ma significa che **ogni pagina che vuole aprire/modificare un veicolo deve ricevere `onEditVehicle` da `App.jsx`**.
* **Nessuna cache/selector condivisi**: ogni pagina rifiltra `vehicles` localmente ad ogni render (no `useMemo` sistematico, no libreria di query come React Query). Con dataset grandi questo è un punto di attenzione per performance future.

---

## 5. BACKEND DATI — FIRESTORE

Progetto Firebase: **`scattolini-6143a`** (da `.firebaserc`). Regole in `firestore.rules`, indici in `firestore.indexes.json`. In precedenza il progetto attivo era stato spostato a `scattolini-ssv-manager-cf17b`, poi tornato a `scattolini-6143a` perché il primo ha il billing disabilitato (piano Spark), che blocca l'export Firestore usato dai backup automatici — vedi nota in `DEPLOY_NUOVO_DATABASE.md`.

### Collections di primo livello (nessuna subcollection — tutto flat)

|Collection|Scopo|Chi scrive|Chi legge|
|-|-|-|-|
|**`veicoli`**|Entità centrale dell'app — una scheda per veicolo/allestimento|ruoli `admin`/operativi (non `non_operativo`)|tutti gli autenticati|
|**`users`**|Profilo/ruolo di ogni utente (doc id = `uid` Firebase Auth)|creazione: l'utente stesso al primo accesso; update ruolo: solo `admin`|tutti gli autenticati|
|**`kits`**|Magazzino "Materiale LDK a Stock"|operativi/admin|tutti|
|**`parkingSpots`**|Occupazione posti parcheggio P2 (doc id = es. `SX-A3`)|operativi/admin|tutti|
|**`messages`**|Chat interna (append-only, no update)|operativi/admin|tutti|
|**`actions`**|Log immutabile di ogni azione CRUD (append-only, no update/delete)|operativi/admin|tutti|
|**`telai`**|Numeri di telaio in attesa dell'ordine SAP, gestiti da `TelaiPage.jsx` (§3, §13) — reintrodotta lato frontend, le regole non erano mai state rimosse|operativi/admin|tutti|
|**`config`**|Documenti singoli: `config/emailNotifications`, `config/weeklyReport` (liste destinatari + enabled)|solo `admin`|tutti gli autenticati|
|**`emailLogs`**|Scritta dalla Vercel API (`api/sendVehicleReady.js`) — log invii email|solo backend (Admin SDK, bypassa le rules)|non letta da nessuna pagina frontend (nessuna UI di consultazione)|

### Ruoli utente (campo `users/{uid}.role`)

* `admin` — accesso completo, unico che vede tab "Backup Locale" e sotto-tab "Admin" (Info Ford) nel VehicleModal, unico che può modificare `config`
* `operativo` (default se `role` assente) — può scrivere ovunque tranne campi admin e `config`
* `non_operativo` — **read-only** ovunque (bloccato anche dalle Firestore rules via `canWrite()`)
* `omologatore` — read-only + menu ridotto a `riepilogo`, `file-montaggi`, `collaudi`

### Schema documento `veicoli` (ricostruito da `VehicleModal.jsx` + uso nelle pagine)

Campi raggruppati come nei tab del modale:

**Generale**: `committente*`, `dataConsegna*` (YYYY-MM-DD), `dataArrivo`, `numeroTelaio`, `targa`, `status*` (`da-allestire`|`in-allestimento`|`pronto`|`ritirato`), `chiaviDoppioParcheggio`, `posizioneParcheggio`, `ordineSAP`, `numeroMatricola`, `collaudo` (`da-collaudare`|**`pianificato`** [NUOVO, vedi §11]|`allestimento-omologato`|`collaudo-eseguito`|`non-richiesto`), `dataCollaudo`, `descrizioneAllestimento`, `note`, `urgente` (bool, gestito solo da OfficinaPage)

**Allestimento**: `tipoAllestimento*` (`box`|`isotermico`|`cassone-fisso`|`cassone-ribaltabile`), `dataMontaggio`, `codiceAllestimentoSAP`, `conSpondaCaricatrice` (bool, solo se `box`), `marcaSponda`, `matricolaSponda`, `matricolaGruppoFrigo` (solo se `isotermico`), `distinta` (oggetto file singolo, solo box/isotermico), `codiceInventario` (solo box/isotermico, stesso gate di `distinta`), `codiceAllestimento`, `descrizioneAllestimentoSAP`, `omologazioneCollaudo`
  * `dataPrevistaMontaggio` **rimosso dalla UI (Multi-fix, vedi §12)**: nessun input, filtro, export o uso in Analisi. Documenti Firestore pre-esistenti con questo campo lo mantengono, semplicemente ignorato in lettura ovunque — nessuna migrazione.

**Liderkit** (tab visibile solo se `tipoAllestimento` è box/isotermico): `numeroMatricolaLiderkit`, `weekSpedizioneKit`

**Ritiri & Consegne**: `modalitaRitiro` (`ritiro`|`consegna`|`montaggio`), `dataRitiro`, `ritiroGiorno` (giorno della settimana, testo libero da select), `oraMontaggio` (solo montaggio), `tipoConsegna` (`bisarca`|`driver`, solo consegna), `indirizzoConsegna` (solo consegna), `modalitaConsegna` (note libere, solo consegna), `clienteAvvisato` (`{si: bool, data}`), `ritiroSvolto` (bool), `noteRitiro`, `statoRitiro` (`da-pianificare`|`pianificato`|`svolto`, vedi §11)
  * `modalitaRitiroConsentite` **rimosso (Multi-fix, vedi §12)**: la restrizione per-veicolo sulle modalità ammesse nel popup calendario è stata eliminata — le 3 modalità (Ritiro del Mezzo, Consegna, Appuntamento Montaggio) sono sempre tutte proponibili, ovunque venga fatta l'assegnazione (scheda veicolo, popup calendario Pianificazione Ritiri). Nessun controllo UI, nessuna scrittura del campo. Documenti pre-esistenti con `modalitaRitiroConsentite` valorizzato lo mantengono ma il campo non viene più letto da nessun punto del codice — nessuna migrazione.

**Documenti**: `pagamentoDocumenti` (bool), `notePagamento`, `cocMandato` (bool — trigger email "pronto" verifica solo su cambio status, non su questo campo), `cocFase1` (testo libero), `documentiMandati` (bool), `dataSpedizioneDocumenti`, `files` (array di oggetti upload)

**Admin (solo visibile/editabile da `admin`, protetto anche da Firestore rules)**: `numeroBollaConsegna`, `non`, `nomeDealer`, `codiceDealer`, `codiceFord`, `codiceSCV`, `notePrezzo`, `ddtOkOkFgerace`

**Oggetto file** (usato in `files[]`, `distinta`, `kits.files[]`): `{ name, size, storagePath, downloadURL, uploadedAt, type? }` — upload su Firebase Storage sotto `veicoli/{timestamp}_{random}_{nomefile}` (path safe: caratteri non alfanumerici sostituiti)

### Campi "fantasma" — ESITO AUDIT (Task 4)

Indagine chiusa. Il documento riportava 8 campi riferiti in ricerche/email ma assenti dal form `VehicleModal`: `targa`, `modello`, `codiceInventario`, `posizioneParcheggio`, `ritiroGiorno`, `cocFase1`, `dataPrevistaMontaggio`, `modalitaConsegna`.

**Metodo**: non è stato possibile eseguire `scripts/auditVehicleFields.js` (Admin SDK) contro il progetto Firestore reale in questo ambiente di lavoro — manca `FIREBASE_SA_KEY`/qualunque credenziale di servizio. Lo script esiste ed è pronto all'uso (`FIREBASE_SA_KEY='<json>' node scripts/auditVehicleFields.js`) per una verifica futura con credenziali reali. In sua assenza, la classificazione sotto si basa su analisi statica incrociata: `firestore.rules` (nessuna whitelist di campo per `veicoli` oltre agli `adminFields()`, quindi nessuno degli 8 campi ha un vincolo esplicito nelle rules), `src/utils/csvUtils.js` (import/export), `generate_excel_template.py` (script che generava `public/Template_Importazione_Veicoli_SSV_Completo_REV.xlsx`, template Excel ufficiale distribuito agli utenti; rimosso in un successivo cleanup del repo perché non più referenziato da nulla — il file `.xlsx` generato resta invece in `public/`, verosimilmente distribuito fuori dall'app), `api/sendVehicleReady.js` (template email attivo) e tutte le pagine che leggono/cercano questi campi.

* **`targa`, `posizioneParcheggio`, `ritiroGiorno`, `cocFase1`, `dataPrevistaMontaggio`, `modalitaConsegna`** → **feature incompleta, non residuo**. Tutti e sei erano già inizializzati nello stato di `VehicleModal.jsx` (`getInitialState`) e/o scrivibili da import CSV (`buildVehicleFromRow` in `csvUtils.js`) e dalla conversione Kit→Veicolo (`KitsPage.jsx`), oltre a comparire nell'export completo (`exportCompleteXLSX`) e — per alcuni — nel template Excel ufficiale con valori di esempio. Mancava solo l'input nel form. **Aggiunti a `VehicleModal.jsx`**: `targa` e `posizioneParcheggio` in tab Generale; `dataPrevistaMontaggio` in tab Allestimento; `ritiroGiorno` (select giorno settimana) e `modalitaConsegna` in tab Ritiri & Consegne; `cocFase1` in tab Documenti.
* **`codiceInventario`** → **feature incompleta**, ma con un bug distinto: compare nel template Excel ufficiale (con valori di esempio) e nel template email "veicolo pronto", ma **non era mai stato incluso nei campi di default di `buildVehicleFromRow`** — quindi anche compilando la colonna nel template ufficiale, il valore veniva scartato silenziosamente in import, mai scritto su Firestore. Corretto in questo task (aggiunto ai default di `csvUtils.js`) e aggiunto un input nel tab Allestimento di `VehicleModal.jsx` (stesso gate box/isotermico della Distinta).
* **`modello`** → **residuo legacy, rimosso**. Unico riferimento in tutto il codice: un filtro di ricerca morto in `FileMonitaggiPage.jsx` (`v.modello?.toLowerCase()...`). Nessun punto di scrittura, nessuna colonna import/export, nessun template, nessuna menzione altrove. Rimosso il riferimento.

**Nota di sicurezza**: nessuna incoerenza trovata tra `firestore.rules` e questi campi — le rules non impongono whitelist a livello di singolo campo su `veicoli` (a parte gli `adminFields()`), quindi aggiungere input per questi 7 campi nel form non richiede modifiche alle rules. Il problema era interamente lato UI/import, non di autorizzazione.

### Documento `parkingSpots/{spotId}`

`{ id, side: 'SX'|'DX', column, row, status: 'occupied', vehicleId, vehicleData: {committente, targa, numeroTelaio, tipoAllestimento, status} (snapshot al momento dell'assegnazione, usato come fallback), assignedAt, assignedBy }`

`vehicleData.targa` è uno **snapshot denormalizzato intenzionale** copiato da `useVehicleCrud` al momento dell'assegnazione del posto — non è il campo master e va tenuto distinto da `veicoli/{id}.targa` (vedi audit sopra).

### Documento `kits/{id}`

`{ cliente, numeroMatricolaLiderkit, categoria ('BOX'|'BOX Isotermico'|'ricambi Liderkit', opzionale — vedi `src/constants/kitCategories.js`), dimensioniKit, specifiche, dataConsegnaMateriale (testo libero), files[] }`

### Documento `telai/{id}` (reintrodotto, vedi §3 e §13)

`{ numeroTelaio* (obbligatorio), committente, dataArrivoVeicolo (YYYY-MM-DD, default oggi), chiaviDoppioParcheggio, note }` — nessun file allegato (a differenza di `kits`), nessuna relazione diretta con `veicoli` se non al momento della conversione (`ConvertToVehicleModal` in `TelaiPage.jsx`, che crea un nuovo doc in `veicoli` mappando `numeroTelaio`/`chiaviDoppioParcheggio`/`note` sui campi omonimi e `dataArrivoVeicolo` → `dataArrivo`, poi cancella **sempre** il doc `telai` di origine)

### Documento `messages/{id}`

`{ userName, message, timestamp (serverTimestamp), createdAt (ISO string) }`

### Documento `actions/{id}`

`{ userName, action (stringa descrittiva libera), vehicleInfo: {committente, numeroTelaio, ...}, timestamp, createdAt }` — scritto da `logAction()` (`src/firebase.js` → `src/utils/firebaseUtils.js`) ad ogni operazione rilevante

### Documento `users/{uid}`

`{ role: 'admin'|'operativo'|'non_operativo'|'omologatore' }` — creato dall'utente stesso al primo login (poi il ruolo va promosso manualmente da un admin via Firestore console, **non c'è UI per gestire i ruoli**)

### Documento `config/emailNotifications` e `config/weeklyReport`

`{ enabled: bool, recipients: string[] }`

### Export XLSX — punti e allineamento (Task 5)

Tre percorsi di export distinti, tutti verificati:

* **`api` "Excel"** (bottone header, tutti gli utenti non-omologatore) → `exportCompleteXLSX()` in `src/utils/csvUtils.js`. Un solo sheet "Veicoli" con colonne etichettate in italiano.
* **Backup Locale** (solo admin) → `BackupExport.jsx` + `src/utils/backupUtils.js`. Sheet multipli, uno per collection (`veicoli`, `kits`, `parkingSpots`, `actions`, `messages`). **Dall'aggiornamento "Header leggibili" sotto**, colonne etichettate in italiano (in precedenza: nomi tecnici dei campi).
* **`ImportCSVModal.jsx`**: solo import, nessuna funzione di export propria (verificato).

**Trovato e corretto**:
* `codiceInventario` (il campo aggiunto nel Task 4) mancava da entrambi gli export "veicoli": aggiunto sia a `exportCompleteXLSX` sia a `backupUtils.js`. `targa` era già presente in `exportCompleteXLSX` ma mancava in `backupUtils.js`: aggiunto anche lì.
* `files[]`/`distinta` non venivano esportati in `exportCompleteXLSX` (assenti dalle colonne) e in `backupUtils.js` finivano nel fallback generico `JSON.stringify` (illeggibile, anche se non letteralmente `[object Object]`). Entrambi ora esportano solo i nomi file (`fileNames()` helper), non l'oggetto intero.
* **Campi Admin esportati anche da non-admin**: `exportCompleteXLSX` non aveva alcun controllo `isAdmin` — il bottone "Excel" nell'header è visibile a **tutti** gli utenti non-omologatore (operativo, non_operativo compresi), quindi qualunque utente poteva scaricare dealer/prezzi Ford. Corretto: `exportCompleteXLSX(vehicles, isAdmin)` ora filtra le colonne Admin se `isAdmin` è `false`. `BackupExport.jsx` aveva lo stesso problema in teoria (nessun controllo nella funzione di export), anche se in pratica la pagina "Backup Locale" non è mai raggiungibile da un non-admin tramite la UI (tab nascosta, nessun guard esplicito a runtime nel render in `App.jsx`); corretto comunque per coerenza/difesa in profondità, aggiungendo sia il filtro campi in `backupUtils.js` sia un guard `isAdmin` esplicito al render in `App.jsx` (prima il componente si montava solo in base a `currentPage === 'backup'`, senza ricontrollare il ruolo).
* **Bug**: `SHEET_HEADERS.parkingSpots` in `backupUtils.js` referenziava campi (`spotId`, `targa`, `committente`) che non esistono a livello flat sul documento reale — sono rispettivamente l'id documento e due sotto-campi di `vehicleData` (snapshot denormalizzato, vedi §5). Le colonne erano quindi **sempre vuote**. Corretto `resolveField()` per risolvere i percorsi giusti; le etichette delle colonne restano invariate per non rompere i backup già salvati.
* **Campo fantasma lato export**: `SHEET_HEADERS.kits` includeva `tipoVeicolo`, un campo mai scritto da `KitModal.jsx` (stesso pattern del campo `modello` in §5) — rimosso. Aggiunti invece `dataConsegnaMateriale` e `files`, campi reali del form kit assenti dall'export.
* Date "raw" (`createdAt`, `assignedAt`, salvate come `new Date().toISOString()`) ora formattate in `it-IT` leggibile invece di stringhe ISO con `T`/`Z`. Le date semplici tipo `dataConsegna` (`YYYY-MM-DD`) non sono state toccate: sono già un formato calendario leggibile, non un timestamp raw.

**Segnalato, non corretto automaticamente** (rischio di rompere backup/flussi esistenti):
* `exportCompleteXLSX` usa **etichette italiane** come header colonna (es. "N° Telaio", "Data Consegna"), mentre l'import CSV (`buildVehicleFromRow` in `csvUtils.js`) fa match sui **nomi tecnici dei campi** (es. `numeroTelaio`, `dataConsegna`, case-insensitive/senza spazi). Un file scaricato con "Esporta Excel" **non è quindi ri-importabile** con "Importa CSV" così com'è (gli header non matchano). Non modificato per non rischiare di alterare il percorso di import realmente usato in produzione (`buildVehicleFromRow`). **Nota (vedi "Header leggibili" sotto)**: dopo quell'aggiornamento anche `backupUtils.js` usa etichette italiane invece dei nomi tecnici, quindi questo stesso mismatch ora si applica anche al Backup Locale — accettato perché non esiste (e non esisteva già prima) una funzione di "restore da backup" nell'app: il mismatch resta latente, non attivo.

**Test manuale eseguito** (in questo ambiente, senza credenziali Firestore reali): chiamate dirette a `exportCompleteXLSX()` e `downloadXLSXBackup()` con un veicolo/dataset fittizio ma completo (tutti i campi valorizzati, incluso i 7 del Task 4), tramite pagina React temporanea in Chromium headless con download intercettato da Playwright. I file `.xlsx` generati sono stati riletti con la libreria `xlsx` (stessa famiglia SheetJS) per verificare: apertura senza errori, un solo sheet/più sheet come atteso, corrispondenza 1:1 di ogni colonna col valore atteso, assenza di `[object Object]`, colonne Admin presenti solo nell'export "admin" e assenti in quello "non-admin". Non è stato possibile ripetere il test contro un veicolo reale in Firestore per mancanza di credenziali (stessa limitazione dei task precedenti).

**Aggiornamento — Multi-fix (Ritiri/Consegne, Ricerca, Cleanup, Parcheggio, Export), vedi §12**: nuovo giro di verifica sulle stesse due funzioni di export, in seguito alla rimozione di `dataPrevistaMontaggio` (Task cleanup) e `modalitaRitiroConsentite` (Task ritiri):
* Rimossa la colonna `dataPrevistaMontaggio` da `exportCompleteXLSX` e da `SHEET_HEADERS.veicoli` in `backupUtils.js` (campo eliminato dalla scheda veicolo).
* Rimossa la colonna `modalitaRitiroConsentite` da entrambi gli export (campo/feature eliminati).
* **Trovato e corretto**: `urgente` e `cocMandato` — due campi reali della scheda veicolo, già presenti in `exportCompleteXLSX` — mancavano da `SHEET_HEADERS.veicoli` in `backupUtils.js` (bug pre-esistente, non collegato ai task di questa sessione, scoperto durante il controllo di completezza richiesto). Aggiunti alla lista headers e al ramo booleano di `resolveField()` (stesso trattamento `Sì`/`No` degli altri bool).
* **Decisione autonoma (superata, vedi aggiornamento sotto)**: le due liste di colonne (`exportCompleteXLSX` in `csvUtils.js`, `SHEET_HEADERS.veicoli` in `backupUtils.js`) restavano volutamente due hardcoded list separate invece di essere unificate in un'unica sorgente dati — le due funzioni avevano formati incompatibili per scelta pregressa (etichette italiane single-sheet vs nomi tecnici multi-sheet, vedi sopra "Segnalato, non corretto automaticamente") e unificarle avrebbe richiesto un refactor fuori scope rispetto al task. Per ridurre il rischio di un nuovo disallineamento come quello appena trovato, era stato aggiunto un commento incrociato in cima a entrambe le liste che rimandava esplicitamente all'altro file ogni volta che si toccava un campo della scheda veicolo.

**Aggiornamento — Header leggibili nel Backup Locale**: richiesta esplicita di rendere comprensibile la riga di intestazione del file XLSX scaricabile da "Backup Locale" (`BackupExport.jsx`), che esponeva ~55 colonne con i nomi tecnici dei campi (es. `clienteAvvisatoSi`, `ddtOkOkFgerace`) senza alcuna formattazione — a differenza dell'export "Excel" (`exportCompleteXLSX`), che aveva già etichette italiane e un tentativo di header in grassetto.
* **Unificazione della sorgente dati**: la lista di colonne di `exportCompleteXLSX` è stata estratta dalla funzione ed esportata come `VEHICLE_EXPORT_COLUMNS` (`src/utils/csvUtils.js`, sopra questa sezione). `SHEET_HEADERS.veicoli` in `backupUtils.js` ora la importa e ne deriva le chiavi (`VEHICLE_EXPORT_COLUMNS.map(c => c.key)`), e le etichette per l'intestazione vengono lette dallo stesso array. La "decisione autonoma" di due liste separate (bullet sopra) è quindi superata per `veicoli`: un campo aggiunto/rimosso da `VEHICLE_EXPORT_COLUMNS` si propaga automaticamente a entrambi gli export, eliminando il rischio di disallineamento documentato sopra (es. il bug `urgente`/`cocMandato` mancanti). Per allineare le chiavi tra i due file sono stati rinominati `clienteAvvisatoSi`/`clienteAvvisatoData` → `clienteAvvisato_si`/`clienteAvvisato_data` (solo lato export in `backupUtils.js`; i case in `resolveField()` sono stati aggiornati di conseguenza). Le altre collection del backup (`kits`, `actions`, `messages`, `parkingSpots` — liste corte e stabili) hanno ricevuto etichette italiane dedicate in un nuovo oggetto `FIELD_LABELS` in `backupUtils.js`, non unificate con altre fonti perché non esiste un secondo export per quei dati.
* **Formattazione titolo (rivista, vedi aggiornamento sotto)**: in questo giro era stata aggiunta una funzione `styleHeaderRow()` in `backupUtils.js` che impostava `.s = { font: { bold: true }, fill: {...} }` sulle celle e passava l'opzione di scrittura `cellStyles: true` a `XLSX.write`/`XLSX.writeFile` (stesso meccanismo già presente in `exportCompleteXLSX`), assumendo — sulla base di quel codice preesistente — che fosse sufficiente a produrre un header in grassetto con sfondo.
* **Verifica comportamentale eseguita in questo ambiente**: con la rete bloccata verso `cdn.sheetjs.com` non è stato possibile installare la dipendenza reale `xlsx`; la logica di generazione righe/etichette è stata verificata con uno stub locale (`npm run build`/esecuzione Node via `esbuild`, dati fittizi completi per tutte e 5 le collection), confermando intestazioni italiane corrette e valori riga 1:1. **Non è stato però possibile verificare la resa grafica reale dello stile** (nessun writer SheetJS reale disponibile in questo ambiente) — segnalato esplicitamente come rischio residuo.
* **File modificati**: `src/utils/csvUtils.js`, `src/utils/backupUtils.js`.

**Aggiornamento — Lo stile dell'header non veniva scritto (bug reale, confermato dall'utente in produzione)**: l'utente ha verificato che anche il bottone "Excel" in header (`exportCompleteXLSX`, non solo il Backup Locale appena corretto sopra) non produce un'intestazione in grassetto/colorata, nonostante il codice imposti `.s` e `cellStyles: true` — esattamente il rischio residuo segnalato, ma non verificabile, nell'aggiornamento precedente.
* **Causa**: la build community/free di SheetJS (il pacchetto `xlsx` installato da `cdn.sheetjs.com`, quella usata da questo progetto) **non scrive stili sulle celle** — `.s` e l'opzione `cellStyles` sono un'estensione della sola versione Pro a pagamento; in scrittura vengono scartati silenziosamente, senza errori. Il codice che imposta grassetto/sfondo in entrambi gli export (presente da prima di questa sessione per `exportCompleteXLSX`, aggiunto per analogia a `backupUtils.js` nell'aggiornamento sopra) non ha quindi mai avuto effetto reale in nessuno dei due export.
* **Fix**: sostituito il motore di **scrittura** XLSX con `exceljs` (libreria MIT, non a pagamento, con supporto nativo a font/fill/larghezza colonna), in un nuovo modulo condiviso `src/utils/xlsxWriter.js` (`addSheet()` per creare un foglio con intestazione formattata, `downloadWorkbook()` per il download browser via Blob, `workbookToUint8Array()` per la scrittura su cartella locale via File System Access API). `exportCompleteXLSX` (`csvUtils.js`) e `buildWorkbook`/`writeXLSXBackupToDirectory`/`downloadXLSXBackup` (`backupUtils.js`) ora costruiscono le righe come array di valori (non più oggetti keyed per label, per evitare collisioni se due colonne avessero lo stesso titolo) e usano questo modulo per scrivere il file. La libreria `xlsx`/SheetJS resta in uso **solo per la lettura** (`parseCSV`/`parseXLSX` in `csvUtils.js`, import CSV/XLSX), dove il limite della community edition non si applica. Le due funzioni di export diventano `async` (scrivono un buffer con `workbook.xlsx.writeBuffer()`), propagato ai chiamanti: `App.jsx` (bottone "Excel", handler reso `async`) e `BackupExport.jsx` (già dentro una funzione `async`, aggiunto `await` alle due chiamate a `downloadXLSXBackup`).
* **Dipendenza aggiunta**: `exceljs` (`^4.4.0`, da registry npm — non da CDN, quindi installabile senza le limitazioni di rete di questo ambiente). Aggiornato anche `vite.config.js` (`manualChunks.vendor-xlsx` ora include sia `xlsx` sia `exceljs`).
* **Verifica reale eseguita in questo ambiente** (non solo "logica", stavolta anche il file binario prodotto): con `xlsx` puntato temporaneamente a uno stub locale (necessario solo per `npm install`, dato che né `xlsx`@CDN né una vera installazione di verifica possono attraversare la rete bloccata di questo ambiente) ma `exceljs` installato **per davvero** dal registry npm, sia `exportCompleteXLSX()` sia `downloadXLSXBackup()` sono state eseguite in Node con un piccolo shim di `document`/`Blob`/`URL` per intercettare l'output, producendo due file `.xlsx` reali scritti su disco. Il tentativo di aprirli con LibreOffice headless per uno screenshot è fallito per un problema dell'ambiente indipendente dal file (anche un `.txt` banale non viene caricato da `soffice` in questo sandbox); in alternativa i file sono stati decompressi (un `.xlsx` è uno zip OOXML) e ispezionati direttamente: `xl/styles.xml` definisce `fontId=1` con `<b/>` (grassetto) e `fillId=2` con `fgColor rgb="FFBDD7EE"` (stesso azzurro di prima), e **ogni cella della riga 1, su tutti e 5 i fogli del backup**, referenzia quello stile (`s="1"`) — markup OOXML valido e conforme, che Excel/LibreOffice/Google Sheets renderizzano come intestazione in grassetto su sfondo azzurro. Verificate anche le larghezze colonna personalizzate (`<cols>` con `customWidth="1"`) in base alla lunghezza del titolo. Il pacchetto `xlsx` è stato poi ripristinato al vero URL CDN in `package.json`, e `package-lock.json` aggiornato includendo la sola sotto-albero di `exceljs` (risolto per davvero dal registry npm) senza toccare la voce preesistente di `xlsx` (che nel lockfile committato risultava già puntare a `xlsx@0.18.5` da `registry.npmjs.org`, disallineata dalla versione dichiarata in `package.json` — disallineamento preesistente a questa sessione, non introdotto né corretto qui, fuori scope).
* **File modificati**: `src/utils/xlsxWriter.js` (nuovo), `src/utils/csvUtils.js`, `src/utils/backupUtils.js`, `src/App.jsx`, `src/components/BackupExport.jsx`, `vite.config.js`, `package.json`, `package-lock.json`.

**Aggiornamento — Secondo foglio "Materiale LDK a Stock" nell'export "Excel"**: richiesta di aggiungere, nello stesso file XLSX del bottone "Excel" in header (`exportCompleteXLSX`), un secondo foglio con tutto il materiale LDK a stock (collection Firestore `kits` — la stessa dietro la pagina/voce di menu "Materiale LDK a Stock", `KitsPage.jsx`; vedi anche §5 "Export XLSX"), leggibile e "sempre aggiornato" come il foglio veicoli.
* **Nuova sorgente colonne condivisa**: `KIT_EXPORT_COLUMNS` in `csvUtils.js` (accanto a `VEHICLE_EXPORT_COLUMNS`, stesso pattern) — `cliente`→"Cliente", `numeroMatricolaLiderkit`→"N° Matricola Liderkit", `dimensioniKit`→"Dimensioni Kit", `dataConsegnaMateriale`→"Data Consegna Materiale", `specifiche`→"Specifiche", `files`→"File Allegati" (nomi file soli, non l'oggetto). `SHEET_HEADERS.kits`/`FIELD_LABELS.kits` in `backupUtils.js` ora derivano da questa stessa lista invece di duplicarla (stesso principio già applicato a `veicoli`), quindi il foglio kit del Backup Locale e quello nuovo di `exportCompleteXLSX` restano automaticamente allineati.
* **`exportCompleteXLSX(vehicles, isAdmin, db)`**: nuovo terzo parametro opzionale `db` (istanza Firestore). Se presente, dopo aver scritto il foglio "Veicoli" legge **live** (`getDocs(collection(db, 'kits'))`, non una cache) tutta la collection `kits` e aggiunge un secondo foglio "Materiale LDK a Stock" con `addSheet()` (stessa formattazione titolo del foglio veicoli: grassetto, sfondo, larghezza colonna). Il foglio viene sempre creato quando `db` è passato, anche a magazzino vuoto (solo intestazione), per coerenza di struttura del file. Aggiornato l'unico chiamante (`App.jsx`, bottone "Excel" in header) per passare `db` (già importato lì da `./firebase`).
* **Coerenza terminologica**: rinominato anche il nome del foglio kit nel Backup Locale da "Kit Scattobox" a "Materiale LDK a Stock" (`COLLECTION_LABELS.kits` in `backupUtils.js`) — stesso nome usato ora in entrambi gli export e nella UI (`KitsPage.jsx`), invece di due etichette diverse per lo stesso dato. Questo cambia anche il testo del checkbox "Dati da Includere" nella UI di `BackupExport.jsx` (che legge `COLLECTION_LABELS`), non solo il nome del foglio nel file.
* **Verifica comportamentale**: eseguito `exportCompleteXLSX()` in Node (bundle `esbuild`, con un modulo fittizio al posto di `firebase/firestore` che restituisce 2 kit finti per `getDocs(collection(db,'kits'))`) e ispezionato l'XLSX prodotto decomprimendolo: `xl/workbook.xml` elenca due fogli, `"Veicoli"` e `"Materiale LDK a Stock"`; il secondo ha l'intestazione con lo stile grassetto+sfondo (`s="1"` su tutte le celle di riga 1, stesso stile del foglio veicoli) e le due righe dati corrispondono 1:1 ai valori attesi (incluso `files` risolto a `"scheda1.pdf"` invece dell'oggetto, e valori vuoti per `specifiche`/`files` quando assenti). Verificato separatamente anche che il foglio kit del Backup Locale (`downloadXLSXBackup`) risulti rinominato e con le stesse colonne/valori dopo l'unificazione con `KIT_EXPORT_COLUMNS`. **Non verificato**: contro un progetto Firestore reale (nessuna credenziale disponibile in questo ambiente, stessa limitazione dei task precedenti).
* **File modificati**: `src/utils/csvUtils.js`, `src/utils/backupUtils.js`, `src/App.jsx`.

---

## 6. AUTOMAZIONI / REGOLE DI BUSINESS IMPORTANTI (side-effect impliciti)

Queste sono sparse nel codice e **facili da rompere involontariamente**:

1. **Cambio status → `pronto`** (da `in-allestimento`): se `modalitaRitiro !== 'montaggio'`, auto-compila `dataMontaggio = oggi` (in `OfficinaPage.handleStatusChange` e in `useVehicleCrud.handleSaveVehicle`).
2. **Transizione `in-allestimento → pronto`**: triggera **invio email "veicolo pronto"** via `POST /api/sendVehicleReady` (richiede Firebase ID token, controlla `config/emailNotifications.enabled` e `recipients`). Duplicato in due punti: `OfficinaPage.jsx` e `useVehicleCrud.js` — entrambi chiamano la stessa API quando rilevano la transizione, quindi **attenzione a non farla scattare due volte** se si tocca uno dei due file.
3. **Cambio status → `ritirato`**: libera automaticamente il posto in `parkingSpots` (query `where('vehicleId','==', id)` + delete). **[Multi-fix, vedi §12]** Centralizzato in `releaseParkingSpotForVehicle()` (`src/utils/firebaseUtils.js`, esportato bound a `db` da `src/firebase.js`), usato da entrambi i punti client-side che possono scrivere `status: 'ritirato'`: `useVehicleCrud.handleSaveVehicle` (salvataggio scheda veicolo completa) e `PianificazioneRitiriPage.handleQuickUpdateRitiroSvolto` (quick-toggle "Ritiro/Consegna svolto" dal day-detail modal — prima non liberava il posto, bug corretto in questa sessione). Lo script cron standalone `scripts/autoCompleteMontaggiAppuntamenti.js` (Node, `firebase-admin`, runtime separato dal bundle client) mantiene una propria implementazione equivalente (`freeParkingSpot()`) perché non può importare codice scritto per l'SDK client `firebase/firestore`.
4. **Appuntamenti montaggio scaduti**: se `modalitaRitiro==='montaggio'` e `dataRitiro+oraMontaggio` è nel passato e non `ritiroSvolto`, imposta automaticamente `status:'ritirato', ritiroSvolto:true` e libera il parcheggio. **[Task 6]** Non più un `useEffect` client-side in `PianificazioneRitiriPage` (girava ad ogni render della pagina, iterando tutti i veicoli — hotspot §6.4/§10 storico): ora è `scripts/autoCompleteMontaggiAppuntamenti.js`, eseguito da cron GitHub Actions ogni 15 minuti (`.github/workflows/auto-complete-montaggi.yml`), stesso pattern di `weeklyReportCOC`/`scripts/sendWeeklyReport.js`. Le azioni automatiche vengono loggate in `actions` con `userName: 'Sistema (automatico)'` invece che con il nome dell'utente che aveva per caso la pagina aperta (comportamento precedente, corretto qui perché comunque cambiato di sede).
5. **Quick toggle "Ritiro/Consegna svolto"**: se spuntato e `status==='pronto'` → passa a `ritirato`; se spuntato via checkbox nel form principale.
6. **CSV import**: i campi Admin vengono **azzerati automaticamente** se chi importa non è `admin` (coerente con le Firestore rules che impediscono a un non-admin di creare un veicolo con questi campi valorizzati).
7. **Elimina veicolo**: cancella anche i file associati su Storage (best-effort, errori loggati ma non bloccanti).
8. **Elimina tutti i veicoli** (solo admin): batch delete a chunk di 500 sia su `veicoli` sia su `parkingSpots`.

---

## 7. INVIO EMAIL — DUE SISTEMI IN PARALLELO (uno è legacy, deprecato)

C'era una **duplicazione architetturale storica**, ora esplicitamente marcata nel codice:

* **`_deprecated/functions/`** (ex `functions/`, Firebase Cloud Functions v2, Node, `firebase-admin`): definiva `notifyVehicleReady` (trigger Firestore `onDocumentUpdated`) e `weeklyReportCOC` (`onSchedule`, ogni lunedì 08:00). Il workflow `.github/workflows/deploy-functions.yml` deploya **solo** `firestore:rules`, mai le funzioni — quindi questo codice non è più deployato/attivo (vedi commit `d5cb503: "feat: sostituisce Cloud Functions con Vercel API + GitHub Actions cron"`). Spostato in `_deprecated/functions/` con proprio `README.md`.
* **Sistema attuale**: `api/sendVehicleReady.js` (Vercel serverless, chiamata client-side dal frontend dopo il cambio status) + `.github/workflows/weekly-report.yml` (cron GitHub Actions ogni lunedì 07:00 UTC → esegue `scripts/sendWeeklyReport.js`, script Node standalone con `firebase-admin`). Entrambi i file hanno un commento in testa: `// SISTEMA EMAIL ATTIVO — modificare qui`. I template HTML letti da entrambi vivono in `api/templates/` (`vehicleReady.html`, `weeklyReport.html`) — copie live, distinte da quelle in `_deprecated/functions/templates/`.
* **Bug corretto (pulizia repo)**: quando `functions/` è stato rinominato in `_deprecated/functions/`, i path relativi in `api/sendVehicleReady.js` e `scripts/sendWeeklyReport.js` (oltre a `includeFiles` in `vercel.json`) continuavano a puntare al vecchio `functions/templates/...`, ormai inesistente — entrambe le email fallivano con `ENOENT` ad ogni invio. Corretto puntando alle copie in `api/templates/`.
* Entrambi i sistemi condividono la stessa struttura di config (`config/emailNotifications`, `config/weeklyReport`). Il template HTML del sistema legacy in `_deprecated/functions/templates/` resta lì invariato come riferimento storico, non è più letto da nessun codice attivo.

---

## 8. STATO GLOBALE CONDIVISO (Context/hook trasversali)

|Provider/Hook|File|Espone|Usato da|
|-|-|-|-|
|`AuthContext`|`src/contexts/AuthContext.jsx`|`currentUser`, `login()`, `logout()`, `loading`|quasi tutta l'app (gate di accesso)|
|`UserContext`|`src/contexts/UserContext.jsx`|`userName`, `userRole`, `isAdmin`, `isReadOnly`, `isOmologatore`|tutte le pagine per gating UI (bottoni nascosti, campi disabilitati)|
|`NotificationContext`|`src/contexts/NotificationContext.jsx`|`toast/showToast`, `notification` (per chat), `unreadMessagesCount`, `confirmDialog/showConfirm` (Promise-based, sostituisce `window.confirm`), `showNotification` (chat + Notification API browser)|tutte le pagine (toast di feedback, conferme eliminazione)|
|`useVehicles()`|`src/hooks/useVehicles.js`|`{ vehicles, loadingVehicles }` — listener realtime unico su `veicoli`|`App.jsx`, che poi lo passa via props a tutte le pagine|
|`useVehicleCrud(vehicles)`|`src/hooks/useVehicleCrud.js`|tutta la logica di scrittura + stato dei modali principali|`App.jsx`|
|`useFilteredVehicles(vehicles, statuses)`|`src/hooks/useFilteredVehicles.js`|array veicoli filtrato per status, memoizzato (`useMemo`)|OfficinaPage, RiepilogoPage, ParcheggioPage, PianificazioneRitiriPage — sostituisce i `vehicles.filter(v => v.status === ...)` ripetuti senza memoizzazione (Task 6)|
|`db`, `storage`, `logAction()`|`src/firebase.js`|istanze Firestore/Storage + logger azioni|importato direttamente (non via Context) in quasi ogni pagina che scrive dati|

**Non ci sono altri store globali.** Ogni pagina che ha bisogno di dati oltre a `vehicles` (es. `kits`, `parkingSpots`, `messages`, `actions`) apre il proprio `onSnapshot` locale — nessuna condivisione, nessuna cache tra pagine.

---

## 9. STILE E DESIGN SYSTEM

* **Tailwind CSS puro, inline**, nessun CSS Module, nessun styled-components, nessun design token custom (tailwind.config.js è il default, `theme.extend` vuoto).
* Nessuna libreria di componenti (no shadcn/Radix/MUI).
* **Modale/Dropdown**: `src/components/Common/Modal.jsx` e `src/components/Common/Dropdown.jsx` estraggono i pattern ricorrenti che prima venivano riscritti a mano in ogni file:
  * Modale: `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50` + card `bg-white rounded-lg shadow-xl`, header colorato con gradiente (`bg-gradient-to-r from-{color}-600 to-{color}-700`) o header "white" in stile VehicleModal, footer con bottoni Annulla/Conferma.
  * Dropdown/menu (es. menu impostazioni in `App.jsx`): trigger render-prop + pannello assoluto + overlay trasparente `fixed inset-0` per chiudere al click esterno, incapsulati nel componente (nessuno stato/overlay duplicato lato chiamante).
  * Migrati a `Modal.jsx`: `ConfirmModal`, `CopyDateModal`, `DeleteAllModal`, `ImportCSVModal`, `EmailNotificationsModal`, `DayDetailModal`, `VehicleModal`. **Non ancora migrati** (debito residuo): `KitModal.jsx` e i modali/popover inline in `ParcheggioPage.jsx`, `PianificazioneRitiriPage.jsx`, `CollaudiPage.jsx`, `KitsPage.jsx`.
  * `ConfirmModal.jsx` resta il pattern più riusato per conferme (via `showConfirm()` da `NotificationContext`, Promise-based), ora costruito su `Modal.jsx`.
* **Colori di stato veicolo**: centralizzati in `src/constants/vehicleStatus.js` (`VEHICLE_STATUS_CONFIG`) per l'uso in `VehicleCard.jsx`. Altri punti dell'app (`FileMonitaggiPage`, `ParcheggioPage`, `PianificazioneRitiriPage`, `UniversalSearch`, `AnalisiStatistichePage`) mantengono ancora varianti di colore leggermente diverse e non sono stati uniformati a questa costante (fuori scope rispetto alla sola card veicolo).
* **Card veicolo**: unificata in `src/components/VehicleCard.jsx` con 3 varianti (`detail`/`row`/`compact`), sostituisce le implementazioni duplicate storiche (ex `VehicleDetailCard.jsx` usata da `DayDetailModal`, ex `CompactVehicleCard` interna a `OfficinaPage`, ex blocco inline in `RiepilogoPage`).
* `Toast.jsx` è l'unico sistema di notifica non bloccante, auto-dismiss 5s, 4 varianti colore (info/success/warning/error).
* Font size globale ridotto: `html { font-size: 14px }` in `index.css` (Tailwind quindi scala tutto rem-based su questa base).

**Implicazione pratica per modifiche future**: per un nuovo modale, usare `src/components/Common/Modal.jsx`; per un nuovo dropdown/menu, usare `src/components/Common/Dropdown.jsx`; per una nuova visualizzazione di veicolo, usare `src/components/VehicleCard.jsx` (aggiungendo una variante se nessuna delle 3 esistenti è adatta, prima di duplicare ulteriormente).

---

## 10. PUNTI DI ATTENZIONE / DEBITO TECNICO DA TENERE A MENTE

* Nessun test automatico nel repo.
* Nessun router → non si può linkare/condividere una pagina specifica via URL.
* Campi Firestore "fantasma": audit chiuso (vedi §5) — 7 su 8 erano feature incomplete e sono stati aggiunti a `VehicleModal.jsx`, 1 (`modello`) era residuo legacy ed è stato rimosso. Lo script `scripts/auditVehicleFields.js` resta disponibile per una verifica quantitativa futura con credenziali reali.
* `KitModal.jsx` e alcuni modali/popover inline (`ParcheggioPage`, `PianificazioneRitiriPage`, `CollaudiPage`, `KitsPage`) non usano ancora `Modal.jsx`/`Dropdown.jsx`.
* Colori di stato veicolo non uniformati ovunque: solo `VehicleCard.jsx` usa la costante centralizzata `src/constants/vehicleStatus.js`.
* Nessuna paginazione: `useVehicles()` carica **tutta** la collection `veicoli` in un solo listener, sempre. Con crescita dati questo è il collo di bottiglia principale. **[Task 6]** Non convertito a query con `where` su range di date (§6b del task) perché non è stato possibile determinare da questo ambiente se la collection ha superato la soglia indicata (1000+ documenti o crescita chiara) — manca l'accesso a Firestore reale (stessa limitazione degli altri task). Verificare il conteggio reale prima di decidere se procedere con `firestore.indexes.json` da aggiornare di conseguenza.
* Collection `telai`: era orfana nel codice frontend (mai rimossa dalle security rules), reintegrata in §13 con una nuova pagina — non più debito tecnico.
* Export XLSX: audit chiuso (vedi §5 "Export XLSX — punti e allineamento"). Resta un mismatch strutturale non corretto (intenzionalmente, per non rompere file esistenti): le colonne di `exportCompleteXLSX` (etichette italiane) non sono compatibili con il matching header di `buildVehicleFromRow` (nomi tecnici) usato dall'import CSV — un file esportato con "Esporta Excel" non è ri-importabile così com'è.
* Virtualizzazione liste (`react-window`, §6c del task) non implementata: nessuna evidenza di lag percepibile riportata, e comunque dipende dagli stessi dati di volume non verificabili sopra. Da rivalutare se 6b viene implementato e il problema persiste.
* `KitModal.jsx` e i modali/popover inline di `CollaudiPage`/`PianificazioneRitiriPage` restano non migrati a `Modal.jsx` (vedi sopra): le nuove sezioni di assegnazione da calendario (§11) sono state aggiunte dentro gli stessi modali inline esistenti, senza migrarli, per restare aderenti allo scope del task.

---

## 11. ASSEGNAZIONE VEICOLO DA CALENDARIO (Collaudi + Ritiro)

Feature che permette di pianificare collaudo/ritiro cliccando direttamente un giorno del calendario in `CollaudiPage.jsx` e `PianificazioneRitiriPage.jsx`, invece di aprire la scheda veicolo completa.

### Nuovi stati e campi dati

* **Collaudo**: aggiunto il valore `'pianificato'` all'enum esistente di `veicoli/{id}.collaudo` (che restava invariato: `da-collaudare`|`allestimento-omologato`|`collaudo-eseguito`|`non-richiesto`). Nessuna rottura: `da-collaudare` continua a funzionare esattamente come prima.
  * **Retrocompatibilità**: prima di questa feature, un veicolo "con test pianificato" era rappresentato come `collaudo: 'da-collaudare'` + `dataCollaudo` valorizzata (l'UI non aveva un valore enum dedicato). Questi documenti pre-esistenti **non vengono migrati**: l'helper `isCollaudoPlanned()` in `src/utils/collaudoUtils.js` li riconosce comunque come "pianificati" a fini di visualizzazione/filtro, leggendo `da-collaudare` + `dataCollaudo` presente come equivalente del nuovo `pianificato`. Da qui in avanti, però, ogni nuova assegnazione (da calendario o dal quick-toggle "Ripristina" nel day-detail modal) scrive esplicitamente `collaudo: 'pianificato'`.
* **Ritiro**: aggiunto il campo `veicoli/{id}.statoRitiro` (**nuovo**, non esisteva un enum di stato dedicato prima — solo `dataRitiro`/`modalitaRitiro`/`ritiroSvolto` sparsi): valori `'da-pianificare'` (default) | `'pianificato'` | `'svolto'`.
  * **Retrocompatibilità**: il campo è **derivato, non richiesto**. `getStatoRitiro()` in `src/utils/ritiroUtils.js` lo legge se presente, altrimenti lo deriva dai campi legacy (`ritiroSvolto` → `svolto`; altrimenti `dataRitiro` presente → `pianificato`; altrimenti `da-pianificare`). **Nessuna migrazione dati necessaria**: i documenti esistenti funzionano correttamente senza backfill. Il campo viene scritto esplicitamente (per coerenza con `collaudo`) da tutti i flussi di scrittura di `PianificazioneRitiriPage.jsx` (assegnazione da calendario, modale "Assegna Ritiro/Consegna", modifica, quick-toggle "Svolto", eliminazione pianificazione).
* ~~**Modalità di ritiro consentite**: `veicoli/{id}.modalitaRitiroConsentite`...~~ **RIMOSSO nella sessione Multi-fix (vedi §12).** Questa feature (checkbox "Modalità di ritiro consentite (calendario)" in `VehicleModal.jsx` + filtro nel popup di assegnazione da calendario di `PianificazioneRitiriPage.jsx`) è stata eliminata su richiesta: le 3 modalità sono ora sempre tutte proponibili ovunque, senza restrizioni per veicolo. Il campo Firestore `modalitaRitiroConsentite` non viene più letto né scritto da nessun punto del codice; documenti pre-esistenti che lo hanno valorizzato lo mantengono inerte, senza migrazione.

### Helper centralizzati (nuovi)

* `src/utils/collaudoUtils.js`: `COLLAUDO_OPTIONS`, `isCollaudoPlanned`, `isCollaudoPending`, `isCollaudoDone`, `isCollaudoCalendarRelevant`, `getUnplannedCollaudoVehicles`, `formatCollaudoBadge` (etichetta breve per badge calendario), `formatCollaudoShort` (per `VehicleCard`), `formatCollaudoField` (etichetta estesa "Pianificato in data: DD/MM/AAAA" per la scheda veicolo). Riusati in `VehicleModal.jsx`, `VehicleCard.jsx`, `CollaudiPage.jsx`, `ParcheggioPage.jsx`.
  * `dateUtils.js` (`getVehicleStatusLabel`) duplica volutamente la sola condizione booleana `collaudo pending` invece di importare da `collaudoUtils.js`, per evitare un import circolare (`collaudoUtils.js` importa `fmtDMY` da `dateUtils.js`).
* `src/utils/ritiroUtils.js`: `RITIRO_MODALITA_LABELS`, `ALL_MODALITA_RITIRO`, `getStatoRitiro`, `isRitiroPianificato`, `getUnplannedPickupVehicles`, `formatRitiroField` (etichetta estesa, stesso formato di `formatCollaudoField`: "Pianificato in data: DD/MM/AAAA — Modalità: X"). Riusati in `VehicleModal.jsx`, `PianificazioneRitiriPage.jsx`. `getModalitaRitiroConsentite` **rimosso nella sessione Multi-fix** (vedi §12): le 3 modalità sono ora sempre tutte ammesse, nessuna restrizione da leggere per veicolo.
* Nota: `RiepilogoPage.jsx`/`AnalisiStatistichePage.jsx` **non leggono** i campi collaudo/ritiro (solo `status`), quindi non richiedono modifiche — verificato prima di procedere (il task li citava come possibili consumer, ma non lo sono). `KitsPage.jsx` (conversione Kit→Veicolo) resta invariato: non imposta `statoRitiro`/`modalitaRitiroConsentite`, che restano ai default derivati/impliciti — comportamento corretto e non richiede modifiche.

### Nuovo componente UI condiviso

* `src/components/Common/VehiclePickerList.jsx`: lista veicoli con ricerca (search + `<select size>`), estratta dal markup che prima era duplicato inline nel modale "Assegna Ritiro/Consegna" di `PianificazioneRitiriPage.jsx`. Riusata in 3 punti: quel modale (refactor, nessun cambio di comportamento), la nuova sezione di assegnazione da calendario di `CollaudiPage.jsx`, e la nuova sezione di assegnazione da calendario di `PianificazioneRitiriPage.jsx`.

### Comportamento calendario

* **Collaudi** (`CollaudiPage.jsx`): click su un giorno (vuoto o pieno) apre sempre il day-detail modal esistente. Se non `isReadOnly`, il modal include in coda una sezione "Assegna un veicolo a questo giorno" con `VehiclePickerList` sul pool `getUnplannedCollaudoVehicles()` (veicoli `da-collaudare` senza `dataCollaudo`). Alla conferma, scrive `collaudo: 'pianificato'` + `dataCollaudo` sul documento veicolo tramite `runTransaction`. Aggiunto un terzo contatore "Pianificati" nell'header (prima solo "Da Collaudare"/"Completati") per riflettere il nuovo stato intermedio.
* **Pianificazione Ritiri** (`PianificazioneRitiriPage.jsx`): stesso pattern nel day-detail modal esistente, sezione "Assegna un veicolo pronto a questo giorno" sul pool `getUnplannedPickupVehicles()` (veicoli `status: 'pronto'` senza `dataRitiro`), con selezione modalità tra tutte e 3 quelle di `ALL_MODALITA_RITIRO` (nessuna restrizione per veicolo, vedi §12). Alla conferma, scrive `dataRitiro` + `modalitaRitiro` + `statoRitiro: 'pianificato'` tramite `runTransaction`.
* **Badge/contatore multi-veicolo per giorno**: riusato il pattern preesistente in entrambe le pagine (nessun elemento estetico nuovo) — vista desktop: primi 2 veicoli + badge "+N altri"; vista mobile: badge numerico col conteggio totale; click sul giorno apre il day-detail modal con la lista completa senza limite. Nessuna deformazione di layout con N veicoli, verificato che il pattern preesistente già scalasse correttamente.
* **Concorrenza**: entrambe le assegnazioni usano `runTransaction` (Firestore) che rilegge il documento e verifica che il veicolo sia ancora nel pool assegnabile (`collaudo === 'da-collaudare' && !dataCollaudo` per i collaudi; `status === 'pronto' && !dataRitiro` per i ritiri) prima di scrivere. Se un altro utente ha già assegnato lo stesso veicolo nel frattempo, la transazione fallisce e l'utente riceve un toast di errore invece di sovrascrivere silenziosamente.
* **Decisione autonoma — calendario mobile**: rimossa la restrizione preesistente che su mobile nascondeva i giorni senza veicoli assegnati (tranne "oggi"), in entrambe le pagine, per permettere di aprire il day-detail modal (e quindi assegnare) anche su un giorno vuoto da mobile. Prima della feature, su mobile non era comunque possibile assegnare/vedere un giorno vuoto, quindi questo non è un cambiamento di comportamento su una funzionalità esistente, ma l'abilitazione minima necessaria per rendere la nuova funzionalità utilizzabile da mobile.

### Sicurezza (Firestore rules)

Nessuna modifica a `firestore.rules` necessaria e nessun problema di sicurezza introdotto: i nuovi campi (`collaudo: 'pianificato'`, `statoRitiro`) sono campi non-admin, e le rules attuali non impongono whitelist per singolo campo su `veicoli` al di fuori di `adminFields()` — qualunque utente `canWrite()` (operativo/admin) poteva già scrivere liberamente tutti i campi non-admin del documento, quindi il nuovo modello dati rientra nello stesso perimetro di fiducia già esistente (non è una feature che richiede un cambiamento del modello di autorizzazione).

### Non regressione verificata

* `ParcheggioPage.jsx` (badge stato "pronto ma da collaudare") e `dateUtils.getVehicleStatusLabel` aggiornati per trattare `collaudo === 'pianificato'` come ancora "da collaudare" (prima controllavano solo `'da-collaudare'`), altrimenti un veicolo pianificato da calendario avrebbe perso il badge di attenzione.
* `VehicleCard.jsx` (varianti `compact`/`detail`) aggiornato per usare gli helper centralizzati invece del confronto diretto `collaudo === 'da-collaudare'`.
* `exportCompleteXLSX` (`csvUtils.js`) e il backup multi-sheet (`backupUtils.js`) aggiornati per includere la nuova colonna `statoRitiro` (colonna `modalitaRitiroConsentite`, aggiunta in questo passaggio, rimossa poi nella sessione Multi-fix insieme al campo — vedi §12).
* Build (`npm run build`) e lint (`npm run lint`) eseguiti dopo ogni modifica: nessun nuovo errore introdotto (gli errori/warning presenti in output sono tutti preesistenti, in file non toccati da questa feature).
* **Non verificato in questo ambiente** (stessa limitazione riportata per i task precedenti in questo file): nessun test end-to-end contro un progetto Firestore reale, per mancanza di credenziali di servizio/`.env` valorizzato in questo ambiente di lavoro.

---

## 12. MULTI-FIX — Ritiri/Consegne, Ricerca, Cleanup, Parcheggio, Export

Sessione di correzioni indipendenti su 5 punti dell'app, tutte verificate nel codice reale prima di intervenire (come richiesto dal task).

### Task 1 — Semplificazione "Modalità di ritiro consentite"

* Rimosso il blocco checkbox "Modalità di ritiro consentite (calendario)" dal tab "Ritiri & Consegne" di `VehicleModal.jsx`. Resta solo la selezione radio "Modalità" per l'assegnazione effettiva.
* Rimosso il filtro nel popup di assegnazione da calendario di `PianificazioneRitiriPage.jsx`: ora propone sempre tutte e 3 le modalità (`ALL_MODALITA_RITIRO`), invece di limitarsi a `getModalitaRitiroConsentite(veicolo)`.
* `getModalitaRitiroConsentite()` rimossa da `src/utils/ritiroUtils.js` (helper morto, nessun altro consumer). `ALL_MODALITA_RITIRO` e `RITIRO_MODALITA_LABELS` restano, riusati per popolare le opzioni sempre-tutte.
* Il campo Firestore `modalitaRitiroConsentite` non viene più letto né scritto da nessun punto del codice. **Nessuna migrazione**: documenti pre-esistenti che lo hanno valorizzato lo mantengono, semplicemente ignorato.
* Rimosso anche dalle colonne export (`exportCompleteXLSX`, `backupUtils.js` — vedi Task 5 sotto).
* **File modificati**: `src/components/modals/VehicleModal.jsx`, `src/pages/PianificazioneRitiriPage.jsx`, `src/utils/ritiroUtils.js`, `src/utils/csvUtils.js`, `src/utils/backupUtils.js`.

### Task 2 — Ricerca veicolo full-field centralizzata

* **Prima**: 8 punti diversi dell'app (barra ricerca header, 6 pagine con ricerca locale, `VehiclePickerList`) avevano ciascuno una propria lista hardcoded di campi su cui fare match (`v.committente?.toLowerCase().includes(...) || v.targa?... || ...`), tutte diverse tra loro e nessuna davvero completa — es. `VehiclePickerList` cercava solo su 3 campi (telaio/matricola/committente), `OfficinaPage` su un sottoinsieme diverso da `RiepilogoPage`, ecc.
* **Ora**: helper unico `src/utils/searchUtils.js`, funzione `searchVehicle(vehicle, term)` (match booleano) e `filterVehiclesBySearch(vehicles, term)` (filtro array). Fa match case-insensitive/partial su **qualsiasi campo compilato** del documento veicolo: itera dinamicamente su tutte le chiavi dell'oggetto (esclude solo `id`, il doc id Firestore), scendendo nei valori annidati (es. `clienteAvvisato.data`) e nei nomi file di `files[]`/`distinta` fino a 2 livelli di profondità. Non serve più aggiornare N liste hardcoded quando si aggiunge un campo alla scheda veicolo: il nuovo campo è automaticamente cercabile.
* **Riusato in**: `UniversalSearch.jsx` (ricerca header), `VehiclePickerList.jsx` (popup Collaudi/Pianificazione Ritiri), `OfficinaPage.jsx`, `RiepilogoPage.jsx`, `FileMonitaggiPage.jsx`, `PianificazioneRitiriPage.jsx` (ricerca header pagina + filtro veicoli del giorno), `CollaudiPage.jsx`, `ParcheggioPage.jsx` (import con alias `vehicleMatchesSearch` perché la pagina già usa `searchVehicle` come nome di stato locale per il termine digitato). `KitsPage.jsx` non toccata: cerca sui `kits`, un'entità distinta dai veicoli, fuori scope del task.
* La vecchia `searchVehicle()` in `src/utils/validationUtils.js` (lista fissa di ~20 campi, non includeva ad es. `posizioneParcheggio`, `codiceInventario`, `cocFase1`, `ritiroGiorno`, i campi Admin non-dealer) è stata rimossa: unico consumer era `UniversalSearch.jsx`, migrato al nuovo helper.
* **Performance (valutata come richiesto dal task)**: la ricerca resta interamente client-side sui `vehicles` già caricati dal listener realtime unico di `useVehicles()` — nessuna query Firestore aggiuntiva per carattere digitato, né prima né dopo questa modifica. Per evitare di ricalcolare la scansione full-field di ogni veicolo ad ogni carattere digitato, il testo di ricerca di ciascun veicolo viene precalcolato una volta sola e tenuto in cache (`WeakMap` chiave = oggetto veicolo): i keystroke successivi sullo stesso set di `vehicles` (cioè finché non arriva un nuovo snapshot Firestore) fanno solo un `String.includes()` sul testo già concatenato, non una nuova scansione di tutte le chiavi dell'oggetto.
* **File modificati**: nuovo `src/utils/searchUtils.js`; modificati `src/utils/validationUtils.js`, `src/components/Common/UniversalSearch.jsx`, `src/components/Common/VehiclePickerList.jsx`, `src/pages/OfficinaPage.jsx`, `src/pages/RiepilogoPage.jsx`, `src/pages/FileMonitaggiPage.jsx`, `src/pages/PianificazioneRitiriPage.jsx`, `src/pages/CollaudiPage.jsx`, `src/pages/ParcheggioPage.jsx`.

### Task 3 — Rimozione campo "Data Prevista Montaggio"

* Rimosso l'input "Data Prevista Montaggio" dal tab Allestimento di `VehicleModal.jsx` e il relativo default nello stato iniziale del form.
* Rimosso dai default di `buildVehicleFromRow` (import CSV) in `csvUtils.js` e dai default della conversione Kit → Veicolo in `KitsPage.jsx`.
* Rimosso dalle colonne di entrambi gli export (`exportCompleteXLSX`, `backupUtils.js`).
* Nessun riferimento residuo trovato in filtri o in `AnalisiStatistichePage.jsx` (verificato con ricerca full-repo prima di intervenire, come richiesto).
* **Nessuna migrazione**: il campo resta silenziosamente presente e ignorato sui documenti Firestore pre-esistenti che lo avevano valorizzato.
* **File modificati**: `src/components/modals/VehicleModal.jsx`, `src/utils/csvUtils.js`, `src/utils/backupUtils.js`, `src/pages/KitsPage.jsx`.

### Task 4 — Liberazione posizione parcheggio al ritiro

* **Gap trovato**: la liberazione automatica del posto in `parkingSpots` quando un veicolo passa a `ritirato` esisteva già in `useVehicleCrud.handleSaveVehicle` (salvataggio scheda veicolo completa), ma **non** nel quick-toggle "Ritiro/Consegna svolto" del day-detail modal di `PianificazioneRitiriPage.jsx` (`handleQuickUpdateRitiroSvolto`), che scrive `status: 'ritirato'` direttamente su Firestore bypassando `useVehicleCrud`. Un veicolo segnato "svolto" da quel toggle restava quindi occupante di un posto parcheggio che in realtà si era liberato.
* **Fix**: estratta la logica di query+delete su `parkingSpots` in un helper unico condiviso, `releaseParkingSpotForVehicle(vehicleId)`, esportato da `src/firebase.js` (bound a `db`, implementazione in `src/utils/firebaseUtils.js`). Usato ora da entrambi i punti di scrittura client-side che possono impostare `status: 'ritirato'`: `useVehicleCrud.handleSaveVehicle` e `PianificazioneRitiriPage.handleQuickUpdateRitiroSvolto` (quest'ultimo logga anche l'azione "Parcheggio liberato automaticamente", stesso messaggio già usato dall'altro punto).
* Lo script cron standalone `scripts/autoCompleteMontaggiAppuntamenti.js` (Node, `firebase-admin`) **non** è stato toccato: gira in un runtime diverso (SDK admin, non SDK client `firebase/firestore` usato nel bundle browser) e ha già una propria implementazione equivalente (`freeParkingSpot()`) — non è possibile né sensato condividere letteralmente la funzione tra i due runtime.
* `ParcheggioPage.jsx` legge `parkingSpots` con un listener realtime (`onSnapshot`) locale: la liberazione del posto si riflette quindi immediatamente nella vista Parcheggio, senza refresh manuale, per costruzione — nessuna modifica necessaria lì.
* **File modificati**: `src/utils/firebaseUtils.js` (nuovo `releaseParkingSpotForVehicle`), `src/firebase.js` (export bound), `src/hooks/useVehicleCrud.js` (usa l'helper al posto della query/delete inline), `src/pages/PianificazioneRitiriPage.jsx` (chiama l'helper nel quick-toggle).

### Task 5 — Verifica export Excel

* Verificati i due percorsi di export "veicoli" (`exportCompleteXLSX` in `csvUtils.js`, `SHEET_HEADERS.veicoli` in `backupUtils.js`) contro lo schema completo della scheda veicolo (§5): entrambi risultavano già sostanzialmente allineati da un audit di una sessione precedente (vedi "Export XLSX — punti e allineamento (Task 5)" sopra).
* Rimosse le colonne obsolete `dataPrevistaMontaggio` e `modalitaRitiroConsentite` da entrambi gli export (conseguenza dei Task 1/3 sopra).
* **Bug trovato e corretto, indipendente dai task di questa sessione**: `urgente` e `cocMandato` — campi reali della scheda veicolo, già esportati da `exportCompleteXLSX` — mancavano dalla lista colonne di `backupUtils.js` (Backup Locale). Aggiunti sia alle colonne sia al ramo di `resolveField()` che formatta i booleani come "Sì"/"No".
* **Centralizzazione valutata**: le due liste restano due array hardcoded separati (decisione presa, non un refactor omesso per mancanza di tempo) perché i due export hanno formati intenzionalmente diversi e incompatibili tra loro da una decisione pregressa già documentata (label italiane single-sheet vs nomi tecnici multi-sheet — vedi sopra "Segnalato, non corretto automaticamente"): unificarle in un'unica sorgente dati avrebbe richiesto toccare quel formato, fuori scope per questo task. Per mitigare il rischio di un nuovo disallineamento come quello appena trovato, è stato aggiunto in cima a entrambe le liste un commento che rimanda esplicitamente all'altro file.
* **File modificati**: `src/utils/csvUtils.js`, `src/utils/backupUtils.js`.

### Verifica e non-regressione

* `npm run lint`: nessun nuovo errore/warning introdotto dai file toccati in questa sessione (confrontato l'output prima/dopo le modifiche via `git stash`). Gli errori pre-esistenti riportati da lint (in `_deprecated/functions/`, `api/`, `scripts/`, ecc. — mancanza di `env: node` nella config ESLint per quei file — e alcuni `no-unused-vars`/`react-hooks/exhaustive-deps` sparsi) non sono stati toccati, fuori scope.
* `npm run build`: la dipendenza `xlsx` è scaricata da `cdn.sheetjs.com` (non dal registry npm), host non raggiungibile dalla policy di rete di questo ambiente di lavoro (stessa classe di limitazione già incontrata nei task precedenti per l'assenza di credenziali Firestore). Per verificare comunque che l'intero grafo dei moduli JS/JSX si risolva e transpili correttamente con tutte le modifiche di questa sessione, è stato usato temporaneamente uno stub locale del modulo `xlsx` via alias Vite (poi rimosso, nessuna modifica permanente a `vite.config.js`/`package.json`): build completata con successo su tutti i 1742 moduli, nessun errore di risoluzione import.
* Verificato che nessun'altra pagina/componente referenzi ancora `modalitaRitiroConsentite`, `dataPrevistaMontaggio` o la vecchia `searchVehicle` di `validationUtils.js` (ricerca full-repo).
* **Non verificato in questo ambiente** (stessa limitazione dei task precedenti): nessun test end-to-end contro un progetto Firestore reale, per mancanza di credenziali di servizio.

### Sicurezza — nessun problema rilevato

* Nessuna modifica a `firestore.rules` necessaria per nessuno dei 5 task: si tratta di rimozione UI/campi non-admin (Task 1, 3), refactor client-side puro senza nuove scritture (Task 2), un nuovo delete su `parkingSpots` che replica esattamente un pattern di scrittura già autorizzato per lo stesso ruolo (Task 4), e sola lettura per l'export (Task 5).
* L'unico problema di sicurezza export-correlato individuato (campi Admin scaricabili da utenti non-admin via bottone "Excel") era già stato trovato e corretto in una sessione precedente (vedi sopra); non ne sono stati trovati di nuovi in questa sessione.

---

## 13. REINTEGRAZIONE — Telai in Attesa di Ordine

Richiesta di reintrodurre una pagina rimossa in passato: gestione dei numeri di telaio noti prima dell'arrivo del relativo ordine SAP, con conversione in scheda veicolo.

### Cosa si sapeva della versione originale

Il codice sorgente della pagina originale (`TelaiInAttesaPage.jsx` + `TelaiModal.jsx`) **non è recuperabile**: il commit che l'ha rimossa (`1d93810`) non è presente nella cronologia di questo repository (verificato con `git log --all`/`git cat-file` — l'hash non risolve a nessun oggetto). L'unica traccia è una menzione secondaria in `docs/linkedin-roadmap.md` (bozza di post per un blog aziendale, non documentazione tecnica), che descrive il commit di rimozione come:

* pagina + modale dedicati, con una rotta lazy in `App.jsx` e una voce nell'array di navigazione;
* un percorso `handleConvertToVehicle` per trasformare il record in una scheda veicolo;
* tre punti in `backupUtils.js` (`BACKUP_COLLECTIONS`, `SHEET_HEADERS`, `COLLECTION_LABELS`) rimossi insieme al resto.

La collection `telai` in `firestore.rules` **non era mai stata rimossa** (rules identiche da sempre: read per tutti gli autenticati, write per operativi/admin, nessun vincolo di campo) — la rimozione era stata solo lato frontend.

### Decisione di ricostruzione

In assenza del codice originale, la pagina è stata ricostruita seguendo **lo stesso pattern già in produzione per un caso concettualmente identico**: `KitsPage.jsx` ("Materiale LDK a Stock"), che gestisce anch'essa una collection "di attesa" separata da `veicoli` con conversione 1-click in scheda veicolo (`ConvertToVehicleModal`, `handleConverted`, checkbox "rimuovi dopo la creazione"). Riusare quel pattern, invece di inventarne uno nuovo, mantiene l'app coerente con se stessa e riduce il rischio di introdurre una seconda convenzione UI per lo stesso tipo di flusso.

**Campi del documento `telai/{id}`** (decisi con l'utente, non ricostruiti): `numeroTelaio*` (obbligatorio), `committente`, `dataArrivoVeicolo` (default: data odierna — rinominato da `dataInserimento` su richiesta esplicita: rappresenta la data di arrivo del veicolo, non una generica data di inserimento del record), `chiaviDoppioParcheggio`, `note`. Nessun upload file (a differenza di `kits`, che li supporta) — non richiesto.

### Implementazione

* **Nuovo file**: `src/pages/TelaiPage.jsx` — pagina CRUD + ricerca locale (stesso impianto di `KitsPage.jsx`), con due componenti interni: `TelaioModal` (aggiungi/modifica record) e `ConvertToVehicleModal` (crea veicolo da telaio, con gli stessi campi obbligatori Committente/Data Consegna/Tipo Allestimento della conversione Kit → Veicolo).
* **`App.jsx`**: nuovo lazy import `TelaiPage`, nuova voce `{ id: 'telai', label: 'Telai in Attesa di Ordine', icon: Hash }` in `allPages` (posizionata accanto a "Materiale LDK a Stock", per richiesta esplicita — le due pagine condividono lo stesso pattern), nuovo blocco di render `currentPage === 'telai'`. Nessuna modifica al filtro ruoli: l'omologatore resta escluso per costruzione (whitelist esplicita già esistente), stesso comportamento di `kits`.
* **`backupUtils.js`**: aggiunta `telai` a `BACKUP_COLLECTIONS`, `SHEET_HEADERS`, `FIELD_LABELS`, `COLLECTION_LABELS` — il checkbox "Dati da Includere" di `BackupExport.jsx` la include automaticamente perché deriva da `Object.keys(COLLECTION_LABELS)`, nessuna modifica necessaria lì.
* **Ricerca**: nessuna modifica necessaria a `searchUtils.js` — quella ricerca centralizzata indicizza solo `vehicles` (i telai in attesa non sono veicoli); la pagina ha una propria ricerca locale sui suoi 3 campi testuali, stesso pattern di `KitsPage.jsx`.
* **`firestore.rules`**: nessuna modifica — le regole per `telai` erano già presenti e corrette.

### Refinement — mapping esplicito sui campi veicolo e cancellazione obbligatoria

Su richiesta successiva, la conversione Telaio → Veicolo è stata resa più esplicita e senza opzioni intermedie:

* `dataInserimento` → **rinominato `dataArrivoVeicolo`** (label "Data Arrivo Veicolo") in tutta la pagina (`TelaioModal`, lista, ricerca, query `orderBy`) e nel backup (`backupUtils.js`). In conversione, mappato su `dataArrivo` del veicolo (comportamento già presente, solo il nome campo è cambiato).
* Aggiunto il campo **`chiaviDoppioParcheggio`** ("Chiavi Parcheggio", stessa label già usata in `VehicleModal.jsx`) al documento `telai` — non esisteva prima. In conversione si riporta identico sul campo omonimo del veicolo (in precedenza il veicolo nasceva sempre con questo campo vuoto).
* `numeroTelaio` e `note` già si riportavano identici sul veicolo creato (nessun cambiamento necessario); `committente` era ed è precompilato nel modale di conversione ma resta un campo modificabile (richiesto per gestire il caso in cui il committente cambi tra l'inserimento del telaio e l'arrivo dell'ordine).
* **Rimossa la checkbox "Rimuovi dall'elenco dopo la creazione"** (in `ConvertToVehicleModal`, era presente-di-default in analogia a `KitsPage.jsx`): la cancellazione del doc `telai` di origine è ora **sempre** eseguita subito dopo la creazione del veicolo, senza possibilità di lasciarlo in elenco — un telaio "trasformato" non ha più ragione di comparire tra quelli "in attesa". Questo comportamento diverge intenzionalmente da `KitsPage.jsx` (dove il materiale può restare a stock anche dopo la conversione, caso d'uso diverso: un kit può essere condiviso/riordinato, un telaio in attesa no).

### Verifica

* `npm run build`: `node_modules` non presente in questo ambiente (nessuna cronologia di installazione salvata) e il pacchetto `xlsx` non scaricabile dal registry configurato (stessa limitazione di rete già incontrata in sessioni precedenti, vedi §12 Task 5). Installate temporaneamente tutte le altre dipendenze (`xlsx` escluso da `package.json`, poi ripristinato) e stubbato `xlsx` in `node_modules` per permettere la risoluzione dei moduli — stesso approccio già documentato in §12. Build completata con successo (1749 moduli, `TelaiPage` compilata come chunk lazy separato), `package.json`/`package-lock.json` ripristinati invariati subito dopo.
* `npm run lint`: un solo warning su `TelaiPage.jsx` (`react-hooks/exhaustive-deps` sulla dependency `showToast` dell'`useEffect` del listener) — stesso identico warning preesistente su `KitsPage.jsx` da cui il pattern è stato copiato, non un problema nuovo.
* **Non verificato in questo ambiente** (stessa limitazione dei task precedenti): nessun test end-to-end contro un progetto Firestore reale.
