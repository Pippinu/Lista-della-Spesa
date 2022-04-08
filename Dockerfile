FROM nginx:latest
WORKDIR /
# COPY, appunto, copia il contenuto a sinistra nell'indirizzo a destra.
# Usare questa istruzione per copiare da windows nel container le pagine web Client
COPY ./nginx/static /usr/share/nginx/html
COPY ./nginx/static/default.conf /etc/nginx/conf.d/default.conf