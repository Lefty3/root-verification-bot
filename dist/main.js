"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_bot_1 = require("@rootsdk/server-bot");
const verification_1 = require("./verification");
async function onStarting(state) {
    (0, verification_1.initializeVerification)(state);
}
(async () => {
    await server_bot_1.rootServer.lifecycle.start(onStarting);
})();
