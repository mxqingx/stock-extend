# EXPORT_WATCHLIST 使用说明

本说明提供两种导出自选（watchlist）数据的方法：浏览器脚本（直接在前端控制台运行）和 Node CLI（使用 Puppeteer 在本地访问页面并导出）。

## 包含数据
- localStorage 中以 `watchlist` 相关的 key（如 `watchlist.groups`、`watchlist.positionRecords`、`watchlist.dailyProfits` 等）
- IndexedDB: `stock_dashboard_db` 库下的 `watchlist_groups` 表（如存在）

## 方法 A：浏览器控制台（快速）
1. 启动开发服务器：`yarn dev`，访问 `/watchlist` 页并展开自选页面/模态（以确保数据已加载）。
2. 打开浏览器开发者工具 -> Console，粘贴 `scripts/export-watchlist.js` 的内容并回车。
3. 将触发 JSON 文件下载。

优点：无需额外依赖，操作简单。适合手动备份。

## 方法 B：Node CLI（自动化）
1. 安装依赖（在仓库根目录）:
```bash
yarn add -D puppeteer minimist
```
2. 启动开发服务器：`yarn dev`（或已有可访问的预览地址）。
3. 运行导出（示例）:
```bash
node scripts/export-watchlist-node.js --url http://localhost:5173/watchlist --out watchlist-export.json
```
4. 结果文件 `watchlist-export.json` 会被写入当前工作目录。

优点：可在 CI / 脚本中自动运行，适合批量或离线导出。

## 注意事项
- 导出仅包含本地浏览器（或 Puppeteer 会话）可见的数据；如果页面需要登录或有延迟加载，请先手动登录或调整脚本以等待必要元素加载。
- 若存在敏感数据，请在导出后进行脱敏处理再共享。
- Node CLI 使用 Puppeteer，会下载 Chromium（首次安装耗时/占用空间）。

## 文件路径建议
- 浏览器脚本: `scripts/export-watchlist.js`
- Node CLI: `scripts/export-watchlist-node.js`
- 文档: `EXPORT_WATCHLIST.md`
