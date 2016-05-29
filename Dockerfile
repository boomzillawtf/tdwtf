FROM node:4

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ENV NODE_ENV=production \
    daemon=false \
    silent=false

COPY NodeBB/package.json /usr/src/app/
RUN npm install
COPY NodeBB /usr/src/app

COPY plugins /usr/src/app/plugins
RUN npm install ./plugins/*/ `cat ./plugins/other.txt`

RUN echo public/uploads/*/ > .make-uploads-folders

# the default port for NodeBB is exposed outside the container
EXPOSE 4567

VOLUME /usr/src/app/docker
VOLUME /usr/src/app/public/uploads

# save the config in a volume so the container can be discarded
RUN ln -s /usr/src/app/docker/config.json /usr/src/app/config.json

# make sure the uploads subdirectories exist, run any database migrations,
# and set the container's process as the NodeBB daemon so ./nodebb works
CMD cat .make-uploads-folders | xargs mkdir -p \
&& ./nodebb upgrade \
&& echo 1 > pidfile \
&& exec node loader.js
