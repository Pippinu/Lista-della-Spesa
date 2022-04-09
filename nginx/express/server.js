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

// Richiede a Nutrition Data API i dati nutrizionali di 100gr dell'ingrediente singolo passato come parametro che corrisponde all'ingrediente 
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
    console.log(`search Cache -> Label hash -> ${labelHash}`);
    try{
        let res = await axios({
            method : 'GET',
            url : 'http://admin:password@host.docker.internal:5984/cache/' + labelHash,
        });
        console.log(`searchCase res -> \n ${res}`);
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

    // In caso non venga trovato il calendario 'Lista della spesa' ne creiamo uno
    if(process.env.calendarID == null || process.env.calendarID == undefined){
        try{
            // Provo a creare calendario con summary 'Lista della spesa'
            const calendarInsertRes = await calendar.calendars.insert({
                requestBody: {
                    'summary': 'Lista della spesa'
                },
            });
            // se tutto va bene provo a salvare il suo ID come calendarID sul file .env
            try{
                fs.appendFileSync('./.env', `\ncalendarID = ${calendarInsertRes.data.id}`);
            } catch(err) {console.log(`Error in appendFileSync calendar insert -> ${err}`);}
            
            // Ricarico process.env cosi da caricare anche il valore appena inserito process.env.calendarID
            require('dotenv').config({path: './.env'});
            
            console.log(`Calendar created with ID: ${process.env.calendarID}`);
        // In caso non riuscissi a creare 'Lista della spesa' restituisco un errore
        }catch(err){return console.log('Calendar Create -> The API returned an error: ' + err);}

        // Se tutto è andato per il verso giusto procedo alla vera aggiunta o eventuale modifica dell'evento 'Lista della Spesa'
        setEvent(calendar, CALENDAR_DATA);
        return true;
    } else {
        return console.log('Calendar Missmatch');
    }
}

// Funzione che gestisce la vera creazione o eventuale modifica dell'evento 'Lista della Spesa'
async function setEvent(calendar, CALENDAR_DATA){
    // console.log('im in setEvent');

    // Richiedo la lista degli eventi del calendario 'Lista della Spesa'
    const eventListRes = await calendar.events.list({
        calendarId: process.env.calendarID,
    });
        
    let eventID = null;
    eventListRes.data.items.map((e, i) => {
        // Se esiste gia un evento 'Lista della spesa modifico la var eventID con il suo ID
        if(e.summary == 'Lista della spesa'){
            console.log('Event found, lets update it');
            eventID = e.id;
        }
    });

    // Se l'evento 'Lista della spesa' è stato trovato, quindi 'eventID' non è nulla vado a modificare tale evento con i nuovi dati
    if(eventID){
        // Creo evento a partire dai dati forniti dall'utente
        let newEvent = createEvent(CALENDAR_DATA);

        // Provo a modificare l'evento 'Lista della spesa'
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
            // In caso di successo restituisco un messaggio di conferma avvenuta modifica
            return console.log(`Event id: ${eventUpdateRes.data.id} updated\n`);
        }catch(err) {return console.log('Event Update -> The API returned an error: ' + err);}
    // Se non esiste l'evento 'Lista della spesa' provo a crearne uno
    } else { 
        console.log('No Event found, lets create it');
        let newEvent = createEvent(CALENDAR_DATA);
        // Provo a creare l'evento 'Lista della Spesa'
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
            // In caso di successo restituisco un messaggi di conferma avvenuta creazione
            return console.log(`new Event id: ${eventInsertRes.data.id} created\n`);
            // console.log(`Event ${eventInsertRes.data.id} created\nEvent summary -> ${eventInsertRes.data.summary}\nEvent desc -> ${eventInsertRes.data.description}\nEvent start -> ${eventInsertRes.data.start}\nEvent end -> ${eventInsertRes.data.end}`);
        }catch(err) {return console.log('Event insert -> : The API returned an error: ' + err);}
    }
}

// Funzione che crea oggetto evento a partire dai dati forniti dall'utente e li restituisce a setEvent che li aggiungerà all'evento 'Lista della spesa'
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
 * @apiDefine Response Success-Response
 */

/**
 * @apiDefine Parameters Parameters
 */

/**
 * @api {get} /recipe Recipe List
 * @apiDescription Manage GET Request for Recipe List
 * @apiVersion 1.0.0
 * @apiName RecipeList
 * @apiGroup Recipe
 * 
 * @apiParam (Parameters) {String} recipe Recipe or Ingredient on which the research is based
 * 
 * @apiSuccess (Response) {JSON} resp List of recipes with title similar to the recipe title entered or which include the ingredient entered
 *
 * @apiSuccessExample Success-Response:
*  HTTP/1.1 200 OK
*  resp: [
    "recipe": {
        "uri": "string",
        "label": "string",
        "image": "string",
        "images": {
            "THUMBNAIL": {
                "url": "string",
                "width": 0,
                "height": 0
            },
            "SMALL": {
                "url": "string",
                "width": 0,
                "height": 0
            },
            "REGULAR": {
                "url": "string",
                "width": 0,
                "height": 0
            },
            "LARGE": {
                "url": "string",
                "width": 0,
                "height": 0
            }
        },
        "source": "string",
        "url": "string",
        "shareAs": "string",
        "yield": 0,
        "dietLabels": [
            "string"
        ],
        "healthLabels": [
            "string"
        ],
        "cautions": [
            "string"
        ],
        "ingredientLines": [
            "string"
        ],
        "ingredients": [
            {
                "text": "string",
                "quantity": 0,
                "measure": "string",
                "food": "string",
                "weight": 0,
                "foodId": "string"
            }
        ],
        "calories": 0,
        "glycemicIndex": 0,
        "totalCO2Emissions": 0,
        "co2EmissionsClass": "A+",
        "totalWeight": 0,
        "cuisineType": [
            "string"
        ],
        "mealType": [
            "string"
        ],
        "dishType": [
            "string"
        ],
        "totalNutrients": {},
        "totalDaily": {},
        "digest": [
            {
                "label": "string",
                "tag": "string",
                "schemaOrgTag": "string",
                "total": 0,
                "hasRDI": true,
                "daily": 0,
                "unit": "string",
                "sub": {}
            }
        ]
    },
    "_links": {
        "self": {
            "href": "string",
            "title": "string"
        },
        "next": {
            "href": "string",
            "title": "string"
        }
    }
}]
 * @apiError (4xx) 401 Unauthorized, <code>app_id</code> and/or <code>app_key</code> supplied to the request are invalid or correspond to another API
 * @apiErrorExample 401 Error-Response:
* HTTP/1.1 401
* [
    {
        "status": "error",
        "message": "Unauthorized <code>app_id</code> = xxxxxx. This <code>app_id</code> is for another API."
    }
]

 * @apiError (4xx) 400/403 A list of errors
 * @apiErrorExample 400/403 Error-Response:
 * HTTP/1.1 400/403 A list of errors
 * [
    {
        "errorCode": "string",
        "message": "string",
        "params": [
            "string"
        ]
    }
]
 */

// Manage GET Request for Recipe List
app.get('/recipe', (req, res) => {
    axiosRecipe(req.query.recipe).then(resp => res.send(resp));
});

/**
 * @api {get} /singleRecipe Single Recipe
 * @apiDescription Manage GET Request for Single Recipe
 * @apiVersion 1.0.0
 * @apiName SingleRecipe
 * @apiGroup Recipe
 *
 * @apiParam (Parameters) {String} recipeLabel Recipe name
 * @apiParam (Parameters) {String} selfUrl URL of the recipe to look for, taken from the recipe list obtained from the GET /recipe request
 *
 * @apiSuccess (Response) {JSON} resp Data related to the single recipe
 * @apiSuccessExample Success-Response:
    HTTP/1.1 200 OK
    "resp": {
        "uri": "string",
        "label": "string",
        "image": "string",
        "images": {
            "THUMBNAIL": {
                "url": "string",
                "width": 0,
                "height": 0
            },
            "SMALL": {
                "url": "string",
                "width": 0,
                "height": 0
            },
            "REGULAR": {
                "url": "string",
                "width": 0,
                "height": 0
            },
            "LARGE": {
                "url": "string",
                "width": 0,
                "height": 0
            }
        },
        "source": "string",
        "url": "string",
        "shareAs": "string",
        "yield": 0,
        "dietLabels": [
            "string"
        ],
        "healthLabels": [
            "string"
        ],
        "cautions": [
            "string"
        ],
        "ingredientLines": [
            "string"
        ],
        "ingredients": [
            {
                "text": "string",
                "quantity": 0,
                "measure": "string",
                "food": "string",
                "weight": 0,
                "foodId": "string"
            }
        ],
        "calories": 0,
        "glycemicIndex": 0,
        "totalCO2Emissions": 0,
        "co2EmissionsClass": "A+",
        "totalWeight": 0,
        "cuisineType": [
            "string"
        ],
        "mealType": [
            "string"
        ],
        "dishType": [
            "string"
        ],
        "totalNutrients": {},
        "totalDaily": {},
        "digest": [
            {
                "label": "string",
                "tag": "string",
                "schemaOrgTag": "string",
                "total": 0,
                "hasRDI": true,
                "daily": 0,
                "unit": "string",
                "sub": {}
            }
        ]
    }

 * @apiError (4xx) 401 Unauthorized, 'app_id' e/o 'app_key' supplied to the request are invalid or correspond to another API.
 *
 * @apiErrorExample 401 Error-Response:
    HTTP/1.1 401
    [
        {
            "status": "error",
            "message": "Unauthorized app_id = xxxxxx. This app_id is for another API."
        }
    ]

 * @apiError (4xx) 400/403/404 A list of errors
   @apiErrorExample 400/403/404 Error-Response:
    HTTP/1.1 400/403/404
    [
        {
            "errorCode": "string",
            "message": "string",
            "params": [
                "string"
            ]
        }
    ]
 *
 */

// Manage GET Request for single recipe
app.get('/singleRecipe', (req, res) => {
    let toHash = req.query.recipeLabel + 'single';
    let hash = toHash.hashCode();
    console.log(`Hash of recipe ${req.query.recipeLabel} -> ${hash}`);
    // Cerco ricetta Cached in base all'hash
    searchCache(hash).then(resp => {
        // Se ricetta presente in Cache la restituisco immediatamente all'utente senza creare una nuova richiesta alla API
        console.log(`Response from searchCache(${hash} -> ${resp})`);
        if(resp){
            console.log('Cached recipe found');
            res.send(resp.data.recipe);
        // Se ricetta non presente nella Cache, richiedo tale ricetta e prima di restiuirla all'utente la salvo in Cache
        } else axios_get_single_recipe(req.query.selfUrl).then(resp => {
            console.log('No recipe found in cache, im asking to the API\n');
            console.log(`axios_get_single_recipe resp.label -> ${resp.label}`);
            // Check recipe not null
            if(resp) cacheFunc(resp);
            res.send(JSON.stringify(resp));
        }).catch(err => {
            console.log(`axios_get_single_recipe Error -> ${err} \n`);
        });
    });
});

/**
 * @api {get} /singleIng Single Ingredient
 * @apiName singleIng
 * @apiVersion 1.0.0
 * @apiGroup Ingredient
 * @apiDescription Manage GET Request for Single Ingredient
 *
 * @apiParam (Parameters) {String} ing Ingredient to search for
 *
 * @apiSuccess (Response) {JSON} resp Nutritional Data related to 100gr of the given Ingredient
 *
 * @apiSuccessExample Success-Response:
    HTTP/1.1 200 OK
    "resp": {
        "uri": "string",
        "calories": 0,
        "totalWeight": 0,
        "dietLabels": [
            "string"
        ],
        "healthLabels": [
            "string"
        ],
        "cautions": [
            "string"
        ],
        "totalNutrients": {
            "ENERC_KCAL": {
                "label": "string",
                "quantity": 0.0,
                "unit": "string"
            },
            "FAT": {
                "label": "string",
                "quantity": 0.0,
                "unit": "string"
            },
            "FASAT": {
                "label": "string",
                "quantity": 0.0,
                "unit": "string"
            },
            "FAMS": {},
            "FAPU": {},
            "CHOCDF": {},
            "FIBTG": {},
            "SUGAR": {},
            "PROCNT": {},
            "CHOLE": {},
            "NA": {},
            "CA": {},
            "MG": {},
            "K": {},
            "FE": {},
            "ZN": {},
            "P": {},
            "VITA_RAE": {},
            "VITC": {},
            "THIA": {},
            "RIBF": {},
            "NIA": {},
            "VITB6A": {},
            "FOLDFE": {},
            "FOLFD": {},
            "FOLAC": {},
            "VITB12": {},
            "VITD": {},
            "TOCPHA": {},
            "VITK1": {},
            "WATER": {}
        },
        "totalDaily": {
            "ENERC_KCAL": {
                "label": "string",
                "quantity": 0.0,
                "unit": "%"
            },
            "FAT": {
                "label": "string",
                "quantity": 0.0,
                "unit": "%"
            },
                "FASAT": {
                "label": "string",
                "quantity": 0.0,
                "unit": "%"
            },
            "CHOCDF": {},
            "FIBTG": {},
            "PROCNT": {},
            "CHOLE": {},
            "NA": {},
            "CA": {},
            "MG": {},
            "K": {},
            "FE": {},
            "ZN": {},
            "P": {},
            "VITA_RAE": {},
            "VITC": {},
            "THIA": {},
            "RIBF": {},
            "NIA": {},
            "VITB6A": {},
            "FOLDFE": {},
            "VITB12": {},
            "VITD": {},
            "TOCPHA": {},
            "VITK1": {}
        },
        "totalNutrientsKCal": {
            "ENERC_KCAL": {
                "label": "string",
                "quantity": 0,
                "unit": "kcal"
            },
            "PROCNT_KCAL": {
                "label": "string",
                "quantity": 0,
                "unit": "kcal"
            },
            "FAT_KCAL": {
                "label": "string",
                "quantity": 0,
                "unit": "kcal"
            },
            "CHOCDF_KCAL": {
                "label": "string",
                "quantity": 0,
                "unit": "kcal"
            }
        }
    }
 * @apiError (304) not_modified
 * @apiError (404) not_found The specified URL was not found or couldn't be retrieved
 * @apiError (409) etag_missmatch The provided ETag token does not match the input data
 * @apiError (422) unprocessable_entity Couldn't parse the recipe or extract the nutritional info
 * @apiError (555) insufficient_quality Recipe with insufficient quality to process correctly
 */

// Manage GET Request for single ingredient
app.get('/singleIng', (req, res) => {
    let toHash = req.query.ing + 'single';
    let hash = toHash.hashCode();
    console.log(`Hash of ingredient ${req.query.ing} -> ${hash}`);
    // Cerco ingrediente Cached in base all'hash
    searchCache(hash).then(resp => {
        // Se ingrediente presente in Cache lo restituisco immediatamente all'utente senza creare una nuova richiesta alla API
        if(resp){
            console.log('Cached Ingredient Details found');
            res.send(resp.data.recipe);
        // Se ingrediente non presente nella Cache, richiedo tale ingrediente e prima di restiuirlo all'utente la salvo in Cache
        } else axios_get_single_ing(req.query.ing).then(resp => {
            console.log('No Ingredient Details found in cache');
            resp.label = req.query.ing;
            if(resp) cacheFunc(resp);
            res.send(resp);
        });
    })
});

/**
 * @api {get} /ingredients Single Ingredients List
 * @apiVersion 1.0.0
 * @apiName singleIngredientsList
 * @apiGroup Ingredient
 * @apiDescription Manage GET Request for ingredients list
 *
 * @apiParam (Parameters) {String} ing Ingredient on which the research is based
 *
 * @apiSuccess (Response) {String} resp List of ingredient with title similar or that include the one entered
 *
 * @apiSuccessExample Success-Response:
    HTTP/1.1 200 OK
    
"resp": [
    {
        "food": {
            "foodId": "food_b0yuze4b1g3afpanijno5abtiu28",
            "label": "Avocado",
            "nutrients": {
            "ENERC_KCAL": 160,
            "PROCNT": 2,
            "FAT": 14.66,
            "CHOCDF": 8.53,
            "FIBTG": 6.7
            },
            "category": "Generic foods",
            "categoryLabel": "food",
            "image": "https://www.edamam.com/food-img/984/984a707ea8e9c6bf5f6498970a9e6d9d.jpg"
        },
        "measures": [
            {
            "uri": "URI",
            "label": "Whole",
            "weight": 0
            },
            {
            "uri": "URI",
            "label": "Serving",
            "weight": 0
            },
            {
            "uri": "URI",
            "label": "Strip",
            "weight": 0
            },
        ]
    }
]
    
 *
 * @apiError (404) URLNotFound The specified <code>URL</code> was not found or couldn’t be retrieved
 * @apiErrorExample 404 Error-Response:
 *  HTTP/1.1 404 UrlNotFound
    [
        {
            "errorCode": "string",
            "message": "string",
            "params": [
                "string"
            ]
        }
    ]
 */

app.get('/ingredients', (req, res) => {
    console.log('Ricevuta richiesta ing')
    axios_ing_search(req.query.ing).then(resp => res.send(resp));
});

/**
 * @api {post} /calendar Google Calendar Event
 * @apiVersion 1.0.0
 * @apiName calendar
 * @apiGroup Calendar
 * @apiDescription Create or Modify <code>Lista della Spesa</code> Google Calendar event.
 * <br><br> This request is divided in 2 phase:
 * <br><br> Phase 1: Authorization
 * <br> The first phase is based of Google API Authorization, based of <code>credential.json</code> and <code>SCOPES</code>, an <code>authUrl</code> is created, returned and displayed to the user through a <code>Bootstrap Modal</code>
 * <br> The user will follow this <code>URL</code>, access and authorize using a Google Account, from which Google Calendar is synchronized.
 * <br> After that the user will be redirected to <code>callback.html</code>, a simple html page that inform the user that authorization is completed and that page can be closed.
 * <br> Simultaneously a <code>GET /oauth2callback</code> Request is sent to this Server with <code>tokenCode</code> parameter, this <code>tokenCode</code> is used to create Token, used in every request to Google Calendar API, and to store <code>token.json</code>, the token file.
 * <br><br> Phase 2: Event insert or modify
 * <br> The second phase is based on Google Calendar Event <code>Lista della Spesa</code> creation of modification.
 * <br> After the user have chosen Single Ingredients and Recipes with ingredients, a JSON Object is created and sent to this Server through <code>POST /calendar</code> request.
 * <br> If <code>Lista della spesa</code> calendar is not found, a new one is created with summary "Lista della Spesa".
 * <br> If <code>Lista della spesa</code> event is found in calendar <code>Lista della Spesa</code>, then this will be modified with JSON Data passed.
 * <br> If <code>Lista della spesa</code> event is not found in calendar <code>Lista della Spesa</code>, a new one is created with JSON Data passed.
 *
 * @apiBody {JSON} list JSON Data that summarizes Single Ingredients and Recipes with ingredients
 *
 * @apiSuccess (Response) {URL} authUrl Authorization URL used to authorize Google Calendar API
 * @apiSuccess (Response) {String} string Confirmation String
 *
 * @apiError (500) 500 fs.readFileSync Error, the given file is not found
 * @apiError (General Error) Err1 General Error of Google Calendar insert add or modify
 */

// Creo la var che andrà a contenere i dati forniti dall'utente
var CALENDAR_DATA = null;
// Gestisce la richiesta POST per creazione o eventuale modifica dell'evento 'Lista della Spesa'
app.post('/calendar', (req, res) => {

    // Resetto la var prima di effettuare una nuova richiesta, sicuramente un istruzione inutile, but still :D
    CALENDAR_DATA = null;
    // Ottengo i dati dalla richiesta GET che l'utente vuole salvare sull'evento 'Lista della spesa'
    CALENDAR_DATA = req.body.list;

    // Se le credenziali per un eventuale richiesta alla API sono presenti avvio il procedimento per la creazione
    // o eventuale modifica dell'evento 'Lista della spesa'
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

// Gestisce richiesta GET create dopo che l'utente ha completato il procedimento di autorizzazione Google OAuth
app.get('/oauth2callback', (req, res) => {
    // Salvo il tokenCode che sarà utilizzato per la creazione del Token che serve per le successive richieste alla Google Calendar API
    let tokenCode = req.query.code;

    fs.readFile('./credentials.json', (err, content) => {
        let credentials = JSON.parse(content);

        const {client_secret, client_id, redirect_uris} = credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);

        oAuth2Client.getToken(tokenCode, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
    
            oAuth2Client.setCredentials(token);
            // Creo il file token.json utilizzato nelle prossime richieste a Google Calendar API
            fs.writeFile('./token.json', JSON.stringify(token), (err) => {
                if (err) return console.error(err);
            });
        });

        console.log('Token created');
    });
})
app.listen(8888);
console.log('Listening on 8888');