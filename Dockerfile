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

COPY emoji/emojione/assets/svg /usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images
COPY emoji/emojione/LICENSE.md /usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images/
RUN node -e 'require("nodebb-plugin-emoji-one/lib/set/update/index").build("/usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images")'

COPY emoji/tdwtf /usr/src/app/tdwtf-emoji
RUN mkdir -p /usr/src/app/node_modules/nodebb-plugin-emoji-static/public/static/images && ln -s /usr/src/app/tdwtf-emoji /usr/src/app/node_modules/nodebb-plugin-emoji-static/public/static/images/tdwtf

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
