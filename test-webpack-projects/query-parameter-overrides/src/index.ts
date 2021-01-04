import { config, validateConfig } from '@lcdev/app-config';
import merge from 'lodash.merge';

const queryParameters = new URLSearchParams(document.location.search);

let fullConfig: typeof config;

if (queryParameters.has('config')) {
  const overrides = JSON.parse(queryParameters.get('config')!);

  fullConfig = merge({}, config, overrides);
} else {
  fullConfig = config;
}

validateConfig(fullConfig);

if (validateConfig.errors) {
  document.body.innerHTML = `Config Error: ${validateConfig.errors
    .map((err) => err.message)
    .join(', ')}`;
} else {
  document.body.innerHTML = `<pre>${JSON.stringify(fullConfig, null, 2)}</pre>`;
}
