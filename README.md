# Lista della Spesa
Progetto reti di calcolatori

Il progetto implementa una semplice Lista della Spesa nella quale è possibile aggiungere Ricette e relativi ingredienti o Singoli ingredienti.
Ultimata la lista, è possibile salvarla su Google Calendar cosi da averla a disposizione su tutti i dispositivi connessi al relativo account.

La struttura del progetto è la seguente:

Gli elementi statici, *index.html*, *index.js*, *callback.html*, ecc. vengono forniti da un **NGINX WebServer**.

Da quest'ultimo, partono le richieste verso **Express AppServer**, implementato in *server.js*.

L'utente, sulla homepage, ha a disposizione 3 Buttons:
1. **Aggiungi Ricetta**, premendo questo Button viene inviata una richiesta asincrona a **Recipe Search API** con la quale richiediamo i dati delle ricette con nome simile o che contengono la parola inserita nel relativo input box.
Ottenuti i dati dalla API, questi vengono restituiti a *index.js* che costruisce un *Bootstrap Modal* dove, per ogni ricetta ottenuta, viene visualizzato il nome della ricetta, i valori nutrizionali e i relativi ingredienti.
A questo punto è possibile selezionare gli ingredienti di UNA SOLA RICETTA (IMPORTANTE) e, quando avremo finito, cliccare sul Button **Scegli** in fondo al **Modal**.
In questo modo vengono ricercati eventuali ingredienti selezionati e, se trovati, andranno a indicare che è stata scelta la relativa ricetta e gli ingredienti selezionati.
Fatto ciò, viene costruito sulla homepage un Div contenente l'immagine della ricetta scelta, il nome e gli ingredienti scelti in precedenza.
Inoltre saranno presenti il numero di persone per cui è pensata la ricetta e relativi valori nutrizionali.
Questi vengono ottenuti inviando un'altra richiesta asincrona a **Recipe Search API** che restituirà il numero di persone per cui è pensata la ricetta e i relativi valori nutrizionali.
In particolare, viene utilizzato un particolare URL legato alla ricetta selezionata, ottenuto nella prima richiesta a **Recipe Search API**. Quando i dati saranno pronti, verranno mostrati all'utente nel relativo Div della ricetta.

2. **Aggiungi Ingrediente**, molto simile al Button illustrato in precedenza.
Premendo questo Button viene inviata una richiesta asincrona a **Food and Grocery Database API** con la quale richiediamo i dati relativi a ingredienti con nome simile o che contengono la parola inserita nel relativo input box.
Ottenuti i dati dalla API, questi vengono restituiti a *index.js* che costruisce un *Bootstrap Modal* dove, per ogni ingrediente ottenuto, viene visualizzato il nome e relativi valori nutrizionali.
A questo punto è possibile scegliere UN SOLO INGREDIENTE (IMPORTANTE) semplicemente cliccandoci sopra e, dopo che la lista dei valori nutrizionali è comparsa, si può cliccare sul Button **Scegli** in fondo al Modal.
Viene, quindi costruito un Div sulla homepage con immagine e nome della ricetta.
Parallelamente, viene inviata un'altra richiesta asincrona a **Nutrition Analysis API**, che restituirà i relativi valori nutrizionali per 100gr di prodotto. Ottenuti i seguenti dati verranno aggiunti al Div del relativo ingrediente selezionato.

3. **Salva in Calendar**, cliccando su questo tasto è possibile salvare gli ingredienti singoli, le ricette e i relativi ingredienti su un evento di Google Calendar, così da creare la vera e propria Lista della Spesa.

La creazione di tale evento si svolge in 2 fasi:
1. La prima volta che l'utente clicca sul Button **Salva in Calendar**, viene inviata una richiesta all'Application Server, questo avvia una procedura di autorizzazione alla richiesta verso Google Calendar API che consta nel controllare che l'utente l'applicazione ha a disposizione il *Token* che lo autorizza a inviare richieste a Google API.
In questo caso, essendo la prima volta che l'utente interagisce con tale Button, il token non sarà presente.
Constatato ciò, l'Application Server crea un authUrl e lo restituisce all'utente, a cui viene mostrato attraverso un *Bootstrap Modal*, seguendo tale URL, l'utente autorizza con ad usare un account Google e relativo Google Calendar.
Completata l'autorizzazione, l'utente viene reindireizzato ad una semplice pagina HTML, *callback.html* che conferma l'avvenuta autorizzazione e che l'utente può chiudere la pagina e tornare alla homepage.
Parallelamente a ciò, viene inviata una richiesta all'Application Server con, tra i parametri, un tokenCode ottenuto dalla autorizzazione andata a buon fine, quest'ultimo viene usato per costruire il token e salvarlo in *token.json*, in questo modo l'utente è autorizzato a interagire con Google Calendar API.

2. La seconda fase consta nella vera e propria creazione dell'evento su Google Calendar.
Premendo una seconda volta sul button **Salva in Calendar**, viene creato un JSON Object contentente i dati dei singoli ingredienti, le ricette e i relativi ingredienti, questi dati vengono inviati all'Application Server.

Quest'ultimo, prima di creare l'evento, vengono verificate 2 cose:
- Se il calendar *Lista della Spesa* non è presente tra i Calendar del relativo account Google ne crea uno.
- Se il calendar è presente si verifica l'esistenza dell'evento *Lista della Spesa*, se quest'ultimo non è presente, viene creato un nuovo evento e nella descrizione vengono inseriti i dati delle ricette e degli ingredienti, se invece l'evento *Lista della Spesa* è già presente, allora viene modificata la descrizione di quest'ultimo con i dati delle ricette e degli ingredienti, senza andare a crearne uno nuovo. 