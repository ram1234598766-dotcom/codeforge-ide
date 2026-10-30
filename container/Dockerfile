FROM node:24.20.0-trixie-slim

ENV NODE_ENV=production
ENV CODEFORGE_RUNTIME_HOME=/opt/codeforge-runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/codeforge-runtime
RUN npm install --prefix /opt/codeforge-runtime --no-audit --no-fund \
  react@19.3.1 react-dom@19.3.1 esbuild@0.28.2 tsx@4.23.15

COPY runner.py /usr/local/bin/codeforge-runner
RUN chmod 0555 /usr/local/bin/codeforge-runner

CMD ["sleep", "infinity"]
