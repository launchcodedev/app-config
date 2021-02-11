---
title: Jest Testing
---

## Jest Testing

In Node.js, App Config might work without any configuration.

For Webpack projects, it might be a little more complicated, because you don't
call `loadConfig` first. App Config is fairly easy to mock in Jest.

```typescript
jest.mock('@app-config/main', () => {
  const config = {
    externalApiUrl: 'http://localhost:3002',
  };

  return {
    __esModule: true,
    config,
    default: config,
  };
});
```

You can use [manual mocks](https://jestjs.io/docs/en/manual-mocks.html#mocking-node-modules) as well, which might be more convenient.
