FROM node:17

WORKDIR /rabbitmqcache
COPY . .

RUN npm install axios
RUN npm install amqplib
RUN npm install dotenv

ENTRYPOINT ["node", "DBCacheReceiver.js"]