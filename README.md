Rough README
Please excuse the many bugs.

Due to keystone, only node.js 16.13 is supported.

Setting the server address
Create a file called .env in the root directory with the following format.

MINECRAFT_HOST="49.232.115.22"
MINECRAFT_PORT=25565
where MINECRAFT_HOST defaults to local and MINECRAFT_PORT defaults to 25565.

Start
Run

npm install
npm run build
npm run start
and you will see the server on port 3000.

Use
The first administrator account is set up first. Other people can sign up for an account, and the administrator can set up a validated account to allow them to use the platform. validated users can do a lot of things, and should only validate trusted users.

The script currently only supports JavaScript, and the language choice of TypeScript will be considered JavaScript.

export function main(createBot, parameter) {
    // ...
}
The parameter createBot is a parameterless function that creates a bot when called; parameter is a parameter that can be set. bot is a mineflayer bot.

After writing the script, the Bot entry is created to execute the script. After setting the script for the bot, set parameter to the JSON value you want to get in main, then check on to start running. Close on to get offline. By constantly refreshing, you can see a mix of stdout and stderr for the script, under the Console column. The current will eat the newlines.

If the bot is already on, but Console still shows The bot is off, you may be experiencing strange problems with startup, so you may want to turn it off and on again. Note that the Console needs to be refreshed to update.

Note about dev mode: The dev server can leak subprocesses when recompiling, leading to unpleasant results. If possible, take down all bots before recompiling.

