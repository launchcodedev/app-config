---
title: Kubernetes
---

### Kubernetes

You are, of course, welcome to use App Config however works best. Some tips when using k8s are outlined below.

### Inject `APP_CONFIG` as a Secret

In a helm template, add the app-config opaque secret:

```yaml
{{- if .Values.config -}}
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: app-config
stringData:
  .json: {{ .Values.config | toJson | quote }}
{{- end }}
```

Instead of using a plain YAML file for helm values, perform a preprocessor step:

```sh
# use the output of app-config as a values file in Helm
helm upgrade --install my-app \
  ./my-app-chart \
  --values <(npx @app-config/cli create --secrets --fileNameBase my-app)
```

This allows you to have a Helm values file that looks like:

```yaml
config:
  # You could write the full config object here, or just "import it" from elsewhere
  $extends:
    - .app-config.yml
    - .app-config.secrets.yml

# other helm template values
```

In your pod/deployment spec, mount the secret as `APP_CONFIG`:

```yaml
{{- if .Values.config }}
env:
  - name: APP_CONFIG
    valueFrom:
      secretKeyRef:
        name: app-config
        key: .json
{{- end }}
```

This should keep app-config values in a Kubernetes secret, and provide access to it in your app.
This has the benefit of being able to use App Config values in Helm templates if you want (like HTTP ports, volume locations, etc).
