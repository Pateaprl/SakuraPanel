import { connect } from 'cloudflare:sockets';

const 配置 = {
  订阅路径: "config",
  开门锁匙: "03978e2f-2129-4c0c-8f15-22175dd0aba6",
  优选TXT路径: [
    'https://v2.i-sweet.us.kg/ips.txt',
    'https://v2.i-sweet.us.kg/url.txt',
    'https://这里可以无限扩展'
  ],
  反代地址: 'ts.hpc.tw',
  启用反代: true,
  启用SOCKS5: false,
  启用全局SOCKS5: false,
  SOCKS5账号: '',
  节点名称: '小仙女',
  伪装域名: 'lkssite.vip',
  账号: 'andypan',
  密码: 'Yyds@2023',
  最大失败次数: 5,
  锁定时间: 5 * 60 * 1000,
  小猫: 'cla',
  咪: 'sh',
  符号: '://',
  歪啦: 'vl',
  伊埃斯: 'ess',
  歪兔: 'v2',
  蕊蒽: 'rayN',
  白天背景壁纸: 'https://raw.githubusercontent.com/Alien-Et/ips/refs/heads/main/image/day.jpg',
  暗黑背景壁纸: 'https://raw.githubusercontent.com/Alien-Et/ips/refs/heads/main/image/night.jpg'
};

let 优选节点 = [];

function 创建响应(内容, 选项 = {}) {
  const 默认头 = {
    "Content-Type": 选项.contentType || "text/html;charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
  };
  return new Response(内容, {
    status: 选项.status || 200,
    headers: { ...默认头, ...选项.headers }
  });
}

async function 加载节点和配置(env, hostName) {
  try {
    const 手动节点缓存 = await env.LOGIN_STATE.get('manual_preferred_ips');
    const 手动节点列表 = 手动节点缓存 ? JSON.parse(手动节点缓存).map(line => line.trim()).filter(Boolean) : [];
    
    const 响应列表 = await Promise.all(配置.优选TXT路径.map(async 路径 => {
      try {
        const 响应 = await fetch(路径);
        if (!响应.ok) throw new Error(`状态码: ${响应.status}`);
        return (await 响应.text()).split('\n').map(line => line.trim()).filter(Boolean);
      } catch (错误) {
        console.error(`拉取 ${路径} 失败: ${错误.message}`);
        return [];
      }
    }));

    const 合并节点列表 = [...new Set([...手动节点列表, ...响应列表.flat()])];
    const 缓存节点 = await env.LOGIN_STATE.get('ip_preferred_ips');
    const 当前节点列表 = 缓存节点 ? JSON.parse(缓存节点) : [];
    
    if (合并节点列表.length > 0 && JSON.stringify(合并节点列表) !== JSON.stringify(当前节点列表)) {
      const 新版本 = String(Date.now());
      await Promise.all([
        env.LOGIN_STATE.put('ip_preferred_ips', JSON.stringify(合并节点列表), { expirationTtl: 86400 }),
        env.LOGIN_STATE.put('ip_preferred_ips_version', 新版本),
        env.LOGIN_STATE.put('config_clash', 生成猫咪配置(hostName), { expirationTtl: 86400 }),
        env.LOGIN_STATE.put('config_clash_version', 新版本),
        env.LOGIN_STATE.put('config_v2ray', 生成备用配置(hostName), { expirationTtl: 86400 }),
        env.LOGIN_STATE.put('config_v2ray_version', 新版本)
      ]);
      优选节点 = 合并节点列表;
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
  const 缓存键 = `config_${类型}`;
  const 版本键 = `${缓存键}_version`;
  const [缓存配置, 配置版本, 节点版本] = await Promise.all([
    env.LOGIN_STATE.get(缓存键),
    env.LOGIN_STATE.get(版本键) || '0',
    env.LOGIN_STATE.get('ip_preferred_ips_version') || '0'
  ]);

  if (缓存配置 && 配置版本 === 节点版本) return 缓存配置;
  
  const 新配置 = 类型 === 'clash' ? 生成猫咪配置(hostName) : 生成备用配置(hostName);
  await Promise.all([
    env.LOGIN_STATE.put(缓存键, 新配置, { expirationTtl: 86400 }),
    env.LOGIN_STATE.put(版本键, 节点版本)
  ]);
  return 新配置;
}

async function 检查锁定(env, 设备标识) {
  const 锁定时间戳 = await env.LOGIN_STATE.get(`lock_${设备标识}`);
  const 当前时间 = Date.now();
  const 被锁定 = 锁定时间戳 && 当前时间 < Number(锁定时间戳);
  return {
    被锁定,
    剩余时间: 被锁定 ? Math.ceil((Number(锁定时间戳) - 当前时间) / 1000) : 0
  };
}

export default {
  async fetch(请求, env) {
    try {
      if (!env.LOGIN_STATE) return 创建响应(生成KV未绑定提示页面());
      
      const url = new URL(请求.url);
      const hostName = 请求.headers.get('Host');
      const UA = 请求.headers.get('User-Agent') || 'unknown';
      const IP = 请求.headers.get('CF-Connecting-IP') || 'unknown';
      const 设备标识 = `${UA}_${IP}`;

      if (请求.headers.get('Upgrade') === 'websocket') {
        const 反代地址 = env.PROXYIP || 配置.反代地址;
        const SOCKS5账号 = env.SOCKS5 || 配置.SOCKS5账号;
        const 启用SOCKS5 = env.SOCKS5OPEN ? env.SOCKS5OPEN === 'true' : 配置.启用SOCKS5;
        const 启用全局SOCKS5 = env.SOCKS5GLOBAL ? env.SOCKS5GLOBAL === 'true' : 配置.启用全局SOCKS5;
        return await 升级请求(请求);
      }

      switch (url.pathname) {
        case '/reset-login-failures':
          await Promise.all([
            env.LOGIN_STATE.put(`fail_${设备标识}`, '0'),
            env.LOGIN_STATE.delete(`lock_${设备标识}`)
          ]);
          return 创建响应(null, { status: 200 });
          
        case `/${配置.订阅路径}`:
          const Token = 请求.headers.get('Cookie')?.split('=')[1];
          if (Token !== await env.LOGIN_STATE.get('current_token')) 
            return 创建响应(null, { status: 302, headers: { "Location": "/login" } });
          return 创建响应(生成订阅页面(配置.订阅路径, hostName));
          
        case '/login':
          const 锁定状态 = await 检查锁定(env, 设备标识);
          if (锁定状态.被锁定) return 创建响应(生成登录界面(true, 锁定状态.剩余时间));
          if (请求.headers.get('Cookie')?.split('=')[1] === await env.LOGIN_STATE.get('current_token'))
            return 创建响应(null, { status: 302, headers: { "Location": `/${配置.订阅路径}` } });
          const 失败次数 = Number(await env.LOGIN_STATE.get(`fail_${设备标识}`) || 0);
          return 创建响应(生成登录界面(false, 0, 失败次数 > 0, 配置.最大失败次数 - 失败次数));
          
        case '/login/submit':
          const 锁定 = await 检查锁定(env, 设备标识);
          if (锁定.被锁定) return 创建响应(null, { status: 302, headers: { "Location": "/login" } });
          const formData = await 请求.formData();
          const [提供的账号, 提供的密码] = [formData.get('username'), formData.get('password')];
          
          if (提供的账号 === 配置.账号 && 提供的密码 === 配置.密码) {
            const 新Token = Math.random().toString(36).substring(2);
            await Promise.all([
              env.LOGIN_STATE.put('current_token', 新Token, { expirationTtl: 300 }),
              env.LOGIN_STATE.put(`fail_${设备标识}`, '0')
            ]);
            return 创建响应(null, { 
              status: 302, 
              headers: { 
                "Location": `/${配置.订阅路径}`,
                "Set-Cookie": `token=${新Token}; Path=/; HttpOnly; SameSite=Strict`
              }
            });
          }
          let 失败次数 = Number(await env.LOGIN_STATE.get(`fail_${设备标识}`) || 0) + 1;
          await env.LOGIN_STATE.put(`fail_${设备标识}`, String(失败次数));
          if (失败次数 >= 配置.最大失败次数) {
            await env.LOGIN_STATE.put(`lock_${设备标识}`, String(Date.now() + 配置.锁定时间), { expirationTtl: 300 });
            return 创建响应(生成登录界面(true, 配置.锁定时间 / 1000));
          }
          return 创建响应(生成登录界面(false, 0, true, 配置.最大失败次数 - 失败次数));
          
        case `/${配置.订阅路径}/logout`:
          await env.LOGIN_STATE.delete('current_token');
          return 创建响应(null, { 
            status: 302, 
            headers: { 
              "Location": "/login",
              "Set-Cookie": "token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict"
            }
          });
          
        case `/${配置.订阅路径}/${配置.小猫}${配置.咪}`:
          await 加载节点和配置(env, hostName);
          return 创建响应(await 获取配置(env, 'clash', hostName), { contentType: "text/plain;charset=utf-8" });
          
        case `/${配置.订阅路径}/${配置.歪兔}${配置.蕊蒽}`:
          await 加载节点和配置(env, hostName);
          return 创建响应(await 获取配置(env, 'v2ray', hostName), { contentType: "text/plain;charset=utf-8" });
          
        case `/${配置.订阅路径}/upload`:
          const uploadToken = 请求.headers.get('Cookie')?.split('=')[1];
          if (uploadToken !== await env.LOGIN_STATE.get('current_token'))
            return 创建响应(JSON.stringify({ error: '未登录或Token无效，请重新登录' }), { status: 401, contentType: "application/json;charset=utf-8" });
          
          const formData = await 请求.formData();
          const ipFiles = formData.getAll('ipFiles');
          if (!ipFiles.length) 
            return 创建响应(JSON.stringify({ error: '未选择任何文件' }), { status: 400, contentType: "application/json;charset=utf-8" });
          
          let allIpList = [];
          for (const ipFile of ipFiles) {
            if (!ipFile?.text) throw new Error(`文件 ${ipFile.name} 无效`);
            const ipText = await ipFile.text();
            allIpList = allIpList.concat(ipText.split('\n').map(line => line.trim()).filter(Boolean));
          }
          if (!allIpList.length) 
            return 创建响应(JSON.stringify({ error: '所有上传文件内容为空' }), { status: 400, contentType: "application/json;charset=utf-8" });
          
          const uniqueIpList = [...new Set(allIpList)];
          const 当前手动节点 = await env.LOGIN_STATE.get('manual_preferred_ips');
          const 当前节点列表 = 当前手动节点 ? JSON.parse(当前手动节点) : [];
          if (JSON.stringify(当前节点列表.sort()) === JSON.stringify(uniqueIpList.sort()))
            return 创建响应(JSON.stringify({ message: '上传内容与现有节点相同，无需更新' }), { contentType: "application/json;charset=utf-8" });
          
          const 新版本 = String(Date.now());
          await Promise.all([
            env.LOGIN_STATE.put('manual_preferred_ips', JSON.stringify(uniqueIpList), { expirationTtl: 86400 }),
            env.LOGIN_STATE.put('ip_preferred_ips_version', 新版本),
            env.LOGIN_STATE.put('config_clash', 生成猫咪配置(hostName), { expirationTtl: 86400 }),
            env.LOGIN_STATE.put('config_clash_version', 新版本),
            env.LOGIN_STATE.put('config_v2ray', 生成备用配置(hostName), { expirationTtl: 86400 }),
            env.LOGIN_STATE.put('config_v2ray_version', 新版本)
          ]);
          return 创建响应(JSON.stringify({ message: '上传成功，即将跳转' }), { 
            contentType: "application/json;charset=utf-8",
            headers: { 'Location': `/${配置.订阅路径}` }
          });
          
        default:
          url.hostname = 配置.伪装域名;
          url.protocol = 'https:';
          return fetch(new Request(url, 请求));
      }
    } catch (error) {
      console.error(`全局错误: ${error.message}`);
      return 创建响应(JSON.stringify({ error: `服务器内部错误: ${error.message}` }), { status: 500, contentType: "application/json;charset=utf-8" });
    }
  }
};

async function 升级请求(请求) {
  const 创建接口 = new WebSocketPair();
  const [客户端, 服务端] = Object.values(创建接口);
  服务端.accept();
  const 结果 = await 解析头(解密(请求.headers.get('sec-websocket-protocol')));
  if (!结果) return 创建响应('Invalid request', { status: 400 });
  建立管道(服务端, 结果.TCP接口, 结果.初始数据);
  return 创建响应(null, { status: 101, webSocket: 客户端 });
}

function 解密(混淆字符) {
  return Uint8Array.from(atob(混淆字符.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)).buffer;
}

async function 解析头(数据) {
  const 数据数组 = new Uint8Array(数据);
  if (验证密钥(数据数组.slice(1, 17)) !== 配置.开门锁匙) return null;

  const 数据定位 = 数据数组[17];
  const 端口 = new DataView(数据.slice(18 + 数据定位 + 1, 20 + 数据定位 + 1)).getUint16(0);
  const 地址索引 = 20 + 数据定位 + 1;
  const 地址类型 = 数据数组[地址索引];
  let 地址 = '';
  const 地址信息索引 = 地址索引 + 1;

  switch (地址类型) {
    case 1: 地址 = new Uint8Array(数据.slice(地址信息索引, 地址信息索引 + 4)).join('.'); break;
    case 2: 地址 = new TextDecoder().decode(数据.slice(地址信息索引 + 1, 地址信息索引 + 1 + 数据数组[地址信息索引])); break;
    case 3: 地址 = Array.from({ length: 8 }, (_, i) => new DataView(数据.slice(地址信息索引, 地址信息索引 + 16)).getUint16(i * 2).toString(16)).join(':'); break;
    default: return null;
  }

  const 初始数据 = 数据.slice(地址信息索引 + (地址类型 === 2 ? 数据数组[地址信息索引] + 1 : 地址类型 === 1 ? 4 : 16));
  let TCP接口;
  if (配置.启用反代 && 配置.启用SOCKS5 && 配置.启用全局SOCKS5) {
    TCP接口 = await 创建SOCKS5(地址类型, 地址, 端口);
  } else {
    try {
      TCP接口 = connect({ hostname: 地址, port: 端口 });
      await TCP接口.opened;
    } catch {
      if (配置.启用反代) {
        TCP接口 = 配置.启用SOCKS5
          ? await 创建SOCKS5(地址类型, 地址, 端口)
          : connect({ hostname: 配置.反代地址.split(':')[0], port: 配置.反代地址.split(':')[1] || 端口 });
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
  const { username, password, hostname, port } = await 解析SOCKS5账号(配置.SOCKS5账号);
  const SOCKS5接口 = connect({ hostname, port });
  await SOCKS5接口.opened;
  const [writer, reader] = [SOCKS5接口.writable.getWriter(), SOCKS5接口.readable.getReader()];
  const encoder = new TextEncoder();

  await writer.write(new Uint8Array([5, 2, 0, 2]));
  let res = (await reader.read()).value;
  if (res[1] === 0x02) {
    if (!username || !password) return 关闭接口();
    await writer.write(new Uint8Array([1, username.length, ...encoder.encode(username), password.length, ...encoder.encode(password)]));
    res = (await reader.read()).value;
    if (res[0] !== 0x01 || res[1] !== 0x00) return 关闭接口();
  }

  const 转换地址 = 地址类型 === 1 ? new Uint8Array([1, ...地址.split('.').map(Number)])
    : 地址类型 === 2 ? new Uint8Array([3, 地址.length, ...encoder.encode(地址)])
    : new Uint8Array([4, ...地址.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]);
  
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
    return 创建响应('SOCKS5握手失败', { status: 400 });
  }
}

async function 解析SOCKS5账号(SOCKS5) {
  const [latter, former] = SOCKS5.split("@").reverse();
  const [username, password] = former ? former.split(":") : [null, null];
  const latters = latter.split(":");
  return { username, password, hostname: latters.slice(0, -1).join(":"), port: Number(latters.pop()) };
}

// HTML生成函数保持不变但精简重复样式
function 生成订阅页面(订阅路径, hostName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Comic Sans MS', 'Arial', sans-serif;
      color: #ff6f91;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      transition: background 0.5s ease;
    }
    @media (prefers-color-scheme: light) {
      body { background: linear-gradient(135deg, #ffe6f0, #fff0f5); }
      .card { background: rgba(255, 245, 247, 0.9); box-shadow: 0 8px 20px rgba(255, 182, 193, 0.3); }
      .link-box { background: rgba(255, 240, 245, 0.9); border: 2px dashed #ffb6c1; }
    }
    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(135deg, #1e1e2f, #2a2a3b); }
      .card { background: rgba(30, 30, 30, 0.9); color: #ffd1dc; box-shadow: 0 8px 20px rgba(255, 133, 162, 0.2); }
      .link-box { background: rgba(40, 40, 40, 0.9); border: 2px dashed #ff85a2; color: #ffd1dc; }
    }
    .background-media { position: fixed; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; }
    .container { max-width: 900px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 25px; }
    .card { border-radius: 25px; padding: 25px; width: 100%; max-width: 500px; text-align: center; position: relative; }
    .card-title { font-size: 1.6em; color: #ff69b4; margin-bottom: 15px; }
    .link-box { border-radius: 15px; padding: 15px; margin: 10px 0; word-break: break-all; }
    .cute-button { padding: 12px 25px; border-radius: 20px; border: none; color: white; cursor: pointer; }
    .clash-btn { background: linear-gradient(to right, #ffb6c1, #ff69b4); }
    .v2ray-btn { background: linear-gradient(to right, #ffd1dc, #ff85a2); }
    .logout-btn { background: linear-gradient(to right, #ff9999, #ff6666); }
    .upload-submit { background: linear-gradient(to right, #ffdead, #ff85a2); }
  </style>
</head>
<body>
  <img id="backgroundImage" class="background-media" alt="Background">
  <div class="container">
    <div class="card"><h1 class="card-title">🌸 欢迎来到小仙女订阅站 🌸</h1></div>
    <div class="card">
      <h2 class="card-title">🐾 ${配置.小猫}${配置.咪} 订阅</h2>
      <div class="link-box"><a href="https${配置.符号}${hostName}/${订阅路径}/${配置.小猫}${配置.咪}">https${配置.符号}${hostName}/${订阅路径}/${配置.小猫}${配置.咪}</a></div>
      <button class="cute-button clash-btn" onclick="导入小猫咪('${订阅路径}', '${hostName}')">一键导入</button>
    </div>
    <div class="card">
      <h2 class="card-title">🐰 ${配置.歪兔}${配置.蕊蒽} 订阅</h2>
      <div class="link-box"><a href="https${配置.符号}${hostName}/${订阅路径}/${配置.歪兔}${配置.蕊蒽}">https${配置.符号}${hostName}/${订阅路径}/${配置.歪兔}${配置.蕊蒽}</a></div>
      <button class="cute-button v2ray-btn" onclick="导入${配置.歪兔}${配置.蕊蒽}('${订阅路径}', '${hostName}')">一键导入</button>
    </div>
    <div class="card">
      <form id="uploadForm" action="/${订阅路径}/upload" method="POST" enctype="multipart/form-data">
        <h2 class="card-title">🌟 上传你的魔法 IP</h2>
        <input type="file" id="ipFiles" name="ipFiles" accept=".txt" multiple required style="display: none;">
        <button type="submit" class="cute-button upload-submit">上传</button>
      </form>
    </div>
    <div class="card"><a href="/${订阅路径}/logout" class="cute-button logout-btn">退出登录</a></div>
  </div>
  <script>
    const lightBg = '${配置.白天背景壁纸}';
    const darkBg = '${配置.暗黑背景壁纸}';
    const bgImage = document.getElementById('backgroundImage');
    function updateBackground() { bgImage.src = window.matchMedia('(prefers-color-scheme: dark)').matches ? darkBg : lightBg; }
    updateBackground();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBackground);
    function 导入小猫咪(订阅路径, hostName) { window.location.href = '${配置.小猫}${配置.咪}${配置.符号}install-config?url=https://${hostName}/${订阅路径}/${配置.小猫}${配置.咪}'; }
    function 导入${配置.歪兔}${配置.蕊蒽}(订阅路径, hostName) { window.location.href = '${配置.歪兔}${配置.蕊蒽}${配置.符号}install-config?url=https://${hostName}/${订阅路径}/${配置.歪兔}${配置.蕊蒽}'; }
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
    body {
      font-family: 'Comic Sans MS', 'Arial', sans-serif;
      color: #ff6f91;
      margin: 0;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: background 0.5s ease;
    }
    @media (prefers-color-scheme: light) { body { background: linear-gradient(135deg, #ffe6f0, #fff0f5); } }
    @media (prefers-color-scheme: dark) { body { background: linear-gradient(135deg, #1e1e2f, #2a2a3b); } }
    .background-media { position: fixed; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; }
    .content { padding: 30px; border-radius: 25px; max-width: 400px; width: 90%; text-align: center; }
    h1 { font-size: 1.8em; color: #ff69b4; margin-bottom: 20px; }
    .login-form { display: flex; flex-direction: column; gap: 15px; max-width: 300px; margin: 0 auto; }
    .login-form input { padding: 12px; border-radius: 15px; border: 2px solid #ffb6c1; }
    .login-form button { padding: 12px; background: linear-gradient(to right, #ffb6c1, #ff69b4); color: white; border: none; border-radius: 20px; }
  </style>
</head>
<body>
  <img id="backgroundImage" class="background-media" alt="Background">
  <div class="content">
    <h1>🌷 小仙女登录 🌷</h1>
    ${锁定状态 ? `<div>密码输错太多次啦，请等待 <span id="countdown">${剩余时间}</span> 秒哦~</div>` : `
    <form class="login-form" action="/login/submit" method="POST">
      <input type="text" name="username" placeholder="账号" required>
      <input type="password" name="password" placeholder="密码" required>
      <button type="submit">登录</button>
    </form>
    ${输错密码 && 剩余次数 > 0 ? `<div>密码不对哦，还剩 ${剩余次数} 次机会~</div>` : ''}`}
  </div>
  <script>
    const lightBg = '${配置.白天背景壁纸}';
    const darkBg = '${配置.暗黑背景壁纸}';
    const bgImage = document.getElementById('backgroundImage');
    function updateBackground() { bgImage.src = window.matchMedia('(prefers-color-scheme: dark)').matches ? darkBg : lightBg; }
    updateBackground();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBackground);
    if (${锁定状态}) {
      let lockEndTime = localStorage.getItem('lockEndTime') || (Date.now() + ${剩余时间} * 1000);
      localStorage.setItem('lockEndTime', lockEndTime);
      const countdown = document.getElementById('countdown');
      const timer = setInterval(() => {
        const remaining = Math.ceil((lockEndTime - Date.now()) / 1000);
        if (remaining > 0) countdown.textContent = remaining;
        else { clearInterval(timer); localStorage.removeItem('lockEndTime'); fetch('/reset-login-failures', { method: 'POST' }).then(() => window.location.reload()); }
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
    body { font-family: 'Comic Sans MS', 'Arial', sans-serif; color: #ff6f91; margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center; }
    @media (prefers-color-scheme: light) { body { background: linear-gradient(135deg, #ffe6f0, #fff0f5); } }
    @media (prefers-color-scheme: dark) { body { background: linear-gradient(135deg, #1e1e2f, #2a2a3b); } }
    .background-media { position: fixed; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; }
    .content { padding: 30px; border-radius: 25px; max-width: 500px; width: 90%; text-align: center; }
    h1 { font-size: 1.8em; color: #ff69b4; margin-bottom: 20px; }
  </style>
</head>
<body>
  <img id="backgroundImage" class="background-media" alt="Background">
  <div class="content">
    <h1>💔 哎呀，KV没绑定哦</h1>
    <p>小仙女，你的 Cloudflare KV 存储空间还没绑定呢~<br>快去 Cloudflare Workers 设置里绑一个 KV 命名空间（比如 LOGIN_STATE），然后重新部署一下吧！</p>
  </div>
  <script>
    const lightBg = '${配置.白天背景壁纸}';
    const darkBg = '${配置.暗黑背景壁纸}';
    const bgImage = document.getElementById('backgroundImage');
    function updateBackground() { bgImage.src = window.matchMedia('(prefers-color-scheme: dark)').matches ? darkBg : lightBg; }
    updateBackground();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBackground);
  </script>
</body>
</html>
  `;
}

function 生成猫咪配置(hostName) {
  const 节点列表 = 优选节点.length ? 优选节点 : [`${hostName}:443`];
  const 郭嘉分组 = {};

  节点列表.forEach((节点, 索引) => {
    const [主内容, tls] = 节点.split("@");
    const [地址端口, 节点名字 = 配置.节点名称] = 主内容.split("#");
    const [, 地址, 端口 = "443"] = 地址端口.match(/^\[(.*?)\](?::(\d+))?$/) || 地址端口.match(/^(.*?)(?::(\d+))?$/);
    const 修正地址 = 地址.includes(":") ? 地址.replace(/^\[|\]$/g, '') : 地址;
    const TLS开关 = tls === 'notls' ? 'false' : 'true';
    const 郭嘉 = 节点名字.split('-')[0] || '默认';
    const 地址类型 = 修正地址.includes(":") ? "IPv6" : "IPv4";

    郭嘉分组[郭嘉] = 郭嘉分组[郭嘉] || { IPv4: [], IPv6: [] };
    郭嘉分组[郭嘉][地址类型].push({
      name: `${节点名字}-${郭嘉分组[郭嘉][地址类型].length + 1}`,
      config: `- name: "${节点名字}-${郭嘉分组[郭嘉][地址类型].length + 1}"
  type: ${配置.歪啦}${配置.伊埃斯}
  server: ${修正地址}
  port: ${端口}
  uuid: ${配置.开门锁匙}
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
  default-nameserver: [8.8.8.8, 1.1.1.1]
  enhanced-mode: fake-ip
  nameserver: [tls://8.8.8.8, tls://1.1.1.1]
  fallback: [tls://9.9.9.9, tls://1.0.0.1]
  fallback-filter: { geoip: true, ipcidr: ["240.0.0.0/4"] }
proxies:
${节点配置}
proxy-groups:
  - name: "🚀节点选择"
    type: select
    proxies: ["🤪自动选择", "🥰负载均衡", ...${JSON.stringify(郭嘉列表.map(郭嘉 => `${郭嘉}`))}]
  - name: "🤪自动选择"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 120
    tolerance: 50
    proxies: ${JSON.stringify(郭嘉列表.map(郭嘉 => `${郭嘉}`))}
  - name: "🥰负载均衡"
    type: load-balance
    strategy: round-robin
    proxies: ${JSON.stringify(郭嘉列表.map(郭嘉 => `${郭嘉}`))}
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
      const [地址端口, 节点名字 = 配置.节点名称] = 主内容.split("#");
      const match = 地址端口.match(/^(?:\[([0-9a-fA-F:]+)\]|([^:]+))(?:\:(\d+))?$/);
      if (!match) return null;
      const 地址 = match[1] || match[2];
      const 端口 = match[3] || "443";
      const 修正地址 = 地址.includes(":") ? `[${地址}]` : 地址;
      const TLS开关 = tls === 'notls' ? 'none' : 'tls';
      const encodedPath = encodeURIComponent('/?ed=2560');
      return `${配置.歪啦}${配置.伊埃斯}://${配置.开门锁匙}@${修正地址}:${端口}?encryption=none&security=${TLS开关}&type=ws&host=${hostName}&path=${encodedPath}&sni=${hostName}#${节点名字}`;
    } catch (error) {
      console.error(`生成V2Ray节点配置失败: ${节点}, 错误: ${error.message}`);
      return null;
    }
  }).filter(Boolean);

  return `# Generated at: ${new Date().toISOString()}
${配置列表.length ? 配置列表.join("\n") : `${配置.歪啦}${配置.伊埃斯}://${配置.开门锁匙}@${hostName}:443?encryption=none&security=tls&type=ws&host=${hostName}&path=${encodeURIComponent('/?ed=2560')}&sni=${hostName}#默认节点`}`;
}