import { config } from '@lcdev/app-config';

// here simply to demonstrate how config is loaded in
document.body.innerHTML = JSON.stringify(config);

// notice that TypeScript knows the type of externalApiUrl
console.log('externalApiUrl:', config.externalApiUrl);

// if you're running the dev server, try changing config values! it should auto-reload
