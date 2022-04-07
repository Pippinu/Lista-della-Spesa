FROM node:17

WORKDIR /webApp
COPY . .
RUN npm install
EXPOSE 8888

ENTRYPOINT ["node", "server.js"]