FROM nodebb/docker:v1.12.2

WORKDIR /usr/src/app

RUN wget -O /tini https://github.com/krallin/tini/releases/download/v0.18.0/tini \
 && echo '12d20136605531b09a2c2dac02ccee85e1b874eb322ef6baf7561cd93f93c855 /tini' | sha256sum -c \
 && chmod +x /tini

ENTRYPOINT ["/tini", "--"]

COPY watchdog.bash /usr/src/app/

ENV NODE_ENV=production \
    daemon=true \
    silent=false

RUN apt-get update \
 && apt-get install -y webp \
 && rm -rf /var/lib/apt/lists/*

# Disable daemon in the code, but keep daemon enabled in the config so PID works.
RUN sed -e "s/require('daemon')/if (false) &/" -i /usr/src/app/loader.js

RUN sed -e "s/var mediumMin = \\([0-9]\\+\\);/var mediumMin = !window.localStorage['unresponsive-settings'] || JSON.parse(window.localStorage['unresponsive-settings']).responsive ? \\1 : 0;/" -i /usr/src/app/node_modules/nodebb-plugin-composer-default/static/lib/composer/resize.js

COPY plugins /usr/src/app/plugins
RUN npm install --save ./plugins/*/ nodebb-plugin-shortcuts@1.1.2 nodebb-plugin-htmlcleaner@0.2.4

RUN node -e 'require("nodebb-plugin-emoji-one/emoji").defineEmoji({packs:[]},function(err){if(err){console.error(err);process.exit(1)}})'

COPY emoji/tdwtf /usr/src/app/tdwtf-emoji
RUN cd /usr/src/app/tdwtf-emoji && node -p 'var dict={};fs.readdirSync(__dirname).filter(function(e){return e!=="dictionary.json"}).forEach(function(e){dict[e.replace(/\.[^.]+$/,"")]={aliases:[e],image:e}});JSON.stringify(dict)' > /usr/src/app/tdwtf-emoji/dictionary.json
COPY emoji/fontawesome.json /usr/src/app/tdwtf-emoji/

RUN echo public/uploads/*/ > .make-uploads-folders

# PULL REQUESTS
# delete these steps as the pull requests get merged into the upstream repo
RUN curl -sSL https://github.com/BenLubar/NodeBB/commit/a2892b0bce24f9d0dad53943dbc887b0d52236bf.diff | patch -p1
RUN cd node_modules/nodebb-plugin-tdwtf-buttons && curl -sSL https://patch-diff.githubusercontent.com/raw/NedFodder/nodebb-plugin-tdwtf-buttons/pull/2.diff | patch -p1

ADD iframely-date.diff /usr/src/app/node_modules/nodebb-plugin-iframely/
RUN cd node_modules/nodebb-plugin-iframely && patch -p1 < iframely-date.diff

VOLUME /usr/src/app/docker
VOLUME /usr/src/app/public/uploads

# save the config in a volume so the container can be discarded
RUN ln -s /usr/src/app/docker/config.json /usr/src/app/config.json

# make sure the uploads subdirectories exist and run any database migrations.
CMD cat .make-uploads-folders | xargs mkdir -p \
 && ./nodebb upgrade --schema --build \
 && rm -f pidfile \
 && bash -c './watchdog.bash &' \
 && exec node ./nodebb start
