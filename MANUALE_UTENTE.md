# SSV Manager — Manuale Utente

**Gestione Veicoli, Officina e Pianificazione**
Versione 1.1 — Uso interno Scattolini

---

## Indice

1. [Accesso all'applicazione](#1-accesso-allapplicazione)
2. [Panoramica generale](#2-panoramica-generale)
3. [Ruoli utente](#3-ruoli-utente)
4. [Gestire i veicoli](#4-gestire-i-veicoli)
5. [Officina](#5-officina)
6. [File Montaggi (Calendario)](#6-file-montaggi-calendario)
7. [Pianificazione Ritiri](#7-pianificazione-ritiri)
8. [Collaudi](#8-collaudi)
9. [Riepilogo](#9-riepilogo)
10. [Chat e Azioni](#10-chat-e-azioni)
11. [Parcheggio](#11-parcheggio)
12. [Telai in Attesa di Ordine](#12-telai-in-attesa-di-ordine)
13. [Materiale LDK a Stock](#13-materiale-ldk-a-stock)
14. [Analisi](#14-analisi)
15. [Backup Locale (solo Admin)](#15-backup-locale-solo-amministratori)
16. [Importazione massiva da file](#16-importazione-massiva-da-file)
17. [Domande frequenti](#17-domande-frequenti)

---

## 1. Accesso all'applicazione

### Come effettuare il login

1. Apri il browser e vai all'indirizzo dell'applicazione.
2. Inserisci la tua **email** e la tua **password**.
3. Clicca su **"Accedi"**.

> **Attenzione:** Se dimentichi la password, contatta l'amministratore di sistema. Non è possibile reimpostarla autonomamente dall'applicazione.

### Come effettuare il logout

- Clicca sul pulsante **"Esci"** in alto a destra nella barra di navigazione.
- Su smartphone, il pulsante si trova nel menu laterale (icona a tre linee in alto a destra).

---

## 2. Panoramica generale

Dopo il login, vedrai la schermata principale con la barra di navigazione in alto.

### Le sezioni principali

| Sezione | A cosa serve |
|---|---|
| **Officina** | Visualizza e gestisce i veicoli in lavorazione |
| **File Montaggi** | Calendario con le date di consegna pianificate |
| **Pianificazione Ritiri** | Organizza ritiri e consegne dei veicoli pronti |
| **Collaudi** | Calendario e gestione dei collaudi/omologazioni |
| **Riepilogo** | Panoramica di tutti i veicoli per stato |
| **Chat e Azioni** | Messaggi interni e registro delle operazioni |
| **Parcheggio** | Mappa visiva del parcheggio P2 |
| **Telai in Attesa di Ordine** | Numeri di telaio noti prima dell'arrivo dell'ordine SAP |
| **Materiale LDK a Stock** | Gestione kit e materiali in magazzino |
| **Analisi** | Statistiche e report sull'attività |
| **Backup Locale** | Esportazione dati (solo amministratori) |

### La barra di ricerca

In cima alla pagina (su desktop) trovi una barra di ricerca universale. Digita il nome del committente, il numero di telaio o qualsiasi altra informazione: l'applicazione mostrerà i veicoli corrispondenti in tempo reale.

### Esportare la situazione completa in Excel

Accanto alla barra di ricerca trovi il pulsante **"Excel"**: scarica un unico file con due fogli:

- **Veicoli** — tutti i veicoli con tutte le colonne della scheda.
- **Materiale LDK a Stock** — tutto il materiale attualmente a magazzino.

> **Nota:** non visibile agli utenti con ruolo Omologatore.

### Notifiche

- Il tab **"Chat e Azioni"** mostra un numero rosso se ci sono messaggi non letti.
- Quando arriva un nuovo messaggio, compare una notifica in basso.

---

## 3. Ruoli utente

L'applicazione prevede diversi livelli di accesso.

### Operativo (utente standard)

- Può **creare, modificare ed eliminare** veicoli.
- Accede a tutte le sezioni.
- Può importare veicoli da file.
- Può inviare messaggi in Chat.

### Amministratore

- Ha tutti i permessi dell'Operativo.
- Vede i **campi riservati Ford** (nella scheda veicolo).
- Può eliminare tutti i veicoli contemporaneamente.
- Accede alla sezione **Backup Locale** e alle impostazioni (notifiche email).

### Non Operativo

- Accesso in **sola lettura** a tutte le sezioni (tranne Backup Locale).
- Non può creare, modificare o eliminare nulla, né importare veicoli.
- Può leggere la Chat ma non inviare messaggi.

### Omologatore

- Accesso in **sola lettura**, limitato a sole 3 sezioni: **Riepilogo**, **File Montaggi** e **Collaudi**.
- Non può modificare nulla.
- Non vede né accede alle altre sezioni (Officina, Pianificazione Ritiri, Chat, Parcheggio, Telai in Attesa di Ordine, Materiale LDK, Analisi, Backup Locale).
- Al login viene indirizzato automaticamente al Riepilogo.

> **Nota:** Il proprio ruolo è visibile accanto al nome utente in alto a destra (badge "Omologatore" per questo ruolo).

---

## 4. Gestire i veicoli

### Creare un nuovo veicolo

1. Vai nella sezione **Officina** o **Riepilogo**.
2. Clicca sul pulsante **"+ Nuovo Veicolo"**.
3. Si apre una finestra con più schede. Compila i dati richiesti.
4. Clicca **"Crea"** per salvare.

> **Campi obbligatori** (evidenziati in rosso):
> - Committente
> - Data Consegna
> - Tipo Allestimento
> - Codice Inventario (solo per Box e Isotermico)

---

### Le schede del veicolo

La finestra del veicolo è divisa in 6 schede:

#### Scheda 1 — Generale

Contiene le informazioni principali:

- **Committente:** nome del cliente o dell'azienda.
- **Data Consegna:** data prevista di consegna.
- **Data Arrivo:** quando il veicolo è arrivato in officina.
- **Numero Telaio:** identificativo del veicolo.
- **Stato:** la fase attuale del veicolo (vedi sotto).
- **Ordine SAP:** numero dell'ordine nel sistema SAP.
- **Chiavi parcheggio:** indica se sono presenti le chiavi di scorta.
- **Note Generali:** campo libero per annotazioni.

**Stato del veicolo — i 4 stadi:**

| Stato | Significato |
|---|---|
| **Da Allestire** | Il veicolo è arrivato ma i lavori non sono ancora iniziati |
| **In Allestimento** | I lavori sono in corso |
| **Pronto** | I lavori sono terminati, il veicolo è pronto |
| **Ritirato** | Il veicolo è stato consegnato o ritirato dal cliente |

**Stato Collaudo:**

- **Da collaudare:** il veicolo deve ancora essere collaudato, nessuna data assegnata.
- **Pianificato:** è stata assegnata una data di collaudo (dalla sezione **Collaudi**, vedi §8).
- **Allestimento omologato:** l'allestimento è stato omologato.
- **Collaudo eseguito:** il collaudo è stato completato.
- **Non richiesto:** collaudo/omologazione non necessari per questo veicolo.

---

#### Scheda 2 — Allestimento

Contiene i dettagli tecnici del lavoro da svolgere:

- **Tipo Allestimento:** scegli tra Box, Isotermico, Cassone Fisso, Cassone Ribaltabile.
- **Codice Inventario:** obbligatorio per Box e Isotermico.
- **Data Montaggio:** quando è previsto o iniziato il montaggio.
- **Codice Allestimento SAP / Descrizione SAP:** dati del codice di lavorazione.
- **Distinta:** puoi allegare il file della distinta base (solo per Box e Isotermico).

**Sponda Caricatrice** (appare solo per veicoli di tipo Box):

- Metti la spunta su "Con Sponda Caricatrice" se è prevista.
- Compila **Marca** e **Matricola** della sponda.

**Matr. Gruppo Frigo** (appare solo per veicoli di tipo Isotermico):

- Campo libero per il numero di matricola del gruppo frigo installato.

---

#### Scheda 3 — Liderkit

Da compilare solo se il veicolo utilizza un kit Liderkit:

- **Numero Matricola Liderkit:** codice identificativo del kit.
- **Ricevuto:** spunta da attivare quando la matricola Liderkit è stata ricevuta. Se attiva, il numero matricola appare in arancione scuro nella preview della scheda veicolo (Officina e Riepilogo).
- **Week Spedizione Kit:** settimana di spedizione del kit.

---

#### Scheda 4 — Ritiri e Consegne

Serve per pianificare come e quando il veicolo verrà riconsegnato al cliente.

**Tre modalità disponibili:**

- **Ritiro del Mezzo:** il cliente viene a ritirare direttamente in sede.
- **Consegna:** il veicolo viene consegnato da noi (con Bisarca o con Autista).
- **Appuntamento Montaggio:** si va dal cliente per montare l'allestimento in loco.

**Campi da compilare:**

- **Data Ritiro/Consegna:** la data prevista.
- **Ora Montaggio** (solo per Appuntamento Montaggio): l'ora dell'appuntamento.
- **Tipo Consegna** (solo per Consegna): scegli "Bisarca" o "Autista".
- **Indirizzo Consegna** (solo per Consegna): dove consegnare il veicolo.
- **Cliente Avvisato:** metti la spunta quando hai avvisato il cliente, e inserisci la data.
- **Ritiro/Consegna Svolto:** metti la spunta a operazione completata.
- **Note Ritiro:** annotazioni libere sull'operazione.

> **Importante:** Se inserisci un Appuntamento Montaggio e l'orario passa, il sistema cambia automaticamente lo stato del veicolo in "Ritirato".

---

#### Scheda 5 — Documenti e File

Gestisci i documenti allegati al veicolo:

- **Pagamento Documenti:** spunta se i documenti sono stati pagati. Si può aggiungere una nota.
- **Documenti Mandati:** spunta se i documenti sono stati spediti. Si inserisce la data.
- **File Allegati:** puoi caricare PDF, immagini e altri documenti trascinandoli nell'area apposita o cliccando per sfogliare.

Per ogni file caricato puoi:
- **Visualizzarlo** cliccando sul nome.
- **Eliminarlo** cliccando sul pulsante di cancellazione.

---

#### Scheda 6 — Info Ford *(solo Amministratori)*

Campi riservati visibili solo agli utenti con ruolo Admin:

- Numero Bolla Consegna
- NON (Network Order Number)
- Nome Dealer / Codice Dealer
- Codice Ford / Codice SCV
- DDT OK OK FGERACE
- Note Prezzo

---

### Modificare un veicolo

1. Trova il veicolo nella sezione che preferisci (Officina, Riepilogo, ecc.).
2. Clicca sul veicolo o sull'icona matita per aprire la scheda.
3. Modifica i campi che vuoi aggiornare.
4. Clicca **"Salva"**.

---

### Eliminare un veicolo

1. Apri il veicolo che vuoi eliminare.
2. Clicca sul pulsante **"Elimina"** (icona cestino).
3. Conferma l'operazione nella finestra di dialogo.

> **Attenzione:** L'eliminazione è definitiva e non può essere annullata. I file allegati vengono eliminati insieme al veicolo.

---

### Copiare un veicolo

Questa funzione è utile per creare un veicolo simile a uno già esistente con una nuova data.

1. Apri il veicolo dal calendario (**File Montaggi**).
2. Clicca su **"Copia"**.
3. Scegli la nuova data di consegna.
4. Il sistema crea un duplicato con lo stato reimpostato a "Da Allestire".

---

## 5. Officina

Questa sezione mostra tutti i veicoli in lavorazione, cioè quelli nello stato **"Da Allestire"** e **"In Allestimento"**.

### Come usare l'Officina

- I veicoli vengono ordinati automaticamente per: **urgenza**, presenza del numero telaio, data di consegna.
- I veicoli in ritardo (data di consegna passata e non ancora pronti) vengono **evidenziati in rosso**.
- Clicca su un veicolo per aprirne la scheda e modificarla.

### Filtri disponibili

In alto trovi una barra con i filtri:

- **Tipo Allestimento:** filtra per Box, Isotermico, Cassone Fisso, Cassone Ribaltabile.
- **Senza N° Telaio:** mostra solo i veicoli senza numero di telaio.
- **Senza N° Ordine SAP:** mostra solo i veicoli senza ordine SAP.
- **Non ancora consegnati:** mostra solo i veicoli senza Data Arrivo compilata.
- **Veicoli già ricevuti:** mostra solo i veicoli con Data Arrivo compilata (l'opposto del filtro precedente).
- **COC non ricevuto:** mostra solo i veicoli senza COC ricevuto.
- **Barra di ricerca:** cerca per qualsiasi campo del veicolo.

> I filtri "Tipo" e "Vista" sono combinabili tra loro e con la ricerca (logica AND): puoi, ad esempio, cercare solo i veicoli Box già ricevuti e ancora senza COC.

### Segnalare un veicolo urgente

Apri la scheda del veicolo e attiva il flag di urgenza. Il veicolo apparirà in cima alla lista con un indicatore visivo.

---

## 6. File Montaggi (Calendario)

Questa sezione mostra un **calendario mensile** con tutte le date di consegna pianificate.

### Come navigare nel calendario

- Usa le frecce **◀ ▶** per passare al mese precedente o successivo.
- I giorni con veicoli schedulati mostrano dei **punti colorati**.
- Clicca su un giorno per vedere l'elenco dei veicoli previsti per quella data.

### Dettaglio giorno

Cliccando su un giorno si apre una finestra con:
- L'elenco di tutti i veicoli previsti.
- Per ogni veicolo: committente, tipo allestimento, stato documenti.
- Azioni rapide: **modifica**, **elimina**, **copia** su altra data.

### Filtri del calendario

- **Committente:** mostra solo i veicoli di un cliente specifico.
- **Tipo Allestimento:** filtra per tipo di lavoro.
- **Stato Pagamento:** mostra solo i veicoli con documenti pagati o non pagati.

> **Nota:** I veicoli "Ritirato" non appaiono nel calendario. Per esportare in Excel l'elenco completo dei veicoli usa il pulsante **"Excel"** in alto (vedi §2).

---

## 7. Pianificazione Ritiri

Questa sezione serve a organizzare quando e come i veicoli **pronti** vengono riconsegnati ai clienti.

### Come pianificare un ritiro o una consegna

1. Vai nella sezione **Pianificazione Ritiri**.
2. Il calendario mostra i veicoli nello stato **"Pronto"**.
3. Seleziona un veicolo e assegna:
   - La modalità (Ritiro / Consegna / Appuntamento Montaggio).
   - La data (e l'ora se è un appuntamento montaggio).
4. Quando avvisi il cliente, metti la spunta su **"Cliente Avvisato"** e inserisci la data.
5. Quando l'operazione è completata, metti la spunta su **"Ritiro/Consegna Svolto"**.

### Cosa succede automaticamente

- Se un **Appuntamento Montaggio** raggiunge l'orario programmato, il veicolo passa automaticamente allo stato "Ritirato".
- Quando un veicolo viene segnato come "Ritirato", il **posto nel parcheggio viene liberato automaticamente**.

---

## 8. Collaudi

Questa sezione è un **calendario dedicato ai collaudi/omologazioni**, separato da quello di File Montaggi. In alto trovi tre contatori: **Da Collaudare** (senza data), **Pianificati** (con data assegnata) e **Completati**.

### Pianificare un collaudo dal calendario

1. Vai nella sezione **Collaudi**.
2. Clicca su un giorno del calendario.
3. Scegli, tra i veicoli ancora "Da Collaudare" senza data, quello da assegnare a quel giorno.
4. Il collaudo del veicolo passa automaticamente a **"Pianificato"** con la data scelta.

> **Nota:** se due persone provano ad assegnare lo stesso veicolo quasi contemporaneamente, solo la prima richiesta va a buon fine; l'altra riceve un avviso di riprovare.

### Gestire un giorno

Cliccando su un giorno con veicoli assegnati si apre il dettaglio, da cui puoi:
- Aprire la scheda completa del veicolo.
- Segnare il collaudo come **"Eseguito"**.
- **Ripristinare** un collaudo da "Eseguito" a "Pianificato", in caso di errore.

### Cercare un veicolo

Usa la barra di ricerca in cima alla pagina: se il veicolo trovato ha già una data di collaudo, il calendario si sposta automaticamente al mese giusto ed evidenzia il veicolo.

---

## 9. Riepilogo

Questa sezione offre una **vista d'insieme di tutti i veicoli**, raggruppati per stato.

### Come leggere il Riepilogo

I veicoli sono raggruppati in 4 colori:

| Colore | Stato |
|---|---|
| Rosso | Da Allestire |
| Giallo | In Allestimento |
| Verde | Pronto |
| Blu | Ritirato |

### Avvisi importanti

In cima alla pagina possono apparire degli avvisi:

- **Veicoli da collaudare:** veicoli pronti che non hanno ancora un collaudo registrato.
- **Codice Inventario mancante:** veicoli di tipo Box/Isotermico senza codice inventario.

Clicca su un veicolo per aprirne la scheda completa.

> **Nota:** Gli utenti con ruolo Omologatore vedono anche questa sezione, in modalità sola lettura (insieme a File Montaggi e Collaudi — vedi §3).

---

## 10. Chat e Azioni

Questa sezione ha due funzioni:

### Chat interna

- Permette di **inviare messaggi** a tutto il team.
- I messaggi appaiono in tempo reale per tutti gli utenti connessi.
- Scrivi il messaggio nel campo in basso e premi **Invio** o clicca **"Invia"**.
- I messaggi mostrano il nome dell'utente e l'ora relativa (es. "5 minuti fa").

> **Nota:** Gli utenti con ruolo Non Operativo possono leggere ma non inviare messaggi. Gli utenti con ruolo Omologatore non accedono affatto a questa sezione (non compare nel loro menu).

### Registro Azioni

- Mostra un **elenco cronologico di tutte le operazioni** eseguite nel sistema.
- Per ogni azione trovi: chi l'ha fatta, cosa ha fatto, quale veicolo riguarda, quando.
- Questo registro non può essere modificato.

### Notifiche messaggi

- Il numero di messaggi non letti appare come **badge rosso** sul tab "Chat e Azioni".
- Quando arriva un nuovo messaggio, compare una notifica in basso allo schermo.
- Il contatore si azzera quando entri nella sezione Chat.

---

## 11. Parcheggio

Questa sezione mostra la **mappa visiva del parcheggio P2** con 162 posti totali (74 a sinistra, 88 a destra).

### Come assegnare un veicolo a un posto

1. Vai nella sezione **Parcheggio**.
2. Clicca su un **posto libero** (grigio chiaro).
3. Si apre una barra di ricerca: cerca il veicolo da assegnare.
4. Clicca sul veicolo e conferma.
5. Il posto diventa **occupato** e mostra il nome del committente.

### Come visualizzare un veicolo parcheggiato

- Clicca sul posto occupato per vedere i dettagli del veicolo.

### Come liberare un posto

- Clicca sul posto occupato.
- Seleziona l'opzione per rimuovere il veicolo.
- Oppure, segna il veicolo come "Ritirato" dalla scheda veicolo: il posto si libera automaticamente.

### Contatore posti

In alto nella sezione trovi il contatore in tempo reale:
- **Liberi:** posti disponibili.
- **Occupati:** posti assegnati.

---

## 12. Telai in Attesa di Ordine

Questa sezione gestisce i **numeri di telaio già noti prima che arrivi il relativo ordine SAP** — capita spesso che le due informazioni arrivino in momenti diversi. Invece di tenerne traccia fuori dall'applicazione, puoi registrare qui il telaio e trasformarlo in una scheda veicolo completa non appena l'ordine arriva.

### Aggiungere un telaio in attesa

1. Clicca su **"+ Nuovo Telaio"**.
2. Compila:
   - **Numero Telaio** (obbligatorio).
   - **Committente**, se già noto.
   - **Data Arrivo Veicolo:** precompilata con la data odierna, modificabile.
   - **Chiavi Parcheggio**, se già note.
   - **Note:** eventuali informazioni aggiuntive.
3. Clicca **"Crea"**.

### Convertire un telaio in veicolo

Quando arriva l'ordine SAP per quel telaio, puoi trasformarlo direttamente in una scheda veicolo:

1. Trova il telaio nell'elenco (puoi cercarlo per numero telaio, committente o note).
2. Clicca su **"Crea Veicolo"**.
3. Inserisci: committente (precompilato se già presente, ma modificabile), data consegna, tipo allestimento.
4. Conferma: viene creato automaticamente un nuovo veicolo con Numero Telaio, Chiavi Parcheggio e Note già compilati, e la Data Arrivo Veicolo riportata nel campo "Data Arrivo" della scheda. **Il telaio viene rimosso automaticamente dall'elenco "in attesa"** appena la scheda veicolo è creata — essendosi trasformato in un veicolo, non ha più senso che resti anche qui.

### Esportare l'elenco

Non c'è un pulsante di export dedicato in questa pagina. L'elenco è incluso come foglio separato nel **Backup Locale** (§15, solo amministratori).

---

## 13. Materiale LDK a Stock

Questa sezione gestisce i **kit Liderkit in magazzino** (materiale ancora da montare su un veicolo).

### Aggiungere un kit a stock

1. Clicca su **"+ Nuovo Materiale LDK"**.
2. Compila:
   - **Cliente**, **Matricola** e **Dimensioni** (obbligatori).
   - **Categoria:** menu a tendina — "BOX", "BOX Isotermico" o "ricambi Liderkit".
   - **Data consegna materiale:** campo libero (es. "settimana 20", "15/05").
   - **Specifiche:** eventuali informazioni aggiuntive.
   - **Documenti e Foto:** puoi allegare foto o PDF relativi al kit.
3. Clicca **"Crea"**.

### Filtrare per categoria

Sopra l'elenco trovi i pulsanti "Categoria": **Tutte**, **BOX**, **BOX Isotermico**, **ricambi Liderkit**. Ognuno mostra tra parentesi il conteggio automatico dei materiali di quella categoria; cliccandoci sopra l'elenco si filtra di conseguenza (il conteggio si aggiorna anche in cima alla pagina).

### Convertire un kit in veicolo

Quando un kit viene montato su un veicolo, puoi trasformarlo direttamente in una scheda veicolo:

1. Trova il kit nell'elenco.
2. Clicca su **"Crea Veicolo"**.
3. Inserisci: committente, data consegna, tipo allestimento.
4. Conferma: viene creato automaticamente un nuovo veicolo con i dati del kit (matricola, dimensioni, specifiche). Puoi scegliere se rimuovere il materiale dal magazzino a conversione avvenuta.

### Esportare l'inventario

Non c'è un pulsante di export dedicato in questa pagina. Il materiale a stock è incluso come foglio separato sia nel pulsante **"Excel"** in alto (vedi §2) sia nel **Backup Locale** (§15, solo amministratori).

---

## 14. Analisi

Questa sezione mostra **statistiche e grafici** sull'attività dell'officina.

### Cosa trovi

- **Tempo medio di allestimento** (dal montaggio alla consegna, in giorni).
- **Andamento mensile** dei tempi di lavorazione.
- **Numero di veicoli completati** per mese.
- **Distribuzione per stato** (quanti Da Allestire, In Allestimento, ecc.).

### Come usare i filtri

- **Tipo Allestimento:** analizza solo un tipo specifico di lavoro.
- **Committente:** vedi le statistiche per un solo cliente.
- **Intervallo date:** limita l'analisi a un periodo specifico.
- **Anno:** confronta anni diversi.

---

## 15. Backup Locale *(solo Amministratori)*

Questa sezione è visibile e accessibile **solo agli amministratori**. Serve per creare copie di sicurezza dei dati.

### Come fare un backup manuale

1. Vai nella sezione **Backup Locale**.
2. Clicca su **"Seleziona Cartella"** e scegli dove salvare i file.
3. Clicca su **"Scarica Backup"**.
4. Il sistema crea un unico file Excel — un foglio separato per ogni tipo di dato — e lo salva nella cartella scelta.

### Come configurare il backup automatico

1. Attiva l'interruttore **"Backup Automatico"**.
2. Imposta l'intervallo in ore (es. ogni 24 ore).
3. Il sistema esegue automaticamente il backup a intervalli regolari.

### Cosa viene salvato

Un foglio per ognuna di queste voci (deselezionabili singolarmente prima del backup):

- Tutti i veicoli
- Materiale LDK a Stock
- Telai in Attesa di Ordine
- Messaggi della chat
- Registro azioni
- Posti parcheggio

---

## 16. Importazione massiva da file

Puoi caricare più veicoli contemporaneamente importando un file CSV o Excel.

### Come importare

1. Clicca sul pulsante **"Importa"** nella barra in alto.
2. Seleziona un file `.csv` o `.xlsx`.
3. Il sistema mostra un'anteprima con i veicoli trovati.
4. Vengono indicati i veicoli validi e quelli con errori (campi mancanti, date errate, ecc.).
5. Clicca **"Importa"** per caricare i veicoli validi.

> **Campi obbligatori nel file:** Committente, Data Consegna.

> **Nota:** Gli utenti non amministratori non possono importare campi riservati Ford, anche se presenti nel file.

---

## 17. Domande frequenti

**Il veicolo non si salva. Cosa faccio?**
Controlla che tutti i campi obbligatori (in rosso) siano compilati. Il sistema mostra un messaggio con l'elenco degli errori.

**Ho perso un veicolo. Come lo trovo?**
Usa la barra di ricerca in cima alla pagina. Oppure vai nel **Riepilogo** e cerca nell'elenco completo.

**Un veicolo è passato a "Ritirato" da solo. È normale?**
Sì, se era programmato un Appuntamento Montaggio e l'orario è passato, il sistema aggiorna automaticamente lo stato.

**Il posto in parcheggio non si è liberato. Cosa faccio?**
Verifica che il veicolo sia effettivamente in stato "Ritirato". In caso contrario, libera manualmente il posto dalla sezione Parcheggio.

**Non riesco ad accedere a una sezione. Perché?**
Probabilmente il tuo ruolo non ti dà accesso a quella sezione. Contatta l'amministratore.

**Come faccio a sapere chi ha fatto una modifica?**
Vai nella sezione **Chat e Azioni**. Il registro mostra tutte le operazioni con nome utente, azione e data/ora.

*Manuale redatto per uso interno — Scattolini SSV Manager*
