import { createApp } from "./app.js";
import { config } from "./config.js";
import { store } from "./store.js";

await store.init();

createApp().listen(config.PORT, () => {
  console.log(`CertiChain API listening on http://localhost:${config.PORT}`);
});
