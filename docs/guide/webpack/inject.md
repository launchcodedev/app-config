---
title: App Config Inject
---

The `app-config-inject` binary parses HTML and injects app-config values at runtime.
This is useful for frontend applications that need to be configured at deploy time.
In particular, it allows you to have one docker image that can be re-used with
different frontend configurations.

An example:

```dockerfile{5,7,14}
FROM nginx:1.15-alpine

RUN apk update && apk add nodejs npm

RUN npm i -g @lcdev/app-config-inject@2

ADD .app-config.schema.yml /etc/my-app/.app-config.schema.yml

ADD index.html /var/www/index-src.html

EXPOSE 80

CMD cat /var/www/index-src.html \
  | app-config-inject --schema-dir /etc/my-app > /usr/share/nginx/html/index.html \
  && nginx -g "daemon off;"
```

Note that app-config-inject needs to know what the config schema is.
In the dockerfile above, we've added it to `/etc/my-app` and used the `--schema-dir` option.
