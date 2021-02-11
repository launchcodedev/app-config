## App Config

This is a package for configuration loading in [App Config](https://app-config.dev).
It's also accessible through [@app-config/main](https://www.npmjs.com/package/@app-config/main).

```typescript
import { loadValidatedConfig, ConfigLoadingOptions } from '@app-config/config';

const { fullConfig } = await loadValidatedConfig();
```

The API of this module is documented via TypeScript definitions.

Read the [Introduction](https://app-config.dev/guide/intro/) or
[Quick Start](https://app-config.dev/guide/intro/quick-start/) guides on our website.
