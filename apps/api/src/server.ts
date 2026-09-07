import { createApp } from "./app.js";
import { registerCertificateStatusRoutes } from "./certificateStatusRoutes.js";
import { config } from "./config.js";
import { store } from "./store.js";

await store.init();

const app = createApp();
registerCertificateStatusRoutes(app);

app.listen(config.PORT, () => {
  console.log(`CertiChain API listening on http://localhost:${config.PORT}`);
});
