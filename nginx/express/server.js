'use strict'

require('dotenv').config({path: '.env'});
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const amqp = require('amqplib/callback_api');
const {google} = require('googleapis');
const fs = require('fs');
const open = require('open');

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
// Gli interceptors, appunto intercettano Axios Request e Response e eseguono una funz.
// Mandare i log a CouchDB
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
// Async/Await method, provare Promise method per axios request
async function axiosRecipe(recipe){
    try{
        let res = await axios({
            method: 'GET',
            url: 'https://api.edamam.com/api/recipes/v2?type=public&q=' + recipe + '&app_id=' + process.env.EDAMAM_APP_ID_RECIPE + '&app_key=' + process.env.EDAMAM_APP_KEY_RECIPE
        })
        if(res.status == 200){
            console.log('Ricetta Ottenuta');
            // fs.writeFile("avocadoRecipesList.json", JSON.stringify(res.data.hits), (err, result) => {
            //     if(err) console.log(err);
            // })
            return res.data.hits;
        } else return null;
    } catch(err){
        console.log(err.response.status);
    }
}
// Manda richiesta ricetta singola e restituisce i valori della singola ricetta per costruire il DivRicetta sulla Homepage
async function axiosGetSingleRecipe(url){
    try{
        let res = await axios({
            method: 'GET',
            url: url + '&app_id=' + process.env.EDAMAM_APP_ID_RECIPE + '&app_key=' + process.env.EDAMAM_APP_KEY_RECIPE,
        })
        if(res.status == 200){
            console.log('Ricetta Ottenuta');
            // fs.writeFile("avocadoRecipesList.json", JSON.stringify(res.data.hits), (err, result) => {
            //     if(err) console.log(err);
            // })
            return res.data.recipe;
        } else return null;
    } catch(err){
        console.log(err.response.status);
    }
}
async function axiosngSearch(ing){
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
async function axiosGetSingleIng(ing){
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
async function cacheFunc(toCache){
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

const TOKEN_PATH = '../token.json';
const SCOPES = [
    //SCOPES per CalendarList: list, Calendar.insert, Event:update, Event:insert
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar',
    // SCOPES per Event:list, Event:update, Event:insert
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/calendar.events'
];

function authorize(credentials, callback, CALENDAR_DATA) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
  
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) getAccessToken(oAuth2Client);
        else{
            oAuth2Client.setCredentials(JSON.parse(token));
            callback(oAuth2Client, CALENDAR_DATA);
        }
    });
}
function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('Request authUrl');
    console.log(authUrl);
    // open(authUrl);
}
async function addEvent(auth, CALENDAR_DATA) {
    const calendar = google.calendar({version: 'v3', auth});

    try{
        // Ottieni lista dei calendari del relativo account google
        const calendarListRes = await calendar.calendarList.list({});
        const calendars = calendarListRes.data.items;
        
        if(calendars.length){
            calendars.map((thisCalendar, i) => {
                // console.log(`${thisCalendar.summary} - ${thisCalendar.id}`);

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
                        return console.log(`Error in CalendarList -> \nthisCalendar -> ${JSON.stringify(thisCalendar)}\ncalendarID -> ${process.env.calendarID}`);
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
                fs.appendFileSync('../.env', `\ncalendarID = ${calendarInsertRes.data.id}`);
            } catch(err) {console.log(`Error in appendFileSync calendar insert -> ${err}`);}
            
            // Ricarico process.env cosi da caricare anche il valore appena inserito process.env.calendarID
            require('dotenv').config({path: '../.env'});
            
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
        } else axiosGetSingleRecipe(req.query.selfUrl).then(resp => {
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
        } else axiosGetSingleIng(req.query.ing).then(resp => {
            console.log('No Ingredient Details found in cache');
            resp.label = req.query.ing;
            if(resp) cacheFunc(resp);
            res.send(resp);
        });
    })
})
app.get('/ingredients', (req, res) => {
    console.log('Ricevuta richiesta ing')
    axiosngSearch(req.query.ing).then(resp => res.send(resp));
});

var CALENDAR_DATA = null;

app.post('/calendar', (req, res) => {

    CALENDAR_DATA = null;
    CALENDAR_DATA = req.body.list;
    
    fs.readFile('./credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Calendar API.
        authorize(JSON.parse(content), addEvent, CALENDAR_DATA);
    });

    res.send('Procedure to create event started');
})
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
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
            });
        });

        console.log('Token created');
    });
})
app.listen(8888);
console.log('Listening on 8888');