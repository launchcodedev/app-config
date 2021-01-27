import { config, validateConfig } from '@lcdev/app-config';

validateConfig(config);

if (validateConfig.errors) {
  document.body.innerHTML = `Config Error: ${validateConfig.errors
    .map((err) => err.message)
    .join(', ')}`;
} else {
  document.body.innerHTML = `<pre>${JSON.stringify(config, null, 2)}</pre>`;
}
