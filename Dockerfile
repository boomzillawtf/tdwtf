FROM nodebb/docker:v1.7.4

WORKDIR /usr/src/app

COPY watchdog.bash /usr/src/app/

ENV NODE_ENV=production \
    daemon=false \
    silent=false

RUN sed -e "s/var mediumMin = \\([0-9]\\+\\);/var mediumMin = !window.localStorage['unresponsive-settings'] || JSON.parse(window.localStorage['unresponsive-settings']).responsive ? \\1 : 0;/" -i /usr/src/app/node_modules/nodebb-plugin-composer-default/static/lib/composer/resize.js

COPY plugins /usr/src/app/plugins
RUN npm install --save ./plugins/*/ nodebb-plugin-shortcuts@1.1.2 nodebb-plugin-emoji@2.1.1

RUN node -e 'require("nodebb-plugin-emoji-one/emoji").defineEmoji({packs:[]},function(err){if(err){console.error(err);process.exit(1)}})'

COPY emoji/tdwtf /usr/src/app/tdwtf-emoji
RUN cd /usr/src/app/tdwtf-emoji && node -p 'var dict={};fs.readdirSync(__dirname).filter(function(e){return e!=="dictionary.json"}).forEach(function(e){dict[e.replace(/\.[^.]+$/,"")]={aliases:[e],image:e}});JSON.stringify(dict)' > /usr/src/app/tdwtf-emoji/dictionary.json
COPY emoji/fontawesome.json /usr/src/app/tdwtf-emoji/

RUN echo public/uploads/*/ > .make-uploads-folders

# PULL REQUESTS
# delete these steps as the pull requests get merged into the upstream repo
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/5185.diff | patch -p1
RUN cd node_modules/nodebb-plugin-tdwtf-buttons && curl -sSL https://patch-diff.githubusercontent.com/raw/NedFodder/nodebb-plugin-tdwtf-buttons/pull/2.diff | patch -p1
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/6266.diff | patch -p1
RUN cd node_modules/nodebb-plugin-mentions && curl -sSL https://patch-diff.githubusercontent.com/raw/julianlam/nodebb-plugin-mentions/pull/96.diff | patch -p1
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/6315.diff | patch -p1

# Remove this when we update NodeBB next
RUN curl -sSL https://github.com/NodeBB/NodeBB/commit/5302e79b564f057105be467f885e0018b0605c58.diff | patch -p1
RUN curl -sSL https://github.com/NodeBB/NodeBB/commit/8c9bae8ba388f94750130819106d240e90715be7.diff | patch -p1

COPY youtube-embed-debug.diff /usr/src/app/node_modules/nodebb-plugin-youtube-embed/youtube-embed-debug.diff
RUN cd node_modules/nodebb-plugin-youtube-embed && cat youtube-embed-debug.diff | patch -p1

VOLUME /usr/src/app/docker
VOLUME /usr/src/app/public/uploads

# save the config in a volume so the container can be discarded
RUN ln -s /usr/src/app/docker/config.json /usr/src/app/config.json

# make sure the uploads subdirectories exist, run any database migrations,
# and set the container's process as the NodeBB daemon so ./nodebb works
CMD cat .make-uploads-folders | xargs mkdir -p \
&& ./nodebb upgrade --schema --build \
&& echo 1 > pidfile \
&& bash -c './watchdog.bash &' \
&& exec node loader.js
