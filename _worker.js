import { connect } from 'cloudflare:sockets';

// 全局变量
let 订阅路径 = "config";
let 开门锁匙 = uuidv4();
let 优选TXT路径 = [];
let 优选节点 = [];
let 启用反代 = false;
let 反代地址 = 'ts.hpc.tw';
let 启用SOCKS5 = false;
let 启用全局SOCKS5 = false;
let SOCKS5账号 = '';
let 节点名称 = '天书';
let 伪装域名 = 'lkssite.vip';
let 最大失败次数 = 5;
let 锁定时间 = 5 * 60 * 1000;
let 小猫 = 'cla';
let 咪 = 'sh';
let 符号 = '://';
let 歪啦 = 'vl';
let 伊埃斯 = 'ess';
let 歪兔 = 'v2';
let 蕊蒽 = 'rayN';
let 背景壁纸 = 'https://raw.githubusercontent.com/Alien-Et/ips/refs/heads/main/image/night.jpg';

// UUID 生成函数
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 创建响应函数
function 创建HTML响应(内容, 状态码 = 200) {
  return new Response(内容, {
    status: 状态码,
    headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store" }
  });
}

function 创建重定向响应(路径, 额外头 = {}) {
  return new Response(null, {
    status: 302,
    headers: { "Location": 路径, "Cache-Control": "no-store", ...额外头 }
  });
}

function 创建JSON响应(数据, 状态码 = 200, 额外头 = {}) {
  return new Response(JSON.stringify(数据), {
    status: 状态码,
    headers: { "Content-Type": "application/json;charset=utf-8", "Cache-Control": "no-store", ...额外头 }
  });
}

// 加载节点和配置
async function 加载节点和配置(env, hostName) {
  try {
    const txtPaths = await env.LOGIN_STATE.get('txt_paths');
    优选TXT路径 = txtPaths ? JSON.parse(txtPaths) : [];
    const 手动节点缓存 = await env.LOGIN_STATE.get('manual_preferred_ips');
    let 手动节点列表 = 手动节点缓存 ? JSON.parse(手动节点缓存).map(line => line.trim()).filter(Boolean) : [];

    const 响应列表 = await Promise.all(优选TXT路径.map(async (路径) => {
      try {
        const 响应 = await fetch(路径);
        if (!响应.ok) throw new Error(`请求 ${路径} 失败，状态码: ${响应.status}`);
        return (await 响应.text()).split('\n').map(line => line.trim()).filter(Boolean);
      } catch (错误) {
        console.error(`拉取 ${路径} 失败: ${错误.message}`);
        return [];
      }
    }));

    const 域名节点列表 = [...new Set(响应列表.flat())];
    const 合并节点列表 = [...new Set([...手动节点列表, ...域名节点列表])];
    const 缓存节点 = await env.LOGIN_STATE.get('ip_preferred_ips');
    const 当前节点列表 = 缓存节点 ? JSON.parse(缓存节点) : [];
    const 列表相同 = JSON.stringify(合并节点列表) === JSON.stringify(当前节点列表);

    if (合并节点列表.length > 0) {
      优选节点 = 合并节点列表;
      if (!列表相同) {
        const 新版本 = String(Date.now());
        await env.LOGIN_STATE.put('ip_preferred_ips', JSON.stringify(合并节点列表), { expirationTtl: 86400 });
        await env.LOGIN_STATE.put('ip_preferred_ips_version', 新版本);
        await env.LOGIN_STATE.put('config_clash', 生成猫咪配置(hostName), { expirationTtl: 86400 });
        await env.LOGIN_STATE.put('config_clash_version', 新版本);
        await env.LOGIN_STATE.put('config_v2ray', 生成备用配置(hostName), { expirationTtl: 86400 });
        await env.LOGIN_STATE.put('config_v2ray_version', 新版本);
      }
    } else {
      优选节点 = 当前节点列表.length > 0 ? 当前节点列表 : [`${hostName}:443`];
    }
  } catch (错误) {
    const 缓存节点 = await env.LOGIN_STATE.get('ip_preferred_ips');
    优选节点 = 缓存节点 ? JSON.parse(缓存节点) : [`${hostName}:443`];
    await env.LOGIN_STATE.put('ip_error_log', JSON.stringify({ time: Date.now(), error: '所有路径拉取失败或手动上传为空' }), { expirationTtl: 86400 });
  }
}

async function 获取配置(env, 类型, hostName) {
  const 缓存键 = 类型 === 'clash' ? 'config_clash' : 'config_v2ray';
  const 版本键 = `${缓存键}_version`;
  const 缓存配置 = await env.LOGIN_STATE.get(缓存键);
  const 配置版本 = await env.LOGIN_STATE.get(版本键) || '0';
  const 节点版本 = await env.LOGIN_STATE.get('ip_preferred_ips_version') || '0';

  if (缓存配置 && 配置版本 === 节点版本) return 缓存配置;

  const 新配置 = 类型 === 'clash' ? 生成猫咪配置(hostName) : 生成备用配置(hostName);
  await env.LOGIN_STATE.put(缓存键, 新配置, { expirationTtl: 86400 });
  await env.LOGIN_STATE.put(版本键, 节点版本);
  return 新配置;
}

async function 检查锁定(env, 设备标识) {
  const 锁定时间戳 = await env.LOGIN_STATE.get(`lock_${设备标识}`);
  const 当前时间 = Date.now();
  const 被锁定 = 锁定时间戳 && 当前时间 < Number(锁定时间戳);
  return { 被锁定, 剩余时间: 被锁定 ? Math.ceil((Number(锁定时间戳) - 当前时间) / 1000) : 0 };
}

// 主处理逻辑
export default {
  async fetch(请求, env) {
    try {
      if (!env.LOGIN_STATE) return 创建HTML响应(生成KV未绑定提示页面());

      const 管理员账号 = await env.LOGIN_STATE.get('admin_username');
      if (!管理员账号) {
        const url = new URL(请求.url);
        if (url.pathname === '/register') return 创建HTML响应(生成注册页面());
        else if (url.pathname === '/register/submit') {
          const formData = await 请求.formData();
          const 新账号 = formData.get('username');
          const 新密码 = formData.get('password');
          if (!新账号 || !新密码) return 创建JSON响应({ error: '用户名或密码不能为空' }, 400);
          try {
            await env.LOGIN_STATE.put('admin_username', 新账号);
            await env.LOGIN_STATE.put('admin_password', 新密码);
            return 创建JSON响应({ success: true, redirect: '/login' }, 200);
          } catch (error) {
            console.error(`KV写入失败: ${error.message}`);
            return 创建JSON响应({ error: '注册失败，请稍后重试' }, 500);
          }
        }
        return 创建重定向响应('/register');
      }

      const 请求头 = 请求.headers.get('Upgrade');
      const url = new URL(请求.url);
      const hostName = 请求.headers.get('Host');
      const UA = 请求.headers.get('User-Agent') || 'unknown';
      const IP = 请求.headers.get('CF-Connecting-IP') || 'unknown';
      const 设备标识 = `${UA}_${IP}`;
      let formData;

      if (!请求头 || 请求头 !== 'websocket') {
        switch (url.pathname) {
          case '/reset-login-failures':
            await env.LOGIN_STATE.put(`fail_${设备标识}`, '0');
            await env.LOGIN_STATE.delete(`lock_${设备标识}`);
            return new Response(null, { status: 200 });
          case `/${订阅路径}`:
            const SubToken = 请求.headers.get('Cookie')?.split('=')[1];
            const 有效SubToken = await env.LOGIN_STATE.get('current_token');
            if (!SubToken || SubToken !== 有效SubToken) return 创建重定向响应('/login');
            return 创建HTML响应(生成订阅页面(订阅路径, hostName));
          case '/login':
            const 锁定状态 = await 检查锁定(env, 设备标识);
            if (锁定状态.被锁定) return 创建HTML响应(生成登录界面(true, 锁定状态.剩余时间));
            if (请求.headers.get('Cookie')?.split('=')[1] === await env.LOGIN_STATE.get('current_token')) {
              return 创建重定向响应(`/${订阅路径}`);
            }
            const 失败次数 = Number(await env.LOGIN_STATE.get(`fail_${设备标识}`) || 0);
            return 创建HTML响应(生成登录界面(false, 0, 失败次数 > 0, 最大失败次数 - 失败次数));
          case '/login/submit':
            const 锁定 = await 检查锁定(env, 设备标识);
            if (锁定.被锁定) return 创建重定向响应('/login');
            formData = await 请求.formData();
            const 提供的账号 = formData.get('username');
            const 提供的密码 = formData.get('password');
            const 存储账号 = await env.LOGIN_STATE.get('admin_username');
            const 存储密码 = await env.LOGIN_STATE.get('admin_password');
            if (提供的账号 === 存储账号 && 提供的密码 === 存储密码) {
              const 新Token = Math.random().toString(36).substring(2);
              await env.LOGIN_STATE.put('current_token', 新Token, { expirationTtl: 300 });
              await env.LOGIN_STATE.put(`fail_${设备标识}`, '0');
              return 创建重定向响应(`/${订阅路径}`, { 'Set-Cookie': `token=${新Token}; Path=/; HttpOnly; SameSite=Strict` });
            } else {
              let 失败次数 = Number(await env.LOGIN_STATE.get(`fail_${设备标识}`) || 0) + 1;
              await env.LOGIN_STATE.put(`fail_${设备标识}`, String(失败次数));
              if (失败次数 >= 最大失败次数) {
                await env.LOGIN_STATE.put(`lock_${设备标识}`, String(Date.now() + 锁定时间), { expirationTtl: 300 });
                return 创建HTML响应(生成登录界面(true, 锁定时间 / 1000));
              }
              return 创建HTML响应(生成登录界面(false, 0, true, 最大失败次数 - 失败次数));
            }
          case `/${订阅路径}/logout`:
            await env.LOGIN_STATE.delete('current_token');
            return 创建重定向响应('/login', { 'Set-Cookie': 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict' });
          case `/${订阅路径}/${小猫}${咪}`:
            await 加载节点和配置(env, hostName);
            const clashConfig = await 获取配置(env, 'clash', hostName);
            return new Response(clashConfig, { status: 200, headers: { "Content-Type": "text/plain;charset=utf-8" } });
          case `/${订阅路径}/${歪兔}${蕊蒽}`:
            await 加载节点和配置(env, hostName);
            const v2rayConfig = await 获取配置(env, 'v2ray', hostName);
            return new Response(v2rayConfig, { status: 200, headers: { "Content-Type": "text/plain;charset=utf-8" } });
          case `/${订阅路径}/update-settings`:
            const 设置Token = 请求.headers.get('Cookie')?.split('=')[1];
            const 有效设置Token = await env.LOGIN_STATE.get('current_token');
            if (!设置Token || 设置Token !== 有效设置Token) return 创建JSON响应({ error: '未登录' }, 401);
            formData = await 请求.formData();
            启用反代 = formData.get('proxy') === 'on';
            启用SOCKS5 = formData.get('socks5') === 'on';
            const 新TXT路径 = formData.get('txtPaths')?.split('\n').map(line => line.trim()).filter(Boolean) || [];
            await env.LOGIN_STATE.put('txt_paths', JSON.stringify(新TXT路径));
            优选TXT路径 = 新TXT路径;
            return 创建JSON响应({ message: '设置已更新' }, 200);
          case `/${订阅路径}/upload`:
            const uploadToken = 请求.headers.get('Cookie')?.split('=')[1];
            const 有效UploadToken = await env.LOGIN_STATE.get('current_token');
            if (!uploadToken || uploadToken !== 有效UploadToken) return 创建JSON响应({ error: '未登录或Token无效' }, 401);
            formData = await 请求.formData();
            const ipFiles = formData.getAll('ipFiles');
            if (!ipFiles || ipFiles.length === 0) return 创建JSON响应({ error: '未选择任何文件' }, 400);
            let allIpList = [];
            try {
              for (const ipFile of ipFiles) {
                if (!ipFile || !ipFile.text) throw new Error(`文件 ${ipFile.name} 无效`);
                const ipText = await ipFile.text();
                const ipList = ipText.split('\n').map(line => line.trim()).filter(Boolean);
                if (ipList.length === 0) console.warn(`文件 ${ipFile.name} 内容为空`);
                allIpList = allIpList.concat(ipList);
              }
              if (allIpList.length === 0) return 创建JSON响应({ error: '所有上传文件内容为空' }, 400);
              const uniqueIpList = [...new Set(allIpList)];
              const 当前手动节点 = await env.LOGIN_STATE.get('manual_preferred_ips');
              const 当前节点列表 = 当前手动节点 ? JSON.parse(当前手动节点) : [];
              const 是重复上传 = JSON.stringify(当前节点列表.sort()) === JSON.stringify(uniqueIpList.sort());
              if (是重复上传) return 创建JSON响应({ message: '上传内容与现有节点相同，无需更新' }, 200);
              await env.LOGIN_STATE.put('manual_preferred_ips', JSON.stringify(uniqueIpList), { expirationTtl: 86400 });
              const 新版本 = String(Date.now());
              await env.LOGIN_STATE.put('ip_preferred_ips_version', 新版本);
              await env.LOGIN_STATE.put('config_clash', 生成猫咪配置(hostName), { expirationTtl: 86400 });
              await env.LOGIN_STATE.put('config_clash_version', 新版本);
              await env.LOGIN_STATE.put('config_v2ray', 生成备用配置(hostName), { expirationTtl: 86400 });
              await env.LOGIN_STATE.put('config_v2ray_version', 新版本);
              return 创建JSON响应({ message: '上传成功' }, 200);
            } catch (错误) {
              console.error(`上传处理失败: ${错误.message}`);
              return 创建JSON响应({ error: `上传处理失败: ${错误.message}` }, 500);
            }
          default:
            url.hostname = 伪装域名;
            url.protocol = 'https:';
            return fetch(new Request(url, 请求));
        }
      } else if (请求头 === 'websocket') {
        反代地址 = env.PROXYIP || 反代地址;
        SOCKS5账号 = env.SOCKS5 || SOCKS5账号;
        启用SOCKS5 = env.SOCKS5OPEN === 'true' ? true : env.SOCKS5OPEN === 'false' ? false : 启用SOCKS5;
        启用全局SOCKS5 = env.SOCKS5GLOBAL === 'true' ? true : env.SOCKS5GLOBAL === 'false' ? false : 启用全局SOCKS5;
        return await 升级请求(请求);
      }
    } catch (error) {
      console.error(`全局错误: ${error.message}`);
      return 创建JSON响应({ error: `服务器内部错误: ${error.message}` }, 500);
    }
  }
};

// WebSocket 相关函数
async function 升级请求(请求) {
  const 创建接口 = new WebSocketPair();
  const [客户端, 服务端] = Object.values(创建接口);
  服务端.accept();
  const 结果 = await 解析头(解密(请求.headers.get('sec-websocket-protocol')));
  if (!结果) return new Response('Invalid request', { status: 400 });
  const { TCP接口, 初始数据 } = 结果;
  建立管道(服务端, TCP接口, 初始数据);
  return new Response(null, { status: 101, webSocket: 客户端 });
}

function 解密(混淆字符) {
  混淆字符 = 混淆字符.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(混淆字符), c => c.charCodeAt(0)).buffer;
}

async function 解析头(数据) {
  const 数据数组 = new Uint8Array(数据);
  if (验证密钥(数据数组.slice(1, 17)) !== 开门锁匙) return null;

  const 数据定位 = 数据数组[17];
  const 端口 = new DataView(数据.slice(18 + 数据定位 + 1, 20 + 数据定位 + 1)).getUint16(0);
  const 地址索引 = 20 + 数据定位 + 1;
  const 地址类型 = 数据数组[地址索引];
  let 地址 = '';
  const 地址信息索引 = 地址索引 + 1;

  switch (地址类型) {
    case 1: 地址 = new Uint8Array(数据.slice(地址信息索引, 地址信息索引 + 4)).join('.'); break;
    case 2:
      const 地址长度 = 数据数组[地址信息索引];
      地址 = new TextDecoder().decode(数据.slice(地址信息索引 + 1, 地址信息索引 + 1 + 地址长度));
      break;
    case 3:
      地址 = Array.from({ length: 8 }, (_, i) => new DataView(数据.slice(地址信息索引, 地址信息索引 + 16)).getUint16(i * 2).toString(16)).join(':');
      break;
    default: return null;
  }

  const 初始数据 = 数据.slice(地址信息索引 + (地址类型 === 2 ? 数据数组[地址信息索引] + 1 : 地址类型 === 1 ? 4 : 16));
  let TCP接口;
  if (启用反代 && 启用SOCKS5 && 启用全局SOCKS5) {
    TCP接口 = await 创建SOCKS5(地址类型, 地址, 端口);
  } else {
    try {
      TCP接口 = connect({ hostname: 地址, port: 端口 });
      await TCP接口.opened;
    } catch {
      if (启用反代) {
        TCP接口 = 启用SOCKS5
          ? await 创建SOCKS5(地址类型, 地址, 端口)
          : connect({ hostname: 反代地址.split(':')[0], port: 反代地址.split(':')[1] || 端口 });
      }
    }
  }
  return { TCP接口, 初始数据 };
}

function 验证密钥(arr) {
  return Array.from(arr.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('').match(/(.{8})(.{4})(.{4})(.{4})(.{12})/).slice(1).join('-').toLowerCase();
}

async function 建立管道(服务端, TCP接口, 初始数据) {
  await 服务端.send(new Uint8Array([0, 0]).buffer);
  const 数据流 = new ReadableStream({
    async start(控制器) {
      if (初始数据) 控制器.enqueue(初始数据);
      服务端.addEventListener('message', event => 控制器.enqueue(event.data));
      服务端.addEventListener('close', () => { 控制器.close(); TCP接口.close(); setTimeout(() => 服务端.close(1000), 2); });
      服务端.addEventListener('error', () => { 控制器.close(); TCP接口.close(); setTimeout(() => 服务端.close(1001), 2); });
    }
  });
  数据流.pipeTo(new WritableStream({
    async write(数据) {
      const 写入器 = TCP接口.writable.getWriter();
      await 写入器.write(数据);
      写入器.releaseLock();
    }
  }));
  TCP接口.readable.pipeTo(new WritableStream({
    async write(数据) {
      await 服务端.send(数据);
    }
  }));
}

async function 创建SOCKS5(地址类型, 地址, 端口) {
  const { username, password, hostname, port } = await 解析SOCKS5账号(SOCKS5账号);
  const SOCKS5接口 = connect({ hostname, port });
  try {
    await SOCKS5接口.opened;
  } catch {
    return new Response('SOCKS5未连通', { status: 400 });
  }
  const writer = SOCKS5接口.writable.getWriter();
  const reader = SOCKS5接口.readable.getReader();
  const encoder = new TextEncoder();
  await writer.write(new Uint8Array([5, 2, 0, 2]));
  let res = (await reader.read()).value;
  if (res[1] === 0x02) {
    if (!username || !password) return 关闭接口();
    await writer.write(new Uint8Array([1, username.length, ...encoder.encode(username), password.length, ...encoder.encode(password)]));
    res = (await reader.read()).value;
    if (res[0] !== 0x01 || res[1] !== 0x00) return 关闭接口();
  }
  let 转换地址;
  switch (地址类型) {
    case 1: 转换地址 = new Uint8Array([1, ...地址.split('.').map(Number)]); break;
    case 2: 转换地址 = new Uint8Array([3, 地址.length, ...encoder.encode(地址)]); break;
    case 3: 转换地址 = new Uint8Array([4, ...地址.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]); break;
    default: return 关闭接口();
  }
  await writer.write(new Uint8Array([5, 1, 0, ...转换地址, 端口 >> 8, 端口 & 0xff]));
  res = (await reader.read()).value;
  if (res[0] !== 0x05 || res[1] !== 0x00) return 关闭接口();
  writer.releaseLock();
  reader.releaseLock();
  return SOCKS5接口;

  function 关闭接口() {
    writer.releaseLock();
    reader.releaseLock();
    SOCKS5接口.close();
    return new Response('SOCKS5握手失败', { status: 400 });
  }
}

async function 解析SOCKS5账号(SOCKS5) {
  const [latter, former] = SOCKS5.split("@").reverse();
  let username, password, hostname, port;
  if (former) [username, password] = former.split(":");
  const latters = latter.split(":");
  port = Number(latters.pop());
  hostname = latters.join(":");
  return { username, password, hostname, port };
}

// UI 页面
function 生成注册页面() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background: url('${背景壁纸}') no-repeat center center fixed; background-size: cover; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); max-width: 400px; width: 90%; text-align: center; color: #fff; }
    h1 { font-size: 2em; color: #00e676; margin-bottom: 20px; }
    form { display: flex; flex-direction: column; gap: 15px; }
    input { padding: 12px; border: none; border-radius: 10px; background: rgba(255, 255, 255, 0.2); color: #fff; font-size: 16px; transition: all 0.3s; }
    input:focus { outline: none; background: rgba(255, 255, 255, 0.3); box-shadow: 0 0 10px rgba(0, 230, 118, 0.5); }
    button { padding: 12px; background: linear-gradient(135deg, #00e676, #00c853); border: none; border-radius: 10px; color: #fff; font-size: 16px; cursor: pointer; transition: all 0.3s; text-align: center; }
    button:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0, 230, 118, 0.5); }
    .message { margin-top: 15px; font-size: 14px; }
    .error { color: #ff5252; }
    .success { color: #00e676; }
  </style>
</head>
<body>
  <div class="card">
    <h1>注册管理员</h1>
    <form id="registerForm">
      <input type="text" name="username" placeholder="用户名" required>
      <input type="password" name="password" placeholder="密码" required>
      <button type="submit">注册</button>
    </form>
    <div class="message" id="message"></div>
  </div>
  <script>
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const messageDiv = document.getElementById('message');
      try {
        const response = await fetch('/register/submit', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok && result.success) {
          messageDiv.innerHTML = '<span class="success">注册成功，正在跳转...</span>';
          setTimeout(() => window.location.href = result.redirect || '/login', 1000);
        } else {
          messageDiv.innerHTML = '<span class="error">' + (result.error || '注册失败') + '</span>';
        }
      } catch (error) {
        messageDiv.innerHTML = '<span class="error">网络错误，请稍后重试</span>';
      }
    });
  </script>
</body>
</html>
  `;
}

function 生成订阅页面(订阅路径, hostName) {
  const 当前TXT路径 = 优选TXT路径.length ? 优选TXT路径.join('\n') : '';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      background: url('${背景壁纸}') no-repeat center center fixed; 
      background-size: cover; 
      font-family: 'Segoe UI', Arial, sans-serif; 
      min-height: 100vh; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      padding: 20px; 
      color: #fff; 
    }
    .container { 
      max-width: 900px; 
      width: 100%; 
      display: grid; 
      gap: 20px; 
    }
    .card { 
      background: rgba(255, 255, 255, 0.1); 
      backdrop-filter: blur(10px); 
      padding: 25px; 
      border-radius: 20px; 
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); 
      transition: transform 0.3s; 
      text-align: center; 
    }
    .card:hover { transform: translateY(-5px); }
    h1 { 
      font-size: 2.5em; 
      color: #00e676; 
      text-align: center; 
      margin-bottom: 30px; 
      text-shadow: 0 2px 10px rgba(0, 230, 118, 0.5); 
    }
    h3 { 
      font-size: 1.4em; 
      color: #00e676; 
      margin-bottom: 15px; 
    }
    .link-container p { 
      margin: 10px 0; 
      word-break: break-all; 
      font-size: 1em; 
    }
    .link-container a { 
      color: #00e676; 
      text-decoration: none; 
      transition: color 0.3s; 
    }
    .link-container a:hover { color: #00c853; }
    .btn { 
      padding: 12px 24px; 
      background: linear-gradient(135deg, #00e676, #00c853); 
      border: none; 
      border-radius: 10px; 
      color: #fff; 
      font-size: 16px; 
      cursor: pointer; 
      transition: all 0.3s; 
      width: 100%; 
      max-width: 200px; 
      text-align: center; 
    }
    .btn:hover { 
      transform: translateY(-3px); 
      box-shadow: 0 5px 15px rgba(0, 230, 118, 0.5); 
    }
    .small-btn { 
      display: inline-flex; 
      align-items: center; 
      gap: 8px; 
      padding: 8px 16px; 
      font-size: 14px; 
      background: linear-gradient(135deg, #2196F3, #1976D2); 
      border-radius: 10px; 
      color: #fff; 
      text-align: center; 
      transition: all 0.3s; 
      max-width: 140px; 
    }
    .small-btn:hover { 
      background: linear-gradient(135deg, #1976D2, #1565C0); 
      box-shadow: 0 5px 15px rgba(33, 150, 243, 0.5); 
    }
    .small-btn svg { 
      fill: #fff; 
      width: 18px; 
      height: 18px; 
    }
    .logout-btn { 
      background: linear-gradient(135deg, #ff5252, #d81b60); 
    }
    .logout-btn:hover { box-shadow: 0 5px 15px rgba(255, 82, 82, 0.5); }
    .button-group { 
      display: flex; 
      gap: 15px; 
      flex-wrap: wrap; 
      justify-content: center; 
    }
    .toggle-container { 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      gap: 15px; 
      margin: 15px 0; 
    }
    .toggle-label { font-size: 1em; }
    .toggle-switch { 
      position: relative; 
      width: 60px; 
      height: 30px; 
    }
    .toggle-switch input { 
      opacity: 0; 
      width: 0; 
      height: 0; 
    }
    .slider { 
      position: absolute; 
      top: 0; 
      left: 0; 
      right: 0; 
      bottom: 0; 
      background: #555; 
      border-radius: 30px; 
      transition: background 0.4s; 
    }
    .slider:before { 
      position: absolute; 
      content: ""; 
      height: 24px; 
      width: 24px; 
      left: 3px; 
      bottom: 3px; 
      background: #fff; 
      border-radius: 50%; 
      transition: transform 0.4s; 
    }
    input:checked + .slider { background: #00e676; }
    input:checked + .slider:before { transform: translateX(30px); }
    textarea { 
      width: 100%; 
      padding: 10px; 
      border: none; 
      border-radius: 10px; 
      background: rgba(255, 255, 255, 0.2); 
      color: #fff; 
      resize: vertical; 
      font-size: 1em; 
      transition: all 0.3s; 
    }
    textarea:focus { 
      outline: none; 
      background: rgba(255, 255, 255, 0.3); 
      box-shadow: 0 0 10px rgba(0, 230, 118, 0.5); 
    }
    .upload-container { 
      text-align: center; 
    }
    .upload-container input[type="file"] { display: none; }
    .upload-label { 
      display: inline-flex; 
      align-items: center; 
      gap: 8px; 
      padding: 10px 20px; 
      background: linear-gradient(135deg, #00e676, #00c853); 
      border-radius: 10px; 
      cursor: pointer; 
      transition: all 0.3s; 
      color: #fff; 
      font-size: 14px; 
    }
    .upload-label:hover { 
      transform: translateY(-3px); 
      box-shadow: 0 5px 15px rgba(0, 230, 118, 0.5); 
    }
    .upload-label svg { fill: #fff; width: 20px; height: 20px; }
    .file-list { 
      margin: 15px 0; 
      max-height: 120px; 
      overflow-y: auto; 
    }
    .file-item { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding: 8px 12px; 
      background: rgba(255, 255, 255, 0.15); 
      border-radius: 10px; 
      margin: 5px 0; 
      font-size: 14px; 
    }
    .progress-container { 
      display: none; 
      margin-top: 15px; 
    }
    .progress-bar { 
      width: 100%; 
      height: 20px; 
      background: rgba(255, 255, 255, 0.1); 
      border-radius: 10px; 
      overflow: hidden; 
      position: relative; 
    }
    .progress-fill { 
      height: 100%; 
      background: linear-gradient(90deg, #00e676, #00c853); 
      width: 0; 
      transition: width 0.3s ease-in-out; 
    }
    .progress-text { 
      position: absolute; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      font-size: 12px; 
      color: #fff; 
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5); 
    }
    @media (max-width: 600px) {
      .container { padding: 10px; }
      h1 { font-size: 2em; }
      .card { padding: 20px; }
      .btn { max-width: 100%; }
      .small-btn { max-width: 130px; }
      .button-group { gap: 10px; }
      .toggle-container { gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>订阅管理中心</h1>

    <!-- 订阅链接 -->
    <div class="card">
      <h3>订阅链接</h3>
      <div class="link-container">
        <p>${小猫}${咪}：<a href="https${符号}${hostName}/${订阅路径}/${小猫}${咪}">https${符号}${hostName}/${订阅路径}/${小猫}${咪}</a></p>
        <p>${歪兔}${蕊蒽}：<a href="https${符号}${hostName}/${订阅路径}/${歪兔}${蕊蒽}">https${符号}${hostName}/${订阅路径}/${歪兔}${蕊蒽}</a></p>
      </div>
    </div>

    <!-- 快速导入 -->
    <div class="card">
      <h3>快速导入</h3>
      <div class="button-group">
        <button class="small-btn" onclick="导入小猫咪('${订阅路径}', '${hostName}')">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17v-2h2v2h-2zm1-3c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z"/></svg>
          导入${小猫}${咪}
        </button>
        <button class="small-btn" onclick="导入${歪兔}${蕊蒽}('${订阅路径}', '${hostName}')">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
          导入${歪兔}${蕊蒽}
        </button>
      </div>
    </div>

    <!-- 设置 -->
    <div class="card">
      <h3>设置</h3>
      <form id="settingsForm" action="/${订阅路径}/update-settings" method="POST">
        <div class="toggle-container">
          <span class="toggle-label">反代开关</span>
          <label class="toggle-switch">
            <input type="checkbox" name="proxy" ${启用反代 ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="toggle-container">
          <span class="toggle-label">SOCKS5 开关</span>
          <label class="toggle-switch">
            <input type="checkbox" name="socks5" ${启用SOCKS5 ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div>
          <textarea name="txtPaths" placeholder="一行一个域名">${当前TXT路径}</textarea>
        </div>
        <button type="submit" class="btn" style="margin-top: 15px;">保存设置</button>
      </form>
    </div>

    <!-- 上传 IP -->
    <div class="card">
      <h3>上传优选 IP</h3>
      <form id="uploadForm" action="/${订阅路径}/upload" method="POST" enctype="multipart/form-data" class="upload-container">
        <label for="ipFiles" class="upload-label">
          <svg viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v5zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>
          选择文件
        </label>
        <input type="file" id="ipFiles" name="ipFiles" accept=".txt" multiple required onchange="显示文件()">
        <div class="file-list" id="fileList"></div>
        <button type="submit" class="btn" onclick="开始上传(event)">上传</button>
        <div class="progress-container" id="progressContainer">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
            <span class="progress-text" id="progressText">0%</span>
          </div>
        </div>
      </form>
    </div>

    <!-- 退出登录 -->
    <div class="card">
      <h3>账户管理</h3>
      <div class="button-group">
        <a href="/${订阅路径}/logout" class="btn logout-btn">退出登录</a>
      </div>
    </div>
  </div>
  <script>
    function 导入小猫咪(订阅路径, hostName) { window.location.href = '${小猫}${咪}://install-config?url=https://' + hostName + '/${订阅路径}/${小猫}${咪}'; }
    function 导入${歪兔}${蕊蒽}(订阅路径, hostName) { window.location.href = '${歪兔}${蕊蒽}://install-config?url=https://' + hostName + '/${订阅路径}/${歪兔}${蕊蒽}'; }
    function 显示文件() {
      const fileInput = document.getElementById('ipFiles');
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';
      Array.from(fileInput.files).forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = \`<span>\${file.name} (\${(file.size / 1024).toFixed(2)} KB)</span><button class="small-btn" onclick="移除文件(\${index})">移除</button>\`;
        fileList.appendChild(div);
      });
    }
    function 移除文件(index) {
      const fileInput = document.getElementById('ipFiles');
      const dt = new DataTransfer();
      Array.from(fileInput.files).forEach((file, i) => { if (i !== index) dt.items.add(file); });
      fileInput.files = dt.files;
      显示文件();
    }
    function 开始上传(event) {
      event.preventDefault();
      const form = document.getElementById('uploadForm');
      const progressContainer = document.getElementById('progressContainer');
      const progressFill = document.getElementById('progressFill');
      const progressText = document.getElementById('progressText');
      const formData = new FormData(form);

      if (!formData.getAll('ipFiles').length) {
        alert('请先选择文件！');
        return;
      }

      progressContainer.style.display = 'block';
      progressFill.style.width = '0%';
      progressText.textContent = '0%';

      const xhr = new XMLHttpRequest();
      xhr.open('POST', form.action, true);

      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          progressFill.style.width = percentComplete + '%';
          progressText.textContent = Math.round(percentComplete) + '%';
        }
      };

      xhr.onload = function() {
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status === 200) {
            alert(response.message);
            setTimeout(() => location.reload(), 500);
          } else {
            throw new Error(response.error || '未知错误');
          }
        } catch (err) {
          progressContainer.style.display = 'none';
          alert(\`上传失败，状态码: \${xhr.status}，原因: \${err.message}\`);
        }
      };

      xhr.onerror = function() {
        progressContainer.style.display = 'none';
        alert('上传出错，请检查网络后重试！');
      };

      xhr.send(formData);
    }

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        const response = await fetch('/${订阅路径}/update-settings', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
          alert(result.message);
          location.reload();
        } else {
          alert(result.error || '保存设置失败');
        }
      } catch (error) {
        alert('网络错误，请稍后重试');
      }
    });
  </script>
</body>
</html>
  `;
}

function 生成登录界面(锁定状态 = false, 剩余时间 = 0, 输错密码 = false, 剩余次数 = 0) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background: url('${背景壁纸}') no-repeat center center fixed; background-size: cover; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); max-width: 400px; width: 90%; text-align: center; color: #fff; }
    h1 { font-size: 2em; color: #00e676; margin-bottom: 20px; }
    form { display: flex; flex-direction: column; gap: 15px; }
    input { padding: 12px; border: none; border-radius: 10px; background: rgba(255, 255, 255, 0.2); color: #fff; font-size: 16px; transition: all 0.3s; }
    input:focus { outline: none; background: rgba(255, 255, 255, 0.3); box-shadow: 0 0 10px rgba(0, 230, 118, 0.5); }
    button { padding: 12px; background: linear-gradient(135deg, #00e676, #00c853); border: none; border-radius: 10px; color: #fff; font-size: 16px; cursor: pointer; transition: all 0.3s; text-align: center; }
    button:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0, 230, 118, 0.5); }
    .error { color: #ff5252; margin-top: 10px; font-size: 14px; }
    .lock-message { color: #ff5252; margin-top: 20px; font-size: 1.2em; }
  </style>
</head>
<body>
  <div class="card">
    <h1>请登录</h1>
    ${锁定状态 ? `
    <div class="lock-message">
      登录失败次数过多，请等待 <span id="countdown">${剩余时间}</span> 秒。
    </div>
    ` : `
    <form action="/login/submit" method="POST">
      <input type="text" name="username" placeholder="账号" required>
      <input type="password" name="password" placeholder="密码" required>
      <button type="submit">登录</button>
    </form>
    ${输错密码 && 剩余次数 > 0 ? `<div class="error">账号或密码错误，剩余尝试次数：${剩余次数}</div>` : ''}
    `}
  </div>
  <script>
    if (${锁定状态}) {
      const countdownElement = document.getElementById('countdown');
      let timeLeft = ${剩余时间};
      const timer = setInterval(() => {
        timeLeft--;
        countdownElement.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(timer);
          fetch('/reset-login-failures', { method: 'POST' }).then(() => window.location.reload());
        }
      }, 1000);
    }
  </script>
</body>
</html>
  `;
}

function 生成KV未绑定提示页面() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background: url('${背景壁纸}') no-repeat center center fixed; background-size: cover; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); max-width: 600px; width: 90%; text-align: center; color: #fff; }
    h1 { font-size: 2em; color: #ff5252; margin-bottom: 20px; }
    p { font-size: 1.2em; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>未绑定 KV 存储空间</h1>
    <p>请在 Cloudflare Workers 设置中绑定一个 KV 命名空间（如 LOGIN_STATE），然后重新部署服务。</p>
  </div>
</body>
</html>
  `;
}

function 生成猫咪配置(hostName) {
  const 节点列表 = 优选节点.length ? 优选节点 : [`${hostName}:443`];
  const 郭嘉分组 = {};

  节点列表.forEach((节点, 索引) => {
    const [主内容, tls] = 节点.split("@");
    const [地址端口, 节点名字 = 节点名称] = 主内容.split("#");
    const [, 地址, 端口 = "443"] = 地址端口.match(/^\[(.*?)\](?::(\d+))?$/) || 地址端口.match(/^(.*?)(?::(\d+))?$/);
    const 修正地址 = 地址.includes(":") ? 地址.replace(/^\[|\]$/g, '') : 地址;
    const TLS开关 = tls === 'notls' ? 'false' : 'true';
    const 郭嘉 = 节点名字.split('-')[0] || '默认';
    const 地址类型 = 修正地址.includes(":") ? "IPv6" : "IPv4";

    郭嘉分组[郭嘉] = 郭嘉分组[郭嘉] || { IPv4: [], IPv6: [] };
    郭嘉分组[郭嘉][地址类型].push({
      name: `${节点名字}-${郭嘉分组[郭嘉][地址类型].length + 1}`,
      config: `- name: "${节点名字}-${郭嘉分组[郭嘉][地址类型].length + 1}"
  type: ${歪啦}${伊埃斯}
  server: ${修正地址}
  port: ${端口}
  uuid: ${开门锁匙}
  udp: false
  tls: ${TLS开关}
  sni: ${hostName}
  network: ws
  ws-opts:
    path: "/?ed=2560"
    headers:
      Host: ${hostName}`
    });
  });

  const 郭嘉列表 = Object.keys(郭嘉分组).sort();
  const 节点配置 = 郭嘉列表.flatMap(郭嘉 => [...郭嘉分组[郭嘉].IPv4, ...郭嘉分组[郭嘉].IPv6].map(n => n.config)).join("\n");
  const 郭嘉分组配置 = 郭嘉列表.map(郭嘉 => `
  - name: "${郭嘉}"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 120
    tolerance: 50
    proxies:
${[...郭嘉分组[郭嘉].IPv4, ...郭嘉分组[郭嘉].IPv6].map(n => `      - "${n.name}"`).join("\n")}
`).join("");

  return `# Generated at: ${new Date().toISOString()}
mixed-port: 7890
allow-lan: true
mode: Rule
log-level: info
external-controller: :9090
dns:
  enable: true
  listen: 0.0.0.0:53
  default-nameserver:
    - 8.8.8.8
    - 1.1.1.1
  enhanced-mode: fake-ip
  nameserver:
    - tls://8.8.8.8
    - tls://1.1.1.1
  fallback:
    - tls://9.9.9.9
    - tls://1.0.0.1
  fallback-filter:
    geoip: true
    ipcidr:
      - 240.0.0.0/4

proxies:
${节点配置}

proxy-groups:
  - name: "🚀节点选择"
    type: select
    proxies:
      - "🤪自动选择"
      - "🥰负载均衡"
${郭嘉列表.map(郭嘉 => `      - "${郭嘉}"`).join("\n")}

  - name: "🤪自动选择"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 120
    tolerance: 50
    proxies:
${郭嘉列表.map(郭嘉 => `      - "${郭嘉}"`).join("\n")}

  - name: "🥰负载均衡"
    type: load-balance
    strategy: round-robin
    proxies:
${郭嘉列表.map(郭嘉 => `      - "${郭嘉}"`).join("\n")}

${郭嘉分组配置}

rules:
  - GEOIP,LAN,DIRECT
  - DOMAIN-SUFFIX,cn,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,🚀节点选择
`;
}

function 生成备用配置(hostName) {
  const 节点列表 = 优选节点.length ? 优选节点 : [`${hostName}:443`];
  const 配置列表 = 节点列表.map(节点 => {
    try {
      const [主内容, tls = 'tls'] = 节点.split("@");
      const [地址端口, 节点名字 = 节点名称] = 主内容.split("#");
      const match = 地址端口.match(/^(?:\[([0-9a-fA-F:]+)\]|([^:]+))(?:\:(\d+))?$/);
      if (!match) return null;
      const 地址 = match[1] || match[2];
      const 端口 = match[3] || "443";
      if (!地址) return null;
      const 修正地址 = 地址.includes(":") ? `[${地址}]` : 地址;
      const TLS开关 = tls === 'notls' ? 'none' : 'tls';
      const encodedPath = encodeURIComponent('/?ed=2560');
      return `${歪啦}${伊埃斯}://${开门锁匙}@${修正地址}:${端口}?encryption=none&security=${TLS开关}&type=ws&host=${hostName}&path=${encodedPath}&sni=${hostName}#${节点名字}`;
    } catch (error) {
      console.error(`生成V2Ray节点配置失败: ${节点}, 错误: ${error.message}`);
      return null;
    }
  }).filter(Boolean);

  return `# Generated at: ${new Date().toISOString()}
${配置列表.length ? 配置列表.join("\n") : `${歪啦}${伊埃斯}://${开门锁匙}@${hostName}:443?encryption=none&security=tls&type=ws&host=${hostName}&path=${encodeURIComponent('/?ed=2560')}&sni=${hostName}#默认节点`}`;
}