以下是为该脚本编写的简明使用说明书，适用于 GitHub 用户，帮助他们理解如何部署和使用这个 Cloudflare Workers 脚本。

---

# 樱花面板 - 使用说明书

欢迎使用 **樱花订阅站**！这是一个基于 Cloudflare Workers 的订阅服务，支持 Clash 和 v2rayN 配置文件生成，带有用户认证、节点管理、代理设置等功能。本文档将指导你如何部署和使用这个脚本。

## 功能概览
- **用户认证**：支持注册和登录，带有密码错误锁定机制。
- **节点管理**：从远程文件加载节点，支持手动上传 IP 列表。
- **订阅生成**：生成 Clash 和 v2rayN 配置文件。
- **代理支持**：支持反代和 SOCKS5 代理，带开关控制。
- **WebSocket**：支持 WebSocket 连接代理。
- **可爱界面**：带有动态背景和主题切换的订阅页面。

## 前置条件
1. **Cloudflare 账户**：你需要一个 Cloudflare 账户，并开通 Workers 功能。
2. **KV 存储**：需要绑定一个 Cloudflare KV 命名空间用于存储用户数据和配置。
3. **基础知识**：了解基本的 JavaScript 和 Cloudflare Workers 部署流程。

## 部署步骤

### 1. 创建 Cloudflare Worker
1. 登录 Cloudflare 仪表盘，转到 **Workers** 部分。
2. 点击 **Create a Worker**，为你的 Worker 命名（例如 `sakura-sub`）。
3. 将本仓库的脚本代码（`index.js`）粘贴到 Worker 编辑器中。

### 2. 配置 KV 命名空间
1. 在 Cloudflare 仪表盘中，转到 **Workers > KV**。
2. 点击 **Create a Namespace**，命名空间名称建议为 `LOGIN_STATE`（与脚本默认配置一致）。
3. 返回 Worker 编辑页面，点击 **Settings > KV Namespace Bindings**。
4. 添加绑定：
   - **Variable name**：`LOGIN_STATE`
   - **KV Namespace**：选择刚创建的 `LOGIN_STATE`。

### 3. 自定义配置（可选）
脚本顶部有一些可自定义的变量，你可以根据需要调整：
```javascript
let 配置路径 = "config"; // 订阅访问路径
let 节点文件路径 = [
  'https://v2.i-sweet.us.kg/ips.txt', // 节点列表文件
  'https://v2.i-sweet.us.kg/url.txt'
];
let 反代地址 = 'ts.hpc.tw'; // 反代地址
let SOCKS5账号 = ''; // SOCKS5 账号，格式如 "user:pass@host:port"
let 节点名称 = '🌸樱花'; // 默认节点名称
let 伪装域名 = 'lkssite.vip'; // 伪装域名
let 白天背景图 = 'https://i.meee.com.tw/el91luR.png'; // 浅色模式背景
let 暗黑背景图 = 'https://i.meee.com.tw/QPWx8nX.png'; // 暗色模式背景
```
- 如果需要使用反代或 SOCKS5，可以通过环境变量 `PROXYIP` 和 `SOCKS5` 设置（见下文）。

### 4. 添加环境变量（可选）
在 Worker 的 **Settings > Environment Variables** 中添加：
- `PROXYIP`：反代地址（例如 `ts.hpc.tw:443`）。
- `SOCKS5`：SOCKS5 账号（例如 `user:pass@socks5.example.com:1080`）。

### 5. 部署 Worker
点击 **Save and Deploy**，等待部署完成。你的 Worker 将运行在 `https://<worker-name>.<your-subdomain>.workers.dev`。

## 使用方法

### 1. 访问和注册
1. 打开浏览器，访问 `https://<your-worker-url>/config`。
2. 如果是首次使用，会跳转到注册页面：
   - 输入用户名（4-20 位字母数字）和密码（至少 6 位）。
   - 确认密码后点击 **立即注册**。
3. 注册成功后会自动登录并跳转到订阅页面。

### 2. 登录
- 如果已有账号，访问 `/login` 页面，输入用户名和密码登录。
- 密码输错 5 次后账户会被锁定 5 分钟。

### 3. 订阅页面功能
登录后，你会看到一个带有粉色主题的订阅页面：
- **UUID**：显示当前 UUID，支持一键更换。
- **代理设置**：开关代理并选择反代或 SOCKS5。
- **订阅链接**：
  - Clash：`https://<your-worker-url>/config/clash`
  - v2rayN：`https://<your-worker-url>/config/v2rayng`
  - 点击“一键导入”可直接导入客户端。
- **上传 IP**：上传包含 IP 或域名列表的 `.txt` 文件，用于自定义节点。
- **退出登录**：点击退出按钮清除登录状态。

### 4. 获取订阅配置文件
- 复制订阅链接到 Clash 或 v2rayN 客户端。
- 或直接点击“一键导入”按钮，客户端会自动打开并加载配置。

## 注意事项
- **节点文件格式**：`节点文件路径` 中的文件应为纯文本，每行一个节点，格式如 `ip:port#节点名@tls` 或 `ip:port#节点名@notls`。
- **安全性**：建议为 Worker 设置自定义域名并启用 HTTPS。
- **KV 限制**：免费 KV 有每日读取限制，注意使用频率。
- **调试**：部署后可通过 Cloudflare 的日志查看错误信息。

## 示例节点文件
创建一个 `ips.txt`，内容如下：
```
1.1.1.1:443#节点1@tls
[2001:db8::1]:443#节点2@notls
example.com:8443#节点3@tls
```
然后将文件托管到可公开访问的 URL，并在 `节点文件路径` 中配置。

## 常见问题
- **Q：KV 未绑定提示怎么办？**
  - A：确保在 Worker 设置中绑定了 KV 命名空间 `LOGIN_STATE`。
- **Q：订阅链接无法访问？**
  - A：检查是否登录（需要有效的 Token），并确认 Worker 已正确部署。
- **Q：代理不生效？**
  - A：确认 `PROXYIP` 或 `SOCKS5` 配置正确，且目标服务可用。

## 贡献
欢迎提交 Issue 或 Pull Request 来改进这个项目！如果有建议或问题，请随时联系。

## 许可证
本项目采用 MIT 许可证，详情见 [LICENSE](LICENSE) 文件。

---

希望这份说明书能帮助你顺利部署和使用樱花面板！如果有任何疑问，欢迎在 GitHub 上提问。🌸