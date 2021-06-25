import { config } from '@app-config/main';

document.body.innerHTML = `<pre>${JSON.stringify(config, null, 2)}</pre>`;
