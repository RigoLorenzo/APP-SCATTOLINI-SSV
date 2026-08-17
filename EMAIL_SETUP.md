# Guida Setup Email Transazionale (Brevo)

## 🎯 Panoramica

Le email automatiche di SSV Manager (notifica "Veicolo Pronto" e report settimanale COC/pagamenti) vengono inviate tramite SMTP con [nodemailer](https://nodemailer.com/), da:

- `api/sendVehicleReady.js` (Vercel serverless, invocata dal client React quando un veicolo passa a "Pronto")
- `scripts/sendWeeklyReport.js` (GitHub Actions, `.github/workflows/weekly-report.yml`, ogni lunedì)

In precedenza era collegata una casella Microsoft 365/Outlook. Microsoft disabilita di default l'autenticazione SMTP "classica" a livello di tenant (errore `535 5.7.139 SmtpClientAuthentication is disabled`), quindi va sostituita con un provider email transazionale dedicato.

**Provider scelto: [Brevo](https://www.brevo.com/)** (ex Sendinblue)
- **300 email/giorno gratis, per sempre** — nessuna carta di credito richiesta, nessun costo nascosto
- Non richiede la verifica DNS completa del dominio per iniziare (basta verificare l'indirizzo mittente via email)
- Compatibile "as-is" con il codice esistente: basta cambiare le variabili d'ambiente SMTP, **nessuna modifica di codice necessaria** per il transport

Se in futuro il volume di invii dovesse superare 300/giorno, si può passare a un piano Brevo a pagamento oppure ad alternative simili (SendGrid 100/giorno gratis, Mailgun) senza toccare il codice: basta cambiare le stesse 6 variabili d'ambiente.

---

## 📋 Passi da Completare

### 1. Creare l'account Brevo

1. Vai su [app.brevo.com/account/register](https://app.brevo.com/account/register)
2. Registrati con un'email aziendale (es. `noreply@scattolini.it` o l'email dell'amministratore)
3. Completa la verifica dell'account (conferma email + eventuale verifica telefono richiesta da Brevo per attivare l'invio)

### 2. Verificare il mittente ("Sender")

Serve per poter usare un indirizzo come `noreply@scattolini.it` (o simile) come mittente delle email:

1. Nel pannello Brevo vai su **Settings → Senders, Domains & Dedicated IPs → Senders**
2. Clicca **Add a Sender**, inserisci nome (es. "SSV Manager") ed email mittente desiderata
3. Brevo invia un'email di conferma a quell'indirizzo: apri il link per verificarlo
4. *(Consigliato, non obbligatorio per iniziare)*: se hai accesso al DNS del dominio, verifica anche il **dominio** intero in **Domains** aggiungendo i record SPF/DKIM proposti da Brevo — migliora la deliverability (meno probabilità che le email finiscano in spam)

### 3. Generare le credenziali SMTP

1. Vai su **Settings → SMTP & API → SMTP**
2. Copia il valore **SMTP login** (è un indirizzo tipo `xxxxxx001@smtp-brevo.com`, diverso dall'email con cui ti sei registrato)
3. Clicca **Generate a new SMTP key**, dai un nome (es. "SSV Manager production") e copia la chiave generata — **viene mostrata una sola volta**, salvala in un posto sicuro

### 4. Configurare le variabili d'ambiente su Vercel

Nel [dashboard Vercel](https://vercel.com/) del progetto → **Settings → Environment Variables**, aggiungi (per gli ambienti **Production** e **Preview**):

| Nome | Valore |
|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | l'SMTP login copiato al passo 3 (es. `xxxxxx001@smtp-brevo.com`) |
| `SMTP_PASS` | la SMTP key generata al passo 3 |
| `SMTP_FROM` | `SSV Manager <noreply@scattolini.it>` (l'indirizzo verificato al passo 2) |

Dopo averle salvate, fai un **redeploy** (o attendi il prossimo deploy) perché le nuove env var vengano applicate alle funzioni serverless.

### 5. Configurare i secrets su GitHub Actions (report settimanale)

Nel repository GitHub → **Settings → Secrets and variables → Actions → New repository secret**, aggiungi gli stessi 6 secrets con gli stessi nomi e valori del passo 4 (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) — sono usati da `.github/workflows/weekly-report.yml`.

Se erano già presenti dei secrets con lo stesso nome collegati alla vecchia casella Outlook, basta **aggiornarne il valore** (Update secret), non serve ricrearli.

### 6. Verificare che tutto funzioni

- **Notifica "Veicolo Pronto"**: nell'app, apri un veicolo "In Allestimento" e passalo a "Pronto" (o usa il pulsante "Completa" in Officina). Se ci sono destinatari configurati (icona ✉️ Notifiche Email → tab "Veicolo Pronto"), l'email dovrebbe arrivare entro pochi secondi senza errori.
- **Report settimanale**: da GitHub → tab **Actions** → workflow "Weekly COC & Payments Report" → **Run workflow** per testarlo manualmente senza aspettare lunedì.
- In caso di errore, il messaggio mostrato in app (toast rosso in alto) riporta la risposta esatta del server SMTP — utile per capire se è un problema di credenziali, mittente non verificato, o limite giornaliero superato.
- Ogni invio (riuscito o fallito) viene comunque registrato in Firestore, collezione `emailLogs`.

### 7. Limite giornaliero

Il piano gratuito Brevo consente **300 email/giorno**. Ogni invio "Veicolo Pronto" conta come 1 email per destinatario configurato (es. 2 destinatari = 2 email). Con l'attuale volume di veicoli gestiti è molto difficile avvicinarsi al limite, ma se dovesse succedere Brevo mette in coda gli invii in eccesso al giorno successivo (non li perde, ma li ritarda) — vale la pena tenerlo a mente se in futuro si aggiungono molti destinatari.
