FROM boomzillawtf/tdwtf:node-gdbjit

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY watchdog.bash /usr/src/app/

ENV NODE_ENV=production \
    daemon=false \
    silent=false

COPY NodeBB/package.json /usr/src/app/
RUN npm install
COPY NodeBB /usr/src/app

RUN sed -e "s/Meta\\.config\\['cache-buster'\\] = utils\\.generateUUID();/Meta.config['cache-buster'] = os.hostname();/" -i /usr/src/app/src/meta.js \
&& sed -e "s/config\\['cache-buster'\\] = utils\\.generateUUID();/config['cache-buster'] = require('os').hostname();/" -i /usr/src/app/src/meta/configs.js \
&& sed -e "s/waitSeconds: 3,/waitSeconds: 0,/" -i /usr/src/app/src/views/partials/requirejs-config.tpl

COPY plugins /usr/src/app/plugins
RUN npm install ./plugins/*/ `cat ./plugins/other.txt`

COPY emoji/emojione/assets/svg /usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images
COPY emoji/emojione/LICENSE.md /usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images/
RUN node -e 'require("nodebb-plugin-emoji-one/lib/set/update/index").build("/usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images")'

COPY emoji/tdwtf /usr/src/app/tdwtf-emoji
COPY emoji/fontawesome/black/png/64 /usr/src/app/tdwtf-emoji/fontawesome
RUN cd /usr/src/app/tdwtf-emoji/fontawesome && rename 's/^/fa-/' -- *.png && rename 's/-/_/g' -- *.png && mv -- *.png /usr/src/app/tdwtf-emoji/ && cd .. && rmdir fontawesome
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
CMD rm -f /var/tmp/elfdump*-*.o \
&& cat .make-uploads-folders | xargs mkdir -p \
&& ./nodebb upgrade \
&& echo 1 > pidfile \
&& exec node --gdbjit --gdbjit_dump loader.js
