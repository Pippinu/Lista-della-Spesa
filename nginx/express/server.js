'use strict'

require('dotenv').config({path: '.env'});
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const amqp = require('amqplib/callback_api');
const {google} = require('googleapis');
const fs = require('fs');
const util = require('util');
const fsProms = util.promisify(fs.readFile);
// const open = require('open');

// const readline = require('readline');
// const http = require('http');
// const https = require('https');
// const url = require('url');
// let {PythonShell} = require('python-shell');

// Hash Function per stringhe
String.prototype.hashCode = function(){
    var hash = 0;
      for (var i = 0; i < this.length; i++) {
          var char = this.charCodeAt(i);
          hash = ((hash<<5)-hash)+char;
          hash = hash & hash; // Convert to 32bit integer
      }
      return hash;
}

// Manda log alla relativa coda AMQP con key 'DBlog'
function logFunc(log){
    amqp.connect('amqp://host.docker.internal:55672', function(error0, connection){
        if(error0){
            throw error0;
        }

        connection.createChannel(function(error1, channel){
            if(error1){
                throw error1;
            }

            var exchange = 'mainEx';
            var key = 'DBlog';

            channel.assertExchange(exchange, 'topic' , {
                durable: false,
            });

            channel.publish(exchange, key, Buffer.from(log));
            console.log('Request log sent to DB');
        })
        setTimeout(function(){
            connection.close();
        }, 1000);
    })
}

// Gli interceptors, appunto intercettano Axios Request e Response e eseguono la funzione logFunc per salvare i log su CouchDB
axios.interceptors.request.use(req => {
    let log = '[Axios][Request] ' + req.method.toUpperCase() + ' ' + req.url;
    logFunc(log);

    return req;
})
axios.interceptors.response.use(res => {
    let log = '[Axios][Response] ' + res.config.method.toUpperCase() + ' ' + res.config.url;

    logFunc(log);
    return res;
})

// Richiede a Recipe Search API una serie di ricette che comprendano nel titolo il parametro passato e restituisce i JSON Data
// di ognuno di essi cosi da costruire il Modal Ricette da poter selezionare
async function axiosRecipe(recipe){
    try{
        let res = await axios({
            method: 'GET',
            url: 'https://api.edamam.com/api/recipes/v2?type=public&q=' + recipe + '&app_id=' + process.env.EDAMAM_APP_ID_RECIPE + '&app_key=' + process.env.EDAMAM_APP_KEY_RECIPE
        })
        if(res.status == 200){
            console.log('Ricetta Ottenuta');
            // DEBUG PURPOSE per non effettuare troppe richieste alla API, che, essendo free, permette 
            // un numero massimo di richieste per minuto

            // fs.writeFile("recipesList.json", JSON.stringify(res.data.hits), (err, result) => {
            //     if(err) console.log(err);
            // })
            return res.data.hits;
        } else return null;
    } catch(err){
        console.log(err.response.status);
    }
}
// Richiede a Food Database API la singola ricetta e restituisce i valori di quest'ultima per costruire il DivRicetta sulla Homepage.

// Il tutto è possibile grazie all'URL passato come parametro, quest'ultimo è ottenuto quando si seleziona la ricetta
// che si vuole aggiungere alla lista dal Modal che mostra la serie di ricette ottenute dalla funzione 'axiosRecipe'.

// L'URL in questione fa parte dei JSON data della ricetta e viene aggiunto agli attributi in fase di creazione del div
// contenuto nel Modal della lista delle ricette.

// Successivamente, quando viene premuto il tasto 'Scegli' del Modal che conferma la selezione della ricetta, questo URL
// viene preso dagli attributi del div contenuto nel Modal e usato, appunto, nella funzione qui sotto per richiedere a 
// Nutrition Analysis API i valori nutrizionali della ricetta che verranno aggiunti, insieme al nome della ricetta
// ed a suoi ingredienti scelti, nella Homepage
async function axios_get_single_recipe(url){
    try{
        let res = await axios({
            method: 'GET',
            url: url + '&app_id=' + process.env.EDAMAM_APP_ID_RECIPE + '&app_key=' + process.env.EDAMAM_APP_KEY_RECIPE,
        })
        if(res.status == 200){
            console.log('Ricetta Ottenuta');
            // DEBUG PURPOSE per non effettuare troppe richieste alla API, che, essendo free, permette 
            // un numero massimo di richieste per minuto

            // fs.writeFile("recipesList.json", JSON.stringify(res.data.hits), (err, result) => {
            //     if(err) console.log(err);
            // })
            return res.data.recipe;
        } else return null;
    } catch(err){
        console.log(err.response.status);
    }
}

// Richiede a Food Database API una serie di ingredienti che comprendano nel titolo il parametro passato e restituisce i JSON Data 
// di ognuno di essi cosi da costruire il Modal Ingredienti singoli da poter selezionare
async function axios_ing_search(ing){
    try{
        let res = await axios({
            method : 'GET', 
            url : 'https://api.edamam.com/api/food-database/v2/parser?app_id=' + process.env.EDAMAM_APP_ID_FOOD + '&app_key=' + process.env.EDAMAM_APP_KEY_FOOD + '&ingr=' + ing + '&nutrition-type=cooking'
        });

        if(res) {
            // console.log(res);
            return res.data.hints;
        }
    } catch(error){
        console.log(error);
    }
}

// Richiede a Nutrition Data API i dati nutrizionali dell'ingrediente singolo passato come parametro che corrisponde all'ingrediente 
// singolo da aggiungere alla Lista della Speda scelto dal Modal Ingredienti
async function axios_get_single_ing(ing){
    try{
        let res = await axios({
            method: 'GET',
            url: "https://api.edamam.com/api/nutrition-data?app_id=" + process.env.EDAMAM_APP_ID_NUT + "&app_key=" + process.env.EDAMAM_APP_KEY_NUT + "&nutrition-type=cooking&ingr=100%20gr%20" + ing,
        })
        if(res.status == 200){
            console.log('Val. Nut. Ing. Ottenuti');
            return res.data;
        } else return null;
    } catch(err){
        console.log(err.response);
    }
}

// Salva su CouchDB i JSON data della ricetta o dell'ingrediente passati come parametro
async function cacheFunc(toCache){
    // Scrive sul log cosa sta per salvare in cache
    logFunc('[RabbitMQ][Cache] ' + toCache.label);

    amqp.connect('amqp://host.docker.internal:55672', function(error0, connection){
        if(error0) throw error0;
        connection.createChannel(function(error1, channel) {
            if(error1) throw error1;

            const exchange = 'mainEx';
            const key = 'DBcache';

            channel.assertExchange(exchange, 'topic', {
                durable: false,
            });

            channel.publish(exchange, key, Buffer.from(JSON.stringify(toCache)));
            console.log('Data sent to DBCache');
        });
        setTimeout(function(){
            connection.close();
        }, 1000);
    });
}

// Controlla che la ricetta o l'ingrediente richiesti siano in Cache, cioè salvati su CouchDB attraverso il parametro
// ottenuto creando l'hash del nome della ricetta o ingrediente attraverso la funzione 'hashcode' implementata sopra
async function searchCache(labelHash){
    try{
        let res = await axios({
            method : 'GET',
            url : 'http://admin:password@host.docker.internal:5984/cachedb/' + labelHash,
        });
        if(res) return res;
        else return null;
    }catch(error){
        if(error.response.status == 404){
            console.log('Error -> ' + error.response.status);
        } else console.log(error);

        return null;
    }
}

// SCOPES per autorizzazione Google Calendar API
const SCOPES = [
    //SCOPES per CalendarList: list, Calendar.insert, Event:update, Event:insert
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar',
    // SCOPES per Event:list, Event:update, Event:insert
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/calendar.events'
];

// La seguente funzione è utilizzata per autorizzare, appunto, l'aggiunta o l'eventuale modifica dell'evento Lista della Spesa
// in Google Calendar.

// Tale funzione è strutturata in 2 parti, divise dai 2 rami del try-catch, in pratica si prova a leggere il file 'token.json'
// che contiene, appunto, il token fornito da Google Calendar API in caso di avventuta autorizzazione all'uso dell'API.

// Se questo è presente(ramo TRY), allora siamo autorizzati a procedere, settiamo le nostre credenziali e procediamo con la funzione addEvent

// Se il token non fosse presente, non siamo ancora stati autorizzati(ramo CATCH), quindi creiamo un authorization URL attraverso la funzione 
// get_access_token che va costruire quest'ultimo e lo andremo a restituire l'authUrl all'utente che verra mostrato attraverso un modal.
// L'utente seguirà tale URL ed all'avvenuta autorizzazione, tramite la pagina 'callback.html' partirà una richiesta GET a questo Server che
// verrà gestita da 'app.get('/oauth2callback')
function authorize(credentials, callback, CALENDAR_DATA) {
    // Rendo la funzione authorize async
    return new Promise((resolve, reject) => {
        const {client_secret, client_id, redirect_uris} = credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);

        try{
            const token = fs.readFileSync('./token.json');
            console.log('Ok token');
            oAuth2Client.setCredentials(JSON.parse(token));
            callback(oAuth2Client, CALENDAR_DATA);
            resolve(null);
        // Gestisco errore fs.readFileSync, cioè nel caso in cui ./token.json non sia ancora stato creato
        }catch(tokenErr){
            // console.log(`TokenErr -> ${tokenErr}`);
            console.log('No token, genero authUrl');
            const authUrl = get_access_token(oAuth2Client);
            if(authUrl) resolve(authUrl);
            else reject('Error in token generation');
        }
    });
}

// Crea authURL da restiuire alla funzione 'authorize' che a sua volta lo restituirà all'utente
function get_access_token(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    return authUrl
}

// Funzione che gestisce il percorso per l'aggiunta o l'eventuale modifica dell'evento Lista della Spesa, altre info all'interno della funzione
async function addEvent(auth, CALENDAR_DATA) {
    const calendar = google.calendar({version: 'v3', auth});

    try{
        // Ottieni lista dei calendari del relativo account google
        const calendarListRes = await calendar.calendarList.list({});
        const calendars = calendarListRes.data.items;
        // Se sono presenti dei calendari si va alla ricerca del calendario nominato 'Lista della Spesa'
        if(calendars.length){
            calendars.map((thisCalendar, i) => {
                // Se 'Lista della Spesa' è presente controlliamo che 
                if(thisCalendar.summary == 'Lista della spesa'){
                    if(thisCalendar.id == process.env.calendarID){
                        console.log('Calendar found');

                        if(CALENDAR_DATA == null){
                            console.log(`CALENDAR_DATA -> ${CALENDAR_DATA}`);
                            console.log('No recipe data to be added to calendar event');
                        }
                            
                        console.log('Calendar ID matched');
                        setEvent(calendar, CALENDAR_DATA);

                        // PROBLEMA, RETURN NON FUNZIONA E ESECUZIONE CONTINUA
                        return true;
                    } else {
                        // IN CASO CALENDARIO 'Lista della spesa' TROVATO MA ID DIVERSO DA CalendarID in .env, DOVREI AGGIORNARE
                        // console.log(`Error in CalendarList -> \nthisCalendar -> ${JSON.stringify(thisCalendar)}\ncalendarID -> ${process.env.calendarID}`);
                        console.log(`Calendario 'Lista della spesa' presente ma non coincide con il calendario registrato, modifico il suo ID, quindi riprovare!`);
                        
                    }
                }
            });
        }
    } catch(err){
        console.log('CalendarList List -> The API returned an error: ' + err)
        return;
    };

    console.log('No calendar Lista della spesa found');

    if(process.env.calendarID == null || process.env.calendarID == undefined){
        try{
            const calendarInsertRes = await calendar.calendars.insert({
                requestBody: {
                    'summary': 'Lista della spesa'
                },
            });

            try{
                fs.appendFileSync('./.env', `\ncalendarID = ${calendarInsertRes.data.id}`);
            } catch(err) {console.log(`Error in appendFileSync calendar insert -> ${err}`);}
            
            // Ricarico process.env cosi da caricare anche il valore appena inserito process.env.calendarID
            require('dotenv').config({path: './.env'});
            
            console.log(`Calendar created with ID: ${process.env.calendarID}`);
        }catch(err){return console.log('Calendar Create -> The API returned an error: ' + err);}

        setEvent(calendar, CALENDAR_DATA);
        return true;
    } else {
        return console.log('Calendar Missmatch');
    }
}
async function setEvent(calendar, CALENDAR_DATA){
    console.log('im in setEvent');

    const eventListRes = await calendar.events.list({
    calendarId: process.env.calendarID,
    });
        
    let eventID = null;
    eventListRes.data.items.map((e, i) => {
        if(e.summary == 'Lista della spesa'){
            console.log('Event found, lets update it');
            eventID = e.id;
        }
    });

    if(eventID){
        let newEvent = createEvent(CALENDAR_DATA);

        try{
            const eventUpdateRes = await calendar.events.update({
                calendarId: process.env.calendarID,
                eventId: eventID,
                requestBody: {
                    'summary': 'Lista della spesa',
                    'description': newEvent.description,
                    'start': newEvent.start,
                    'end': newEvent.end
                }
            });
    
            return console.log(`Event id: ${eventUpdateRes.data.id} updated`);
        }catch(err) {return console.log('Event Update -> The API returned an error: ' + err);}
    } else {
        console.log('No Event found, lets create it');
        let newEvent = createEvent(CALENDAR_DATA);
        try{
            const eventInsertRes = await calendar.events.insert({
                calendarId: process.env.calendarID,
                requestBody: {
                    'summary': 'Lista della spesa',
                    'description': newEvent.description,
                    'start': newEvent.start,
                    'end': newEvent.end
                },
            });
            console.log('new Event created');
            // console.log(`Event ${eventInsertRes.data.id} created\nEvent summary -> ${eventInsertRes.data.summary}\nEvent desc -> ${eventInsertRes.data.description}\nEvent start -> ${eventInsertRes.data.start}\nEvent end -> ${eventInsertRes.data.end}`);
        }catch(err) {return console.log('Event insert -> : The API returned an error: ' + err);}
    }
}
function createEvent(CALENDAR_DATA){
    let dataRecipes = JSON.parse(CALENDAR_DATA);

    let stringaSpesa = 'Lista della spesa di oggi:\n\nAlimenti per ricette:\n';

    let dataRecipesKeys = Object.keys(dataRecipes['Recipes']);

    dataRecipesKeys.forEach(el => {
        // Aggiungo nome ricetta
        stringaSpesa += el + '\n';
        dataRecipes['Recipes'][el].forEach(singleEl => {
            // Aggiungo nome ogni ingrediente
            stringaSpesa += '   ' + singleEl + '\n';
        })
    })
    stringaSpesa += '\nAlimenti Singoli:\n';

    dataRecipes['Ing'].forEach(el => {
        stringaSpesa += el + '\n';
    })

    let date = new Date();
    let day = String(date.getDate()).padStart(2, '0');
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let year = date.getFullYear();
    let today = `${year}-${month}-${day}`;
    let event = {
        'summary' : 'Lista della spesa',
        'description': stringaSpesa,
        'start': {
            'date': today,
            'timeZone': 'Europe/Rome'
        },
        'end': {
            'date': today,
            'timeZone': 'Europe/Rome'
        }
    }
    return event;
}
const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.json());
app.use(cors());

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */

app.get('/recipe', (req, res) => {
    axiosRecipe(req.query.recipe).then(resp => res.send(resp));
});
app.get('/singleRecipe', (req, res) => {
    let toHash = req.query.recipeLabel + 'singleRecipe';
    let hash = toHash.hashCode();
    // Cerco ricetta Cached in base all'hash
    searchCache(hash).then(resp => {
        if(resp){
            console.log('Cached recipe found');
            res.send(resp.data.recipe);
        } else axios_get_single_recipe(req.query.selfUrl).then(resp => {
            console.log('No recipe found in cache');
            // Check recipe not null
            if(resp) cacheFunc(resp);
            res.send(resp);
        });
    });
});
app.get('/singleIng', (req, res) => {
    let hash = req.query.ing.hashCode();

    searchCache(hash).then(resp => {
        if(resp){
            console.log('Cached Ingredient Details found');
            res.send(resp.data.recipe);
        } else axios_get_single_ing(req.query.ing).then(resp => {
            console.log('No Ingredient Details found in cache');
            resp.label = req.query.ing;
            if(resp) cacheFunc(resp);
            res.send(resp);
        });
    })
});
app.get('/ingredients', (req, res) => {
    console.log('Ricevuta richiesta ing')
    axios_ing_search(req.query.ing).then(resp => res.send(resp));
});

var CALENDAR_DATA = null;

app.post('/calendar', (req, res) => {

    CALENDAR_DATA = null;
    CALENDAR_DATA = req.body.list;

    try{
        const credentials = fs.readFileSync('./credentials.json');
        authorize(JSON.parse(credentials), addEvent, CALENDAR_DATA).then(authUrl => {
            if(authUrl) res.send(authUrl);
            else res.send('Procedura inserimento dati in Calendar avviata');
        }).catch(err1 => {
            console.log(err1);
            res.send(err1);
        })
    }catch(err) {
        console.log('fs.readFileSync err -> ' + err + '\n');
        res.sendStatus(500);
    }
    // res.send('No authUrl to send');
});
app.get('/oauth2callback', (req, res) => {
    let tokenCode = req.query.code;

    fs.readFile('./credentials.json', (err, content) => {
        let credentials = JSON.parse(content);

        const {client_secret, client_id, redirect_uris} = credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);

        oAuth2Client.getToken(tokenCode, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
    
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile('./token.json', JSON.stringify(token), (err) => {
                if (err) return console.error(err);
            });
        });

        console.log('Token created');
    });
})
app.listen(8888);
console.log('Listening on 8888');