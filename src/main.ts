import { rootServer, RootBotStartState } from "@rootsdk/server-bot";
import { initializeVerification } from "./verification";

async function onStarting(state: RootBotStartState) {
  initializeVerification(state);
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
