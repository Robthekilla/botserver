"use strict";

import mineflayer from "mineflayer";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const parameter = process.env.parameter != undefined ? JSON.parse(process.env.parameter) : undefined;

function createBot() {
    return mineflayer.createBot({
        host: process.env.MINECRAFT_HOST,
        port: process.env.MINECRAFT_PORT ?? 25565,
        username: process.env.name,
        password: process.env.password,
        auth: process.env.auth,
    });
}

const script = await import(`../workspaces/${process.env.id}/script.mjs`);
script.main(createBot, parameter);
