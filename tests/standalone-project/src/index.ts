import { config, loadConfig } from "@app-config/main";

async function main() {
  await loadConfig();
  console.log(config);
}

main();
