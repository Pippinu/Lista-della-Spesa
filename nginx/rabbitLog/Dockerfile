FROM node:17

WORKDIR /rabbitLog
COPY . .

RUN npm install axios
RUN npm install amqplib
RUN npm install dotenv

ENTRYPOINT ["node", "DBLogReceiver.js"]