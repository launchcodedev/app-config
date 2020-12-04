---
title: Kubernetes
---

### Kubernetes

You are, of course, welcome to use App Config however works best. Some tips when using k8s are outlined below.

### Inject `APP_CONFIG` as a Secret

Create a helm template that uses `app_config` as a Secret value, and expose the secret as `APP_CONFIG` in pods.

```sh
APP_CONFIG=$(NODE_ENV=production npx app-config create --secrets --format json)

helm install --set-string app_config="$APP_CONFIG" myapp ./myapp
```

### Using config values in helm templates

This can be accomplished using a script like:

```sh
TMP=$(mktemp -d)

npx app-config create --secrets \
  --fileNameBase ingress-nginx > $TMP/ingress-nginx.yml

helm upgrade --install ingress-nginx \
  ingress-nginx/ingress-nginx \
  --values $TMP/ingress-nginx.yml

rm -r $TMP
```
