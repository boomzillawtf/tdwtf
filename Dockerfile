FROM node:6

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY watchdog.bash /usr/src/app/

ENV NODE_ENV=production \
    daemon=false \
    silent=false

COPY NodeBB/package.json /usr/src/app/

# Until composer is fixed:
# https://what.thedailywtf.com/post/1046960
# https://what.thedailywtf.com/post/1047038
RUN sed -e "s/\"nodebb-plugin-composer-default\": \"4\\.3\\.0\",/\"nodebb-plugin-composer-default\": \"4.2.13\",/" -i /usr/src/app/package.json

RUN npm install
COPY NodeBB /usr/src/app

# duplicate of above line for composer fix as we just overwrote package.json:
RUN sed -e "s/\"nodebb-plugin-composer-default\": \"4\\.3\\.0\",/\"nodebb-plugin-composer-default\": \"4.2.13\",/" -i /usr/src/app/package.json

RUN sed -e "s/Meta\\.config\\['cache-buster'\\] = utils\\.generateUUID();/Meta.config['cache-buster'] = os.hostname();/" -i /usr/src/app/src/meta.js \
&& sed -e "s/config\\['cache-buster'\\] = utils\\.generateUUID();/config['cache-buster'] = require('os').hostname();/" -i /usr/src/app/src/meta/configs.js

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

# PULL REQUESTS
# delete these steps as the pull requests get merged into the upstream repo
RUN cd node_modules/nodebb-plugin-imagemagick && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-plugin-imagemagick/pull/6.diff | patch -p1
RUN curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/NodeBB/pull/5185.diff | patch -p1
RUN cd node_modules/nodebb-theme-persona && sed -i templates/partials/topic/post-menu-list.tpl -e 's/\r//' && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-theme-persona/pull/333.diff | patch -p1
RUN cd node_modules/nodebb-plugin-iframely && curl -sSL https://patch-diff.githubusercontent.com/raw/NodeBB/nodebb-plugin-iframely/pull/27.diff | patch -p1

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
&& bash -c './watchdog.bash &' \
&& exec node loader.js
