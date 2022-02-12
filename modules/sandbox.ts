import { fork, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { JSONValue } from "@keystone-6/core/types";

type Sandbox = {
    console: {
        parts: string[];
        totalLength: number;
    },
    subprocess?: ChildProcess;
};

const sandboxes = new Map<string, Sandbox | null>();

const MAX_CONSOLE_LENGTH = 65535;

function initConsole(str: string): Sandbox["console"] {
    return {
        parts: [str],
        totalLength: str.length
    };
}

function appendToConsole(sandbox: Sandbox) {
    return (data: string | Buffer) => {
        sandbox.console.parts.push(data.toString());
        sandbox.console.totalLength += data.length;
        return;

        let overflow = sandbox.console.totalLength - MAX_CONSOLE_LENGTH;
        if (overflow <= 0) return;
        sandbox.console.totalLength = MAX_CONSOLE_LENGTH;
        while (true) {
            const firstLength = sandbox.console.parts[0].length;
            if (firstLength < overflow) {
                sandbox.console.parts.shift();
                overflow -= firstLength;
            } else {
                sandbox.console.parts[0] = sandbox.console.parts[0].substring(overflow);
            }
        };
    }
}

export async function startScript(args: {
    id: string,
    script: string,
    name: string,
    auth: string | null,
    password: string | null,
    parameter?: JSONValue,
}) {
    if (sandboxes.get(args.id)) {
        sandboxes.set(args.id, { console: initConsole("Failed to start bot:\nAlready started?") });
        return;
    }

    try {
        const cwd = path.join("workspaces", args.id);
        await fs.rm(cwd, { recursive: true, force: true });
        await fs.mkdir(cwd);

        const scriptFile = path.join(cwd, "script.mjs");
        const tmpFile = path.join(cwd, "tmp.mjs");
        await fs.writeFile(tmpFile, args.script);
        await fs.rename(tmpFile, scriptFile);

        console.info(`Starting ${JSON.stringify(args)}`);

        const subprocess = fork(path.join("..", "..", "modules", "sandbox-top.mjs"), {
            cwd,
            env: {
                ...process.env,
                id: args.id,
                name: args.name,
                ...{ auth: args.auth ?? undefined },
                ...{ password: args.password ?? undefined },
                ...{ parameter: args.parameter !== undefined ? JSON.stringify(args.parameter) : undefined },
            },
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
        const sandbox: Sandbox = {
            console: initConsole(""),
            subprocess,
        };

        const append = appendToConsole(sandbox)

        subprocess.stdout!.on("data", append);
        subprocess.stderr!.on("data", append);

        subprocess.on("close", code => append(`\nScript exitted with code ${code}`));

        sandboxes.set(args.id, sandbox);
    } catch (exc) {
        sandboxes.set(args.id, { console: initConsole(`Failed to start bot:\n${exc}`) });
        return;
    }
}

export function stopScript(id: string) {
    console.info(`Turning off ${id}`);
    const sandbox = sandboxes.get(id);
    if (sandbox) {
        sandboxes.delete(id);
        if (sandbox.subprocess?.kill() === false) {
            console.warn(`Failed to kill ${id}`);
        } else {
            fsSync.rmSync(path.join("workspaces", id), { recursive: true, force: true });
        }
    }
}

export function getConsoleContent(id: string): string {
    const sandbox = sandboxes.get(id);
    if (!sandbox) {
        return "The bot is off";
    } else {
        const concatenated = sandbox.console.parts.join("");
        sandbox.console = initConsole(concatenated);
        return concatenated;
    }
}
