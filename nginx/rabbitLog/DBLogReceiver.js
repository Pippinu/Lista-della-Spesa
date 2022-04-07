require('dotenv').config({path: '.env'});
const amqp = require('amqplib/callback_api');
const axios = require('axios');

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
function getDateTime(){
  var currentdate = new Date(); 
  var datetime = "Last Sync: " + currentdate.getDate() + "/"
                  + (currentdate.getMonth()+1)  + "/" 
                  + currentdate.getFullYear() + " @ "  
                  + currentdate.getHours() + ":"  
                  + currentdate.getMinutes() + ":" 
                  + currentdate.getSeconds();

  return datetime;
}
async function axiosCreateDB(){
  try{
    let res = await axios({
      method: 'PUT',
      url: 'http://' + process.env.COUCH_USER + ':' + process.env.COUCH_PASS + '@host.docker.internal:5984/logdb',
    })
    console.log('Database created');
    return true;

  } catch(error){
      if(error.response.status == 412){
        console.log(error.response.status + ' -> ' + error.response.data.reason);
        return true;
      } else {
          console.log('Error status -> ' + error.response.status);
          return false;
      }
  }
}
async function axiosAddLog(hash, log){
  try{
    let res = await axios({
      method: 'PUT',
      url: 'http://' + process.env.COUCH_USER + ':' + process.env.COUCH_PASS + '@host.docker.internal:5984/logdb/' + hash,
      data: {
        "log" : log,
        "date" : getDateTime(),
      }
    })
    console.log('Logged -> ' + log + ' with Hash as Key -> ' + hash);
    return true;
  } catch(error){
      console.log('Error status -> ' + error.response.status);
      return false;
  }
}

amqp.connect('amqp://host.docker.internal:55672', function(error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function(error1, channel) {
    if (error1) {
      throw error1;
    }
    const exchange = 'mainEx';
    const topicQueue = 'logQueue'

    channel.assertExchange(exchange, 'topic', {
      durable: false
    });

    channel.assertQueue(topicQueue, {}, function(error2, q) {
        if (error2) {
          throw error2;
        }
        channel.bindQueue(q.queue, exchange, 'DBlog');
        console.log(' [*] Waiting for logs. To exit press CTRL+C');

        channel.consume(q.queue, function(msg){
          let msgToHash = msg.content.toString() + ' ' + Date.now();
          let hash = msgToHash.hashCode();

          axiosCreateDB().then(res => {
            if(!res){
              throw 'ERRORE CREAZIONE DB';
            }

            axiosAddLog(hash, msg.content.toString()).then(res => {
              if(!res){
                throw 'ERRORE ADD LOG'
              }
            });
          });

        }, {
          noAck: true,
        });
    });
  });
});