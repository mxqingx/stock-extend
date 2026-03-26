**项目概览**

这是一个基于 Vite + React (TypeScript) 的股票仪表盘前端工程。主要用于展示行情热力图、排行榜、看板、选股器、个股详情与设置等视图。

**运行方式**

- 开发：`npm run dev`  (vite)
- 构建：`npm run build`  (tsc + vite build)
- 预览：`npm run preview`

**关键依赖（部分）**

- `react`, `react-dom` — React
- `react-router-dom` — 路由管理
- `echarts`, `echarts-for-react` — 图表与热力图
- `stock-sdk` — 项目使用的股票数据 SDK
- `framer-motion` — 动画
- `lucide-react` — 图标
- `@grafana/faro-*` — 监控/上报相关

**脚本**

- `dev`, `build`, `postbuild`, `lint`, `preview` （详见 package.json）

**页面路由（来自 `src/router/index.tsx`）**

- `/` → 仪表盘 (Dashboard)  — `src/pages/Dashboard/Dashboard.tsx`
- `/heatmap` → 热力图 (Heatmap)  — `src/pages/Heatmap/Heatmap.tsx`
- `/rankings` → 排行榜 (Rankings)  — `src/pages/Rankings/Rankings.tsx`
- `/boards` → 看板列表 (Boards)  — `src/pages/Boards/Boards.tsx`
- `/boards/:type/:code` → 看板详情 (BoardDetail)  — `src/pages/Boards/BoardDetail.tsx`
- `/watchlist` → 自选 (Watchlist)  — `src/pages/Watchlist/Watchlist.tsx`
- `/scanner` → 扫描器 (Scanner)  — `src/pages/Scanner/Scanner.tsx`
- `/eod-picker` → 日终选择器 (EndOfDayPicker)  — `src/pages/EndOfDayPicker/EndOfDayPicker.tsx`
- `/settings` → 设置 (Settings)  — `src/pages/Settings/Settings.tsx`
- `/s/:code` → 个股详情 (StockDetail)  — `src/pages/StockDetail/StockDetail.tsx`

以上路由都被包裹在 `Layout` 布局组件中（`src/components/layout/Layout.tsx`）。

**主要页面目录**

- `src/pages/Dashboard` — 仪表盘
- `src/pages/Heatmap` — 热力图
- `src/pages/Rankings` — 排行榜
- `src/pages/Boards` — 看板与看板详情
- `src/pages/Watchlist` — 自选股
- `src/pages/Scanner` — 扫描器
- `src/pages/EndOfDayPicker` — 日终选择器
- `src/pages/Settings` — 设置
- `src/pages/StockDetail` — 个股详情

**主要组件目录**

- `src/components/common` — 常用 UI 组件（Button, Card, Loading, Logo, Tabs, Toast 等）
- `src/components/layout` — 布局相关（Header, Sidebar, Layout）

这些组件是页面的构建块，位于 `src/components/*`。

**Hooks 与 Contexts**

- Hooks：`src/hooks` 下有 `useLocalStorage.ts`, `usePolling.ts`, `useTheme.ts` 等。
- Contexts：`src/contexts` 包含 `ThemeContext`, `BoardDataContext` 与 `ThemeProvider` 等，用于跨组件状态与主题管理。

**服务与工具代码**

- `src/services/sdk.ts` — 与后端/SDK 交互的封装（使用 `stock-sdk`）
- `src/services/storage.ts` — 本地/持久化存储相关封装
- `src/utils` — 格式化与通用工具（如 `format.ts`）

**静态文件与资源**

- `public/` — 静态资源（favicon、静态部署相关文件等）
- `src/assets/` — 应用内图片/资源

**Type 与配置**

- 类型声明在 `src/types`。
- Vite 与 TypeScript 配置分别位于 `vite.config.ts` 与 `tsconfig*.json`。

**开发者说明 / 下一步建议**

1. 我已生成该文档作为项目概览，路径： [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
2. 后续请在需求中直接引用或让我读取此文档，我会以此为基础继续开发新页面或功能。
3. 若需要更详尽的组件/页面映射（逐文件列出 props 与关键函数），我可以继续解析并扩展本文件。

---

若你现在需要，我可以：

- 运行一次依赖安装并启动开发服务器（需你允许我运行命令），或
- 进一步提取并列出每个组件的导出 API 与关键 props。

**H5 适配（已实施）**

我已按最小可行方案对项目进行移动端适配，变更包括：

- `index.html`：调整 `viewport`（`maximum-scale=1.0`）。
- 新增 Hook：`src/hooks/useIsMobile.ts`，用于检测移动端断点（max-width: 767px）。
- 更新轮询 Hook：`src/hooks/usePolling.ts`，新增 `mobileInterval` 与 `adaptive` 参数，移动端自动使用更长轮询间隔。
- 移动布局：新增 `src/components/layout/MobileLayout.tsx` 与 `MobileBottomNav.tsx`（及样式），并在 `src/components/layout/Layout.tsx` 中根据 `useIsMobile()` 切换布局。
- 路由懒加载：`src/router/index.tsx` 使用 `React.lazy` + `Suspense` 实现按需加载页面模块，减少首屏体积。
- 图表适配：`src/pages/Heatmap/*`、`src/pages/Boards/BoardDetail.tsx`、`src/pages/StockDetail/StockDetail.tsx` 中根据 `useIsMobile()` 禁用或降低图表动画、减小间距并降低字体大小以提升移动性能。
- 全局样式：`src/index.css` 添加触控友好变量 `--touch-size`，并在小屏断点下增大按钮点击目标与减少内容内边距。
- 文档：将 H5 适配说明加入此文档（见本节）。

主要修改文件清单（摘要）：

- `index.html`
- `src/index.css`
- `src/hooks/useIsMobile.ts`
- `src/hooks/usePolling.ts`
- `src/hooks/index.ts`
- `src/components/layout/Layout.tsx`
- `src/components/layout/MobileLayout.tsx`
- `src/components/layout/MobileLayout.module.css`
- `src/components/layout/MobileBottomNav.tsx`
- `src/components/layout/MobileBottomNav.module.css`
- `src/router/index.tsx`
- `src/pages/Heatmap/Heatmap.tsx`
- `src/pages/Boards/BoardDetail.tsx`
- `src/pages/StockDetail/StockDetail.tsx`
- `src/pages/Watchlist/Watchlist.tsx`
- `PROJECT_OVERVIEW.md` (已更新)

如需我继续：我会按顺序完成剩余工作：

1. 进一步优化图表数据（移动端降采样、低配模式开关）。
2. 在关键页面添加手动“省流量模式”开关，允许用户一键降低轮询与动画。
3. 编写测试与 QA 步骤脚本（Lighthouse 指南与设备测试清单）。

