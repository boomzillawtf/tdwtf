FROM buildpack-deps:jessie

# gpg keys listed at https://github.com/nodejs/node
RUN set -ex \
  && for key in \
    9554F04D7259F04124DE6B476D5A82AC7E37093B \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    0034A06D9D9B0064CE8ADF6BF1747F4AD2306D93 \
    FD3A5288F042B6850C66B31F09FE44734EB7990E \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    B9AE9905FFD7803F25714661B63B535A4C206CA9 \
    C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
  ; do \
    gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$key"; \
  done

ENV NPM_CONFIG_LOGLEVEL info
ENV NODE_VERSION 4.4.7

RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION.tar.xz" \
  && curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && mkdir -p /usr/src/node \
  && tar -xJf "node-v$NODE_VERSION.tar.xz" -C /usr/src/node --strip-components=1 \
  && rm "node-v$NODE_VERSION.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
  && cd /usr/src/node \
  && (echo '--- deps/v8/src/gdb-jit.cc	2016-06-28 16:08:23.000000000 -0500'; \
      echo '+++ deps/v8/src/gdb-jit.cc	2016-07-21 10:51:08.572984926 -0500'; \
      echo '@@ -2128,7 +2128,7 @@'; \
      echo '       LineInfo* lineinfo = GetLineInfo(addr);'; \
      echo '       EmbeddedVector<char, 256> buffer;'; \
      echo '       StringBuilder builder(buffer.start(), buffer.length());'; \
      echo '-      builder.AddSubstring(event->name.str, static_cast<int>(event->name.len));'; \
      echo '+      builder.AddSubstring(event->name.str, std::min(static_cast<int>(event->name.len), buffer.length()));'; \
      echo '       // It'"'"'s called UnboundScript in the API but it'"'"'s a SharedFunctionInfo.'; \
      echo '       SharedFunctionInfo* shared ='; \
      echo '           event->script.IsEmpty() ? NULL : *Utils::OpenHandle(*event->script);') \
     | patch -u deps/v8/src/gdb-jit.cc \
  && ./configure --gdb \
  && make -j $(nproc) \
  && make install

CMD [ "node" ]
