FROM node:14-alpine

WORKDIR /app-config

COPY . .

RUN yarn install --frozen-lockfile

WORKDIR /app-config/app-config-cli

RUN yarn build

WORKDIR /app-config

RUN find . ! -type d \
  ! -name "package.json" \
  ! -name "yarn.lock" \
  ! -path "*dist*" \
  ! -path "*index.js" \
  -delete

RUN yarn install --production --frozen-lockfile

FROM node:14-alpine
RUN apk add --no-cache tini

COPY --from=0 /app-config /app-config

ENTRYPOINT [\
  "/sbin/tini", "--",\
  "node", "/app-config/app-config-cli/dist/index.js"\
]
