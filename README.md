# 粗略的 README

BUG 多多，请见谅。

由于 keystone，只支持 node.js 16.13。

### 设置服务器地址

在根目录下建立叫 `.env` 的文件，格式如下：
```
MINECRAFT_HOST="49.232.115.22"
MINECRAFT_PORT=25565
```
其中 `MINECRAFT_HOST` 默认为本机，`MINECRAFT_PORT` 默认为 25565。

### 启动

运行
```sh
npm install
npm run build
npm run start
```
即可在 3000 端口看到服务器。

### 使用

先设置首个管理员账号。其他人也可以注册账号，由管理员设置 `validated` 来让他们能够使用平台。`validated` 的用户可以做的事情很多，只应该 validate 可信的用户。

脚本目前只支持 JavaScript，语言选 TypeScript 会被认为是 JavaScript。脚本需要提供 `main` 函数：
```
export function main(createBot, parameter) {
    // ...
}
```

其中参数 `createBot` 是无参数函数，调用后创建一个 bot；parameter 是可以设置的参数。Bot 是 mineflayer 的 bot。

写完脚本后，建立 Bot 条目以执行脚本。设置 bot 的脚本后，设置 parameter 为希望在 `main` 中得到的 JSON 值，然后将 `on` 打勾即可开始运行。关闭 `on` 即可下线。通过不断刷新，可以看到脚本 stdout 和 stderr 的混杂，在 Console 一栏下。当前会吃掉换行。

如果 bot 已经为 `on`，但 Console 仍显示 `The bot is off`，可能是启动遇到了奇怪的问题，不妨关掉再开试试。注意 Console 需要刷新来更新。

> 关于 dev 模式的注意：dev 服务器重编译的时候会泄漏子进程，导致不太愉快的结果。尽可能在重编译前下线所有 bot。
