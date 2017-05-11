FROM node:6

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY watchdog.bash /usr/src/app/

ENV NODE_ENV=production \
    daemon=false \
    silent=false

COPY NodeBB/package.json /usr/src/app/

RUN npm install
COPY NodeBB /usr/src/app

RUN sed -e "s/var mediumMin = \\([0-9]\\+\\);/var mediumMin = !window.localStorage['unresponsive-settings'] || JSON.parse(window.localStorage['unresponsive-settings']).responsive ? \\1 : 0;/" -i /usr/src/app/node_modules/nodebb-plugin-composer-default/static/lib/composer/resize.js

RUN sed -e "s/Meta\\.config\\['cache-buster'\\] = utils\\.generateUUID();/Meta.config['cache-buster'] = os.hostname();/" -i /usr/src/app/src/meta.js \
&& sed -e "s/config\\['cache-buster'\\] = utils\\.generateUUID();/config['cache-buster'] = require('os').hostname();/" -i /usr/src/app/src/meta/configs.js

COPY plugins /usr/src/app/plugins
RUN npm install ./plugins/*/ `cat ./plugins/other.txt`

RUN sed -e "s/https:\/\/raw\.githubusercontent\.com\/Ranks\/emojione\/master/https:\/\/raw.githubusercontent.com\/Ranks\/emojione\/2.2.7/" -i /usr/src/app/node_modules/nodebb-plugin-emoji-one/lib/set/update/index.js
COPY emoji/emojione/assets/svg /usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images
COPY emoji/emojione/LICENSE.md /usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images/
RUN node -e 'require("nodebb-plugin-emoji-one/lib/set/update/index").build("/usr/src/app/node_modules/nodebb-plugin-emoji-one/public/static/images")'

COPY emoji/tdwtf /usr/src/app/tdwtf-emoji
COPY emoji/fontawesome/black/png/64 /usr/src/app/tdwtf-emoji/fontawesome
RUN cd /usr/src/app/tdwtf-emoji/fontawesome && rename 's/^/fa-/' -- *.png && rename 's/-/_/g' -- *.png && mv -- *.png /usr/src/app/tdwtf-emoji/ && cd .. && rmdir fontawesome
RUN mkdir -p /usr/src/app/node_modules/nodebb-plugin-emoji-static/public/static/images && ln -s /usr/src/app/tdwtf-emoji /usr/src/app/node_modules/nodebb-plugin-emoji-static/public/static/images/tdwtf

RUN echo public/uploads/*/ > .make-uploads-folders

# PULL REQUESTS
# delete these steps as the pull requests get merged into the upstream repo
RUN cd node_modules/nodebb-plugin-imagemagick && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-plugin-imagemagick/pull/6.diff | patch -p1
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/5185.diff | patch -p1
RUN cd node_modules/nodebb-theme-persona && sed -i templates/partials/topic/post-menu-list.tpl -e 's/\r//' && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-theme-persona/pull/333.diff | patch -p1
RUN cd node_modules/nodebb-plugin-iframely && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-plugin-iframely/pull/27.diff | patch -p1
RUN cd node_modules/nodebb-plugin-composer-default && sed -i static/lib/composer/resize.js -e 's/\r//' && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-plugin-composer-default/pull/80.diff | patch -p1
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/5669.diff | patch -p1

# the default port for NodeBB is exposed outside the container
EXPOSE 4567

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
