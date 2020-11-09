import fastify from 'fastify';
import { config, loadConfig } from '@lcdev/app-config';

const server = fastify();

server.get('/', async () => {
  return { message: 'Hello world!' };
});

server.get('/config', async () => {
  return config;
});

async function main() {
  await loadConfig();
  await server.listen(config.port);

  console.log(`Listening on :${config.port}`);
}

main().catch((error) => {
  console.error(error);
  setTimeout(() => process.exit(1), 0);
});
