---
title: App Config Inject
---

### App Config Inject

A separate package called `@lcdev/app-config-inject` exists to configure frontend
applications at runtime.

The `app-config-inject` binary parses HTML and injects app-config values at runtime.
This is useful for frontend applications that need to be configured with deploying.
In particular, it allows you to have one docker image that can be re-used with
different frontend configurations (eg. enabling beta features, changing API URLs, 
or theming).

An example dockerfile:

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
