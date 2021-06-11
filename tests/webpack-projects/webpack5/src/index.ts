import { config, validateConfig, currentEnvironment } from '@app-config/main';

validateConfig(config);

if (validateConfig.errors) {
  document.body.innerHTML = `Config Error: ${validateConfig.errors
    .map((err) => err.message)
    .join(', ')}`;
} else {
  document.body.innerHTML = `
    <pre>${JSON.stringify(config, null, 2)}</pre>
    <pre>Environment: ${currentEnvironment()}</pre>
  `;
}
