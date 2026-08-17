# Guida Setup Autenticazione Firebase

## 🎯 Panoramica

Il sistema di autenticazione è stato implementato con successo! Ora l'applicazione richiede login per accedere e il database è protetto da Firestore Security Rules.

## 📋 Passi da Completare

### 1. Attivare Firebase Authentication nella Console

1. Vai alla [Console Firebase](https://console.firebase.google.com/)
2. Seleziona il progetto **scattolini-ssv**
3. Nel menu laterale, clicca su **Authentication**
4. Clicca su **Get Started** (se non l'hai già fatto)
5. Nella tab **Sign-in method**, clicca su **Email/Password**
6. Attiva **Email/Password** (prima opzione)
7. Clicca **Save**

### 2. Deployare le Firestore Security Rules

Le Security Rules sono state create nei file:
- `firestore.rules` - Protezione database Firestore
- `storage.rules` - Protezione Firebase Storage

**Opzione A: Deploy tramite Firebase CLI** (Consigliato)

```bash
# Installa Firebase CLI se non l'hai già fatto
npm install -g firebase-tools

# Login a Firebase
firebase login

# Inizializza il progetto (seleziona Firestore e Storage quando richiesto)
firebase init

# Quando chiede quale file di rules usare, conferma:
# - firestore.rules per Firestore
# - storage.rules per Storage

# Deploy delle rules
firebase deploy --only firestore:rules,storage:rules
```

**Opzione B: Deploy manuale dalla Console**

1. Vai alla [Console Firebase](https://console.firebase.google.com/)
2. Per **Firestore Rules**:
   - Clicca su **Firestore Database** → **Rules**
   - Copia il contenuto di `firestore.rules`
   - Incollalo nell'editor
   - Clicca **Publish**

3. Per **Storage Rules**:
   - Clicca su **Storage** → **Rules**
   - Copia il contenuto di `storage.rules`
   - Incollalo nell'editor
   - Clicca **Publish**

### 3. Creare il Primo Utente

Ci sono due modi per creare il primo utente:

**Opzione A: Tramite l'applicazione** (Più semplice)

1. Avvia l'applicazione: `npm run dev`
2. Nella pagina di login, clicca su **Registrati**
3. Inserisci:
   - Nome Completo
   - Email
   - Password (minimo 6 caratteri)
4. Clicca **Registrati**

**Opzione B: Tramite Console Firebase**

1. Vai su **Authentication** → **Users**
2. Clicca **Add user**
3. Inserisci email e password
4. Clicca **Add user**
5. (Opzionale) Clicca sull'utente creato e aggiungi il Display Name

### 4. Verifica che tutto Funzioni

1. Avvia l'applicazione: `npm run dev`
2. Dovresti vedere la pagina di login
3. Prova a fare login con le credenziali create
4. Dopo il login, dovresti vedere l'applicazione principale
5. Verifica che il tuo nome appaia nell'header in alto a destra
6. Clicca sul pulsante **Esci** per testare il logout

## 🔒 Cosa è Stato Implementato

### Autenticazione Frontend
- ✅ **LoginPage**: Pagina di login/registrazione con UI moderna
- ✅ **AuthContext**: Gestione stato autenticazione globale
- ✅ **Protezione Routes**: L'app mostra la LoginPage se l'utente non è autenticato
- ✅ **Logout**: Pulsante logout nell'header (desktop e mobile)
- ✅ **Gestione Errori**: Messaggi di errore user-friendly

### Sicurezza Backend
- ✅ **Firestore Rules**: Solo utenti autenticati possono accedere al database
- ✅ **Storage Rules**: Solo utenti autenticati possono caricare/scaricare file
- ✅ **Validazione Dati**: Validazione base sui campi richiesti
- ✅ **Protezione Log**: I log non possono essere modificati o eliminati

### Collections Protette
Tutte le collection richiedono autenticazione:
- `veicoli` - Veicoli in gestione
- `telai` - Telai in attesa
- `kits` - Kit in stock
- `messages` - Messaggi chat
- `actions` - Log azioni
- `parkingSpots` - Posti parcheggio

## 🚨 IMPORTANTE

**DOPO aver deployato le Security Rules, chiunque non autenticato NON potrà più accedere al database!**

Assicurati di:
1. ✅ Attivare Firebase Authentication
2. ✅ Creare almeno un utente
3. ✅ Solo DOPO deployare le Security Rules

Se fai il deploy delle rules prima di creare un utente, non potrai più accedere all'applicazione finché non crei un utente tramite la Console Firebase!

## 📱 Login/Logout

- **Desktop**: Il pulsante "Esci" è visibile in alto a destra
- **Mobile**: Il pulsante "Logout" è nel menu hamburger

## 🔧 Risoluzione Problemi

### "Email already in use"
L'email è già registrata. Usa il login invece della registrazione.

### "Invalid credential"
Email o password errati. Verifica le credenziali.

### "Cannot read from Firestore"
Le Security Rules sono attive ma non sei autenticato. Fai login.

### "Permission denied"
Le Security Rules sono attive. Devi essere autenticato per accedere ai dati.

## 📚 File Modificati/Creati

**Nuovi File:**
- `src/contexts/AuthContext.jsx` - Context per autenticazione
- `src/components/LoginPage.jsx` - Pagina login/registrazione
- `firestore.rules` - Security rules database
- `storage.rules` - Security rules storage
- `firebase.json` - Configurazione Firebase
- `firestore.indexes.json` - Indici Firestore

**File Modificati:**
- `src/App.jsx` - Integrazione autenticazione, wrapper AuthProvider, pulsanti logout

## 🎉 Completamento

Una volta completati tutti i passi, il tuo sistema sarà completamente protetto! Solo gli utenti autenticati potranno:
- Accedere all'applicazione
- Leggere i dati dal database
- Modificare i dati
- Caricare file

---

**Hai bisogno di aiuto?** Contatta il team di sviluppo o consulta la [documentazione Firebase Authentication](https://firebase.google.com/docs/auth).
