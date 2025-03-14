3import { connect } from 'cloudflare:sockets';

// Global variables (no hardcoded values)
let 订阅路径 = "config";
let 优选节点 = [];
let 启用反代 = false; // Default off
let 反代地址 = 'ts.hpc.tw';
let 启用SOCKS5 = false; // Default off
let 启用全局SOCKS5 = false;
let SOCKS5账号 = '';
let 节点名称 = '天书';
let 伪装域名 = 'lkssite.vip';
let 最大失败次数 = 5;
let 锁定时间 = 5 * 60 * 1000;
let 背景壁纸 = 'https://raw.githubusercontent.com/Alien-Et/ips/refs/heads/main/image/night.jpg';

// Response helpers (unchanged)
function 创建HTML响应(内容, 状态码 = 200) { /* ... */ }
function 创建重定向响应(路径, 额外头 = {}) { /* ... */ }
function 创建JSON响应(数据, 状态码 = 200, 额外头 = {}) { /* ... */ }

// Load nodes and config (adjusted for dynamic TXT paths)
async function 加载节点和配置(env, hostName) {
  const txtPaths = JSON.parse(await env.LOGIN_STATE.get('preferred_txt_paths') || '[]');
  const 手动节点缓存 = await env.LOGIN_STATE.get('manual_preferred_ips');
  let 手动节点列表 = 手动节点缓存 ? JSON.parse(手动节点缓存).map(line => line.trim()).filter(Boolean) : [];

  const 响应列表 = await Promise.all(txtPaths.map(async (路径) => {
    try {
      const 响应 = await fetch(路径);
      if (!响应.ok) throw new Error(`请求 ${路径} 失败`);
      return (await 响应.text()).split('\n').map(line => line.trim()).filter(Boolean);
    } catch (错误) {
      console.error(`拉取 ${路径} 失败: ${错误.message}`);
      return [];
    }
  }));

  const 合并节点列表 = [...new Set([...手动节点列表, ...响应列表.flat()])];
  if (合并节点列表.length > 0) {
    优选节点 = 合并节点列表;
    await env.LOGIN_STATE.put('ip_preferred_ips', JSON.stringify(合并节点列表), { expirationTtl: 86400 });
    await env.LOGIN_STATE.put('ip_preferred_ips_version', String(Date.now()));
  } else {
    优选节点 = [`${hostName}:443`];
  }
}

// Main fetch handler
export default {
  async fetch(请求, env) {
    try {
      if (!env.LOGIN_STATE) return 创建HTML响应(生成KV未绑定提示页面());

      const url = new URL(请求.url);
      const hostName = 请求.headers.get('Host');
      const 设备标识 = `${请求.headers.get('User-Agent') || 'unknown'}_${请求.headers.get('CF-Connecting-IP') || 'unknown'}`;

      // Initialize UUID if not set
      let 开门锁匙 = await env.LOGIN_STATE.get('uuid');
      if (!开门锁匙) {
        开门锁匙 = crypto.randomUUID();
        await env.LOGIN_STATE.put('uuid', 开门锁匙);
      }

      // Check admin registration
      const adminAccount = await env.LOGIN_STATE.get('admin_account');
      if (!adminAccount && url.pathname !== '/register') {
        return 创建重定向响应('/register');
      }

      switch (url.pathname) {
        case '/register':
          if (adminAccount) return 创建重定向响应('/login');
          return 创建HTML响应(生成注册页面());
        case '/register/submit':
          const formData = await 请求.formData();
          const username = formData.get('username');
          const password = formData.get('password');
          if (username && password) {
            await env.LOGIN_STATE.put('admin_account', JSON.stringify({ username, password }));
            return 创建重定向响应('/login');
          }
          return 创建HTML响应(生成注册页面(true));
        case '/login':
          // Login logic (unchanged but uses dynamic admin account)
          const { username, password } = JSON.parse(adminAccount || '{}');
          /* ... existing login logic ... */
        case `/${订阅路径}`:
          await 加载节点和配置(env, hostName);
          return 创建HTML响应(生成订阅页面(订阅路径, hostName, env));
        case `/${订阅路径}/settings/txt`:
          const txtFormData = await 请求.formData();
          const newTxtPath = txtFormData.get('txtPath');
          if (newTxtPath) {
            const txtPaths = JSON.parse(await env.LOGIN_STATE.get('preferred_txt_paths') || '[]');
            txtPaths.push(newTxtPath);
            await env.LOGIN_STATE.put('preferred_txt_paths', JSON.stringify([...new Set(txtPaths)]));
          }
          return 创建重定向响应(`/${订阅路径}`);
        case `/${订阅路径}/settings/proxy`:
          启用反代 = !启用反代;
          await env.LOGIN_STATE.put('proxy_enabled', String(启用反代));
          return 创建重定向响应(`/${订阅路径}`);
        case `/${订阅路径}/settings/socks5`:
          启用SOCKS5 = !启用SOCKS5;
          await env.LOGIN_STATE.put('socks5_enabled', String(启用SOCKS5));
          return 创建重定向响应(`/${订阅路径}`);
        default:
          // Handle WebSocket or proxy (unchanged)
          /* ... */
      }
    } catch (error) {
      return 创建JSON响应({ error: `服务器错误: ${error.message}` }, 500);
    }
  }
};

// UI Pages
function 生成注册页面(error = false) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background: url('${背景壁纸}') center/cover no-repeat fixed; font-family: Arial, sans-serif; color: white; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .container { background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.9)); padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 90%; max-width: 400px; text-align: center; }
    h1 { font-size: 2em; color: #4CAF50; margin-bottom: 20px; text-shadow: 0 2px 5px rgba(0,0,0,0.3); }
    form { display: flex; flex-direction: column; gap: 15px; }
    input { padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; font-size: 16px; transition: all 0.3s; }
    input:focus { border-color: #4CAF50; box-shadow: 0 0 10px rgba(76,175,80,0.5); outline: none; }
    button { padding: 12px; background: linear-gradient(135deg, #4CAF50, #388E3C); border: none; border-radius: 8px; color: white; font-size: 16px; cursor: pointer; transition: all 0.3s; }
    button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(76,175,80,0.4); }
    .error { color: #ff6666; margin-top: 10px; font-size: 14px; animation: shake 0.5s; }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25%, 75% { transform: translateX(-5px); } 50% { transform: translateX(5px); } }
  </style>
</head>
<body>
  <div class="container">
    <h1>设置管理员账号</h1>
    <form action="/register/submit" method="POST">
      <input type="text" name="username" placeholder="用户名" required>
      <input type="password" name="password" placeholder="密码" required>
      <button type="submit">注册</button>
    </form>
    ${error ? '<div class="error">请填写完整信息</div>' : ''}
  </div>
</body>
</html>
  `;
}

function 生成订阅页面(订阅路径, hostName, env) {
  const txtPaths = JSON.parse(env.LOGIN_STATE.get('preferred_txt_paths') || '[]');
  const 启用反代 = env.LOGIN_STATE.get('proxy_enabled') === 'true';
  const 启用SOCKS5 = env.LOGIN_STATE.get('socks5_enabled') === 'true';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background: url('${背景壁纸}') center/cover no-repeat fixed; font-family: Arial, sans-serif; color: white; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .container { background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.9)); padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 90%; max-width: 700px; text-align: center; }
    h1 { font-size: 2.5em; color: #4CAF50; margin-bottom: 30px; text-shadow: 0 2px 5px rgba(0,0,0,0.3); }
    .section { margin: 20px 0; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 15px; border: 1px dashed #4CAF50; }
    .toggle-btn { padding: 12px 24px; background: ${启用反代 ? '#4CAF50' : '#f44336'}; border-radius: 10px; border: none; color: white; font-size: 16px; cursor: pointer; transition: all 0.3s ease; }
    .toggle-btn:hover { transform: scale(1.05); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
    .toggle-btn.active { background: #4CAF50; }
    .txt-input { padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; width: 70%; margin-right: 10px; }
    .txt-list { margin-top: 15px; max-height: 150px; overflow-y: auto; }
    .txt-item { padding: 8px; background: rgba(255,255,255,0.1); margin: 5px 0; border-radius: 8px; display: flex; justify-content: space-between; }
    .txt-item button { background: #f44336; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <h1>订阅管理</h1>
    <div class="section">
      <h2>反代设置</h2>
      <button class="toggle-btn ${启用反代 ? 'active' : ''}" onclick="window.location.href='/${订阅路径}/settings/proxy'">${启用反代 ? '已启用' : '已禁用'}</button>
    </div>
    <div class="section">
      <h2>SOCKS5 设置</h2>
      <button class="toggle-btn ${启用SOCKS5 ? 'active' : ''}" onclick="window.location.href='/${订阅路径}/settings/socks5'">${启用SOCKS5 ? '已启用' : '已禁用'}</button>
    </div>
    <div class="section">
      <h2>优选 TXT 路径</h2>
      <form action="/${订阅路径}/settings/txt" method="POST">
        <input type="text" class="txt-input" name="txtPath" placeholder="输入 TXT 路径" required>
        <button type="submit" style="padding: 10px 20px; background: #4CAF50; border: none; border-radius: 8px; color: white;">添加</button>
      </form>
      <div class="txt-list">
        ${txtPaths.map(path => `<div class="txt-item">${path} <button onclick="removeTxt('${path}')">移除</button></div>`).join('')}
      </div>
    </div>
  </div>
  <script>
    function removeTxt(path) {
      fetch('/${订阅路径}/settings/txt', {
        method: 'POST',
        body: new URLSearchParams({ txtPath: path, remove: true })
      }).then(() => location.reload());
    }
  </script>
</body>
</html>
  `;
}

