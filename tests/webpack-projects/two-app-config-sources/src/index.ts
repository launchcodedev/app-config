// @ts-ignore
import { config as dynamicConfig } from '@app-config/main';
// @ts-ignore
import { config as staticConfig } from 'app-config-static';

document.body.innerHTML = `<pre>
${JSON.stringify(dynamicConfig, null, 2)}
${JSON.stringify(staticConfig, null, 2)}
</pre>`;
