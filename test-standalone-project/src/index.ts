import { config, loadConfig } from "@lcdev/app-config";

async function main() {
  await loadConfig();
  console.log(config);
}

main();
