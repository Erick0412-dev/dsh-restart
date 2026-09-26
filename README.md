# dsh-restart

重启整个 DeepSeek Harness 进程的插件，用于重新加载插件与配置（profile 的 cordis 组合、settings 等）。host + client 双半，装进 profile 的 bundle 后即可用。

![DSH 重启插件设置](./docs/images/dsh-restart-settings.png)

> 截图来自真实 `web` profile 部署（`0.1.5-alpha.1` 期），展示 DSH 设置页中的重启配置卡片；
> `0.1.7-rc.2` 起同一张卡片改为「插件」下的独立标签页。

## 功能

- **模型工具 `restart_harness`**：让 agent 直接安排一次进程重启（可选 `delayMs`）。
- **`/restart` 斜杠命令**：在 UI 里手动触发重启。
- **配置页**（设置 → 插件 → 「DSH 重启」标签页）：可视化编辑以下设置，改动即时写入 `settings.yaml`：
  - `legacyRestart` — 旧 PowerShell/WMI/taskkill 重启方式（默认关闭，用 Node 原生方式）。
  - `continuePrompt` — 重启后自动继续时注入给 agent 的提示词。
- **「立即重启」按钮**：先读取当前进程身份，安排重启后等待新进程恢复并自动刷新页面。只读 GET 返回 `{ pid, startedAt }`；重启路由复用 Connection 的信任栅栏（Host/Origin + 浏览器认证），与 `/api` 走同一道门，所以页面能用的访问方式（含受信任的反向代理 / Tailscale）按钮一样可用。宿主没有 Connection 服务时退回历史规则：仅环回同源。
- **侧边栏常驻按钮**（主面板左下角动作栏）：点击即重启并等待新进程恢复。侧边栏折叠为图标栏时只显示 `↻`，展开时显示文案；只用主题 token，宽度自适应，不与其它插件的动作按钮争位。

> 自 `0.1.3-alpha.4` 起，内置 detached watchdog 已停用并从设置卡片移除。旧
> `watchdog*` 配置仍可被读取但不会执行；进程异常恢复请交给 systemd、Windows
> 服务或其他拥有完整进程生命周期的外部管理器。插件启动时会保留
> `$DSH_HOME/dsh-stop.flag`，让旧版本遗留的 detached watchdog 自行退出。

## 兼容与发布通道

| 插件发布通道 | DSH 基线 | 兼容承诺 |
|---|---|---|
| npm `latest`（当前正式发布插件） | `dsh-v0.1.1-rc.2` | 已验证维护基线 |
| npm `next` 候选（`0.1.3-alpha.5`） | `dsh-v0.1.5-alpha.1` | 精确依赖与真实 profile 验收目标 |
| 本地验收（`0.1.3-alpha.6`） | `dsh-v0.1.7-rc.2` | 真实 `web` profile 安装 + 单元测试（标签页 / 侧边栏按钮） |
| 后续 DSH 正式版 | 尚未发布 | 发布并完成真实 profile 门禁后再声明兼容 |

开发版不会覆盖 npm `latest`。`0.1.5-alpha.1` 依赖按精确版本锁定；该版本已移除
`@deepseek-ai/dsh-client-runtime`，客户端契约分别迁移到 Cordis、
`dsh-client-store` 与 `dsh-client-ui-settings`，不会混装 rc.2 运行时。

`0.1.3-alpha.6` 只改客户端注册与 Web 路由的信任判定，源码依赖仍锁在
`0.1.5-alpha.1`：`settings.plugins.tab` 在 `0.1.5-alpha.1` 与 `0.1.7-rc.2` 上都是
`list` slot，因此同一份 bundle 两个基线都能挂载。

### `0.1.3-alpha.6` 变更

- 修复 `0.1.7-rc.2` 下设置页卡片消失：该版本删除了 keyed slot
  `settings.plugin.item`，改为从 list slot `settings.plugins.tab` 渲染标签页；客户端
  改注册该 slot（`id` / `order` / `label`），卡片本体不变。
- 新增侧边栏常驻重启按钮（`sidebar.footer.action`，`id: dsh-restart`）：折叠态只显示
  图标、展开态显示文案，只用主题 token 自适应，避免与其它动作按钮重叠。
- 重启路由的信任判定改为复用 Connection 的 `requestRejection`，与 `/api` 同一道
  Host/Origin + 浏览器认证栅栏，反向代理下不再需要额外的放行开关；
  没有 Connection 服务时保留原环回同源规则。
- 新增测试：重启路由的信任栅栏（401 / 403 / 无 Connection 时的环回归退），以及客户端
  slot 注册与两种宽度下的渲染。

### `0.1.3-alpha.4` 变更

- 禁用并移除内置 detached watchdog；旧配置保留为无操作兼容项。
- Windows 重启通过隐藏控制台拉起，保留完整 argv，避免后续 sandbox 命令闪窗。
- 新进程 PID 变化后继续等待带认证的前端首页返回成功，再刷新页面，避免源码部署
  重启期间因静态前端尚未挂载而停留在 HTTP 404。
- 防止并发请求重复安排 helper；helper 创建失败时保留旧进程，并记录失败日志。
- 自动继续投递失败时保留恢复标记；Web 路由随 Cordis 生命周期正确释放。

### 源码部署排错

- 本开发分支只对齐官方标签 `dsh-v0.1.5-alpha.1`。源码 checkout 先执行
  `corepack pnpm install --frozen-lockfile` 和 `corepack pnpm run build`，再把本地插件
  重新加入隔离 profile；只安装依赖但没有构建 workspace，会表现为缺少
  `@deepseek-ai/*/lib`，并不是 restart 拉起失败。
- DSH `0.1.7-rc.2` 起「可配置插件」卡片列表被标签页取代：keyed slot
  `settings.plugin.item` 已从 `dsh-client-ui-settings-plugins` 删除，插件客户端必须
  注册 list slot `settings.plugins.tab`（需要 `id` / `order` / `label`）。若页面显示
  `list slot "settings.plugin.item" requires options.id`，说明 Harness 与插件客户端
  落在不同的 slot 契约；请对齐 DSH 标签与插件版本，不要再用 `options.key`。
- pnpm 首次安装 profile 依赖时可能把原生包写成待决的 `allowBuilds` 项。逐项确认
  `true` 或 `false` 后重跑 `dsh plugin --profile <name> add ...`，不要用全局放行绕过。
- 若旧版本重启后已经停在浏览器 HTTP 错误页，请手工打开新进程日志打印的当前
  `dsh web:` URL 完成一次恢复；升级到本版本后，设置卡片会等待首页真正就绪再刷新。

## 安装

1. 把包加入 profile 依赖并挂进 bundle：

```jsonc
// profiles/<profile>/package.json
{
  "dependencies": { "dsh-restart": "..." },
  "dsh": { "profile": { "bundles": ["...", "dsh-restart"] } }
}
```

2. 重启 DSH（`/restart` 或 `restart_harness`），刷新页面后即可在 设置 → 插件 里看到
   「DSH 重启」标签页，主面板左下角动作栏也会出现常驻重启按钮；之后重启都会自动等待
   并恢复页面。

## 构建

```bash
pnpm install
node scripts/link-dsh-workspace.mjs --source <path-to-deepseek-harness>
pnpm run build
```

host 半由 `tsc` 输出到 `lib/index.js`（`@deepseek-ai/*` 保持外部依赖）；client 半由 `tsdown` 打成单文件 `lib/client.js`。
