FROM nodebb/docker:v1.7.4

WORKDIR /usr/src/app

COPY watchdog.bash /usr/src/app/

ENV NODE_ENV=production \
    daemon=false \
    silent=false

RUN sed -e "s/var mediumMin = \\([0-9]\\+\\);/var mediumMin = !window.localStorage['unresponsive-settings'] || JSON.parse(window.localStorage['unresponsive-settings']).responsive ? \\1 : 0;/" -i /usr/src/app/node_modules/nodebb-plugin-composer-default/static/lib/composer/resize.js

RUN ln -sf /usr/src/app/install/package.json /usr/src/app/package.json
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/6267.diff | patch -p1
RUN npm install

COPY plugins /usr/src/app/plugins
RUN npm install --save ./plugins/*/ nodebb-plugin-shortcuts@1.1.2

RUN node -e 'require("nodebb-plugin-emoji-one/emoji").defineEmoji({packs:[]},function(err){if(err){console.error(err);process.exit(1)}})'

COPY emoji/tdwtf /usr/src/app/tdwtf-emoji
COPY emoji/fontawesome/black/png/64 /usr/src/app/tdwtf-emoji/fontawesome
RUN cd /usr/src/app/tdwtf-emoji/fontawesome && rename 's/^/fa-/' -- *.png && rename 's/-/_/g' -- *.png && mv -- *.png /usr/src/app/tdwtf-emoji/ && cd .. && rmdir fontawesome
RUN cd /usr/src/app/tdwtf-emoji && node -p 'var dict={};fs.readdirSync(__dirname).forEach(function(e){dict[e.replace(/\.[^.]+$/,"")]={aliases:[e],image:e}});JSON.stringify(dict)' > /usr/src/app/tdwtf-emoji/dictionary.json

RUN echo public/uploads/*/ > .make-uploads-folders

# PULL REQUESTS
# delete these steps as the pull requests get merged into the upstream repo
RUN cd node_modules/nodebb-plugin-imagemagick && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-plugin-imagemagick/pull/6.diff | patch -p1
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/5185.diff | patch -p1
RUN cd node_modules/nodebb-plugin-tdwtf-buttons && curl -sSL https://patch-diff.githubusercontent.com/raw/NedFodder/nodebb-plugin-tdwtf-buttons/pull/2.diff | patch -p1

COPY youtube-embed-debug.diff /usr/src/app/node_modules/nodebb-plugin-youtube-embed/youtube-embed-debug.diff
RUN cd node_modules/nodebb-plugin-youtube-embed && cat youtube-embed-debug.diff | patch -p1

VOLUME /usr/src/app/docker
VOLUME /usr/src/app/public/uploads

# save the config in a volume so the container can be discarded
RUN ln -s /usr/src/app/docker/config.json /usr/src/app/config.json

# make sure the uploads subdirectories exist, run any database migrations,
# and set the container's process as the NodeBB daemon so ./nodebb works
CMD cat .make-uploads-folders | xargs mkdir -p \
&& ./nodebb build \
&& ./nodebb upgrade \
&& echo 1 > pidfile \
&& bash -c './watchdog.bash &' \
&& exec node loader.js
