# 我的资金 & 购机助手

内部项目名：`funding-decision-hub`

一个移动端优先、数据本地保存的个人资金目标与购机决策 PWA。V1 覆盖资金预测、倒数日、整机截图收藏、OpenAI-compatible 图片识别、人工校正、方案对比、导入导出和深色模式。

在线地址：<https://jiangxinyuan43-code.github.io/funding-decision-hub/>

## 启动

```bash
npm install
npm run dev
```

Vite 会显示局域网地址。手机与电脑在同一网络时，可用该地址直接访问。

## 构建与预览

```bash
npm run build
npm run preview
```

构建产物位于 `dist/`。可以部署到任意静态托管服务；站点需要使用 HTTPS 才能完整启用 PWA 安装和 Service Worker（`localhost` 例外）。

GitHub Pages 使用专用构建命令：

```bash
npm run build:github
```

## 测试

```bash
npm run test
npm run verify
```

测试覆盖资金预测、资金池多目标、倒数日边界、硬件标准化、完整度与重复商品判断。

## AI API 配置

应用内打开“我的”，填写：

- API Base URL，例如 `https://api.openai.com/v1`
- API Key
- 文本模型
- 视觉模型

实现使用兼容性更广的 `/chat/completions` 接口。优先请求 JSON Schema Structured Outputs；供应商不支持时自动退回 JSON mode，随后再由 Zod 做应用侧校验。

API Key 只保存在当前浏览器 IndexedDB，不写入日志、错误信息或 URL。纯前端应用必须直接从浏览器请求供应商接口，因此目标服务需要允许浏览器 CORS。公开部署或多人使用时，应改为自有服务端代理并对密钥加密保存。

## 本地数据

IndexedDB 数据库名：`funding-decision-hub`

主要集合：

- `settings`
- `financePlans`
- `countdowns`
- `goals`
- `builds`（包含截图 Blob、价格历史、配置快照和检查清单）

“我的 > 导出全部数据”会生成包含原图 Data URL 的 JSON 备份，但不会导出 API Key。导入采用合并更新，不会清空现有数据，也不会覆盖当前设备保存的 API Key。

## 已知边界

- 图片识别准确度取决于视觉模型和截图清晰度，所有字段均允许人工覆盖。
- 浏览器 CORS 由 AI 服务商控制；不支持浏览器直连的服务需要代理。
- V1 不包含云同步、登录、自动爬价、定时通知或电商订单同步。
- Service Worker 使用轻量离线壳策略，更新后首次联网访问会刷新缓存。

## 建议迭代

1. V1.1：截图增删与重新识别、价格趋势筛选、配置去重确认界面。
2. V1.2：配置变更 diff、价格变化提醒、候选摘要自动更新。
3. V2：浏览器扩展、受控后端代理、多设备加密同步。
