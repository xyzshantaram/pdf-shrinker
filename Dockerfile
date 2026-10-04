FROM docker.io/denoland/deno:2.9.7 AS build

WORKDIR /app

COPY deno.json deno.lock ./
RUN deno install --frozen

COPY . .
RUN deno task build

FROM docker.io/denoland/deno:2.9.7

ARG GIT_REVISION
ENV DENO_DEPLOYMENT_ID=${GIT_REVISION}

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ghostscript \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/deno.json /app/deno.lock ./
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/_fresh /app/_fresh
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && deno cache _fresh/server.js

ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
