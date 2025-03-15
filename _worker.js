import { connect } from 'cloudflare:sockets';

let 订阅路径 = "config";
let 开门锁匙 = "03978e2f-2129-4c0c-8f15-22175dd0aba6";
let 优选TXT路径 = [
  'https://v2.i-sweet.us.kg/ips.txt',
  'https://v2.i-sweet.us.kg/url.txt',
  'https://这里可以无限扩展'
];
let 优选节点 = [];
let 反代地址 = 'ts.hpc.tw';
let SOCKS5账号 = '';
let 节点名称 = '小仙女';
let 伪装域名 = 'lkssite.vip';
let 账号 = 'andypan';
let 密码 = 'Yyds@2023';
let 最大失败次数 = 5;
let 锁定时间 = 5 * 60 * 1000;
let 小猫 = 'cla';
let 咪 = 'sh';
let 符号 = '://';
let 歪啦 = 'vl';
let 伊埃斯 = 'ess';
let 歪兔 = 'v2';
let 蕊蒽 = 'rayng';
let 白天背景壁纸 = 'https://raw.githubusercontent.com/Alien-Et/ips/refs/heads/main/image/day.jpg';
let 暗黑背景壁纸 = 'https://raw.githubusercontent.com/Alien-Et/ips/refs/heads/main/image/night.jpg';

function 创建HTML响应(内容, 状态码 = 200) {
  return new Response(内容, {
    status: 状态码,
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

function 创建重定向响应(路径, 额外头 = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      "Location": 路径,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      ...额外头
    }
  });
}

function 创建JSON响应(数据, 状态码 = 200, 额外头 = {}) {
  return new Response(JSON.stringify(数据), {
    status: 状态码,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      ...额外头
    }
  });
}

async function 加载节点和配置(env, hostName) {
  try {
    const 手动节点缓存 = await env.LOGIN_STATE.get('manual_preferred_ips');
    let 手动节点列表 = 手动节点缓存 ? JSON.parse(手动节点缓存).map(line => line.trim()).filter(Boolean) : [];

    const 响应列表 = await Promise.all(
      优选TXT路径.map(async (路径) => {
        try {
          const 响应 = await fetch(路径);
          if (!响应.ok) return [];
          const 文本 = await 响应.text();
          return 文本.split('\n').map(line => line.trim()).filter(Boolean);
        } catch {
          return [];
        }
      })
    );

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
  } catch {
    const 缓存节点 = await env.LOGIN_STATE.get('ip_preferred_ips');
    优选节点 = 缓存节点 ? JSON.parse(缓存节点) : [`${hostName}:443`];
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
  return {
    被锁定,
    剩余时间: 被锁定 ? Math.ceil((Number(锁定时间戳) - 当前时间) / 1000) : 0
  };
}

export default {
  async fetch(请求, env) {
    try {
      if (!env.LOGIN_STATE) return 创建HTML响应(生成KV未绑定提示页面());

      const 请求头 = 请求.headers.get('Upgrade');
      const url = new URL(请求.url);
      const hostName = 请求.headers.get('Host');
      const UA = 请求.headers.get('User-Agent') || 'unknown';
      const IP = 请求.headers.get('CF-Connecting-IP') || 'unknown';
      const 设备标识 = `${UA}_${IP}`;

      if (!请求头 || 请求头 !== 'websocket') {
        switch (url.pathname) {
          case '/reset-login-failures':
            await env.LOGIN_STATE.put(`fail_${设备标识}`, '0');
            await env.LOGIN_STATE.delete(`lock_${设备标识}`);
            return new Response(null, { status: 200 });
          case `/${订阅路径}`:
            const Token = 请求.headers.get('Cookie')?.split('=')[1];
            const 有效Token = await env.LOGIN_STATE.get('current_token');
            if (!Token || Token !== 有效Token) return 创建重定向响应('/login');
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
            const formData = await 请求.formData();
            const 提供的账号 = formData.get('username');
            const 提供的密码 = formData.get('password');
            if (提供的账号 === 账号 && 提供的密码 === 密码) {
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
          case `/${订阅路径}/upload`:
            const uploadToken = 请求.headers.get('Cookie')?.split('=')[1];
            const 有效UploadToken = await env.LOGIN_STATE.get('current_token');
            if (!uploadToken || uploadToken !== 有效UploadToken) {
              return 创建JSON响应({ error: '未登录或Token无效' }, 401);
            }
            const formData = await 请求.formData();
            const ipFiles = formData.getAll('ipFiles');
            if (!ipFiles.length) return 创建JSON响应({ error: '未选择文件' }, 400);
            let allIpList = [];
            for (const ipFile of ipFiles) {
              const ipText = await ipFile.text();
              allIpList = allIpList.concat(ipText.split('\n').map(line => line.trim()).filter(Boolean));
            }
            if (!allIpList.length) return 创建JSON响应({ error: '文件内容为空' }, 400);
            const uniqueIpList = [...new Set(allIpList)];
            const 当前手动节点 = await env.LOGIN_STATE.get('manual_preferred_ips');
            const 当前节点列表 = 当前手动节点 ? JSON.parse(当前手动节点) : [];
            const 是重复上传 = JSON.stringify(当前节点列表.sort()) === JSON.stringify(uniqueIpList.sort());
            if (是重复上传) return 创建JSON响应({ message: '上传内容相同' }, 200);
            await env.LOGIN_STATE.put('manual_preferred_ips', JSON.stringify(uniqueIpList), { expirationTtl: 86400 });
            const 新版本 = String(Date.now());
            await env.LOGIN_STATE.put('ip_preferred_ips_version', 新版本);
            await env.LOGIN_STATE.put('config_clash', 生成猫咪配置(hostName), { expirationTtl: 86400 });
            await env.LOGIN_STATE.put('config_clash_version', 新版本);
            await env.LOGIN_STATE.put('config_v2ray', 生成备用配置(hostName), { expirationTtl: 86400 });
            await env.LOGIN_STATE.put('config_v2ray_version', 新版本);
            return 创建JSON响应({ message: '上传成功' }, 200, { 'Location': `/${订阅路径}` });
          case '/set-proxy-state':
            const formData = await 请求.formData();
            const proxyEnabled = formData.get('proxyEnabled');
            const proxyType = formData.get('proxyType');
            await env.LOGIN_STATE.put('proxyEnabled', proxyEnabled);
            await env.LOGIN_STATE.put('proxyType', proxyType);
            return new Response(null, { status: 200 });
          case '/get-proxy-status':
            const 代理启用 = await env.LOGIN_STATE.get('proxyEnabled') === 'true';
            const 代理类型 = await env.LOGIN_STATE.get('proxyType') || 'reverse';
            let status = '直连';
            if (代理启用) status = 代理类型 === 'reverse' && 反代地址 ? '反代' : 代理类型 === 'socks5' && SOCKS5账号 ? 'SOCKS5' : '直连';
            return 创建JSON响应({ status });
          default:
            url.hostname = 伪装域名;
            url.protocol = 'https:';
            return fetch(new Request(url, 请求));
        }
      } else if (请求头 === 'websocket') {
        反代地址 = env.PROXYIP || 反代地址;
        SOCKS5账号 = env.SOCKS5 || SOCKS5账号;
        return await 升级请求(请求, env);
      }
    } catch {
      return 创建JSON响应({ error: '服务器错误' }, 500);
    }
  }
};

async function 升级请求(请求, env) {
  const 创建接口 = new WebSocketPair();
  const [客户端, 服务端] = Object.values(创建接口);
  服务端.accept();
  const 结果 = await 解析头(解密(请求.headers.get('sec-websocket-protocol')), env);
  if (!结果) return new Response('Invalid request', { status: 400 });
  const { TCP接口, 初始数据 } = 结果;
  建立管道(服务端, TCP接口, 初始数据);
  return new Response(null, { status: 101, webSocket: 客户端 });
}

function 解密(混淆字符) {
  混淆字符 = 混淆字符.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(混淆字符), c => c.charCodeAt(0)).buffer;
}

async function 解析头(数据, env) {
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
  const TCP接口 = await 智能连接(地址, 端口, 地址类型, env);
  return { TCP接口, 初始数据 };
}

async function 智能连接(地址, 端口, 地址类型, env) {
  const 反代地址 = env.PROXYIP || 'ts.hpc.tw';
  const SOCKS5账号 = env.SOCKS5 || '';

  if (!地址 || 地址.trim() === '') return await 尝试直连(地址, 端口);

  const 是域名 = 地址类型 === 2 && !地址.match(/^\d+\.\d+\.\d+\.\d+$/);
  const 是IP = 地址类型 === 1 || (地址类型 === 2 && 地址.match(/^\d+\.\d+\.\d+\.\d+$/)) || 地址类型 === 3;

  if (是域名 || 是IP) {
    const 代理启用 = await env.LOGIN_STATE.get('proxyEnabled') === 'true';
    const 代理类型 = await env.LOGIN_STATE.get('proxyType') || 'reverse';

    if (!代理启用) return await 尝试直连(地址, 端口);

    if (代理类型 === 'reverse' && 反代地址) {
      const [反代主机, 反代端口] = 反代地址.split(':');
      const 连接 = connect({ hostname: 反代主机, port: 反代端口 || 端口 });
      await 连接.opened;
      return 连接;
    } else if (代理类型 === 'socks5' && SOCKS5账号) {
      return await 创建SOCKS5(地址类型, 地址, 端口);
    }
  }
  return await 尝试直连(地址, 端口);
}

async function 尝试直连(地址, 端口) {
  const 连接 = connect({ hostname: 地址, port: 端口 });
  await 连接.opened;
  return 连接;
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
  await SOCKS5接口.opened;
  const writer = SOCKS5接口.writable.getWriter();
  const reader = SOCKS5接口.readable.getReader();
  const encoder = new TextEncoder();
  await writer.write(new Uint8Array([5, 2, 0, 2]));
  let res = (await reader.read()).value;
  if (res[1] === 0x02) {
    if (!username || !password) return 关闭接口(writer, reader, SOCKS5接口);
    await writer.write(new Uint8Array([1, username.length, ...encoder.encode(username), password.length, ...encoder.encode(password)]));
    res = (await reader.read()).value;
    if (res[0] !== 0x01 || res[1] !== 0x00) return 关闭接口(writer, reader, SOCKS5接口);
  }
  let 转换地址;
  switch (地址类型) {
    case 1: 转换地址 = new Uint8Array([1, ...地址.split('.').map(Number)]); break;
    case 2: 转换地址 = new Uint8Array([3, 地址.length, ...encoder.encode(地址)]); break;
    case 3: 转换地址 = new Uint8Array([4, ...地址.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]); break;
    default: return 关闭接口(writer, reader, SOCKS5接口);
  }
  await writer.write(new Uint8Array([5, 1, 0, ...转换地址, 端口 >> 8, 端口 & 0xff]));
  res = (await reader.read()).value;
  if (res[0] !== 0x05 || res[1] !== 0x00) return 关闭接口(writer, reader, SOCKS5接口);
  writer.releaseLock();
  reader.releaseLock();
  return SOCKS5接口;

  function 关闭接口(writer, reader, 接口) {
    writer.releaseLock();
    reader.releaseLock();
    接口.close();
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

function 生成订阅页面(订阅路径, hostName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #ff6f91;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    @media (prefers-color-scheme: light) {
      body { background: #fff0f5; }
      .card { background: rgba(255, 245, 247, 0.9); }
      .card::before { border: 2px dashed #ffb6c1; }
      .card::after { color: #ff69b4; }
      .card:hover { box-shadow: 0 8px 15px rgba(255, 182, 193, 0.3); }
      .link-box, .proxy-status { background: rgba(255, 240, 245, 0.9); border: 2px dashed #ffb6c1; }
      .file-item { background: rgba(255, 245, 247, 0.9); }
    }
    @media (prefers-color-scheme: dark) {
      body { background: #2a2a3b; }
      .card { background: rgba(30, 30, 30, 0.9); }
      .card::before { border: 2px dashed #ff85a2; }
      .card::after { color: #ff85a2; }
      .card:hover { box-shadow: 0 8px 15px rgba(255, 133, 162, 0.3); }
      .link-box, .proxy-status { background: rgba(40, 40, 40, 0.9); border: 2px dashed #ff85a2; color: #ffd1dc; }
      .link-box a { color: #ff85a2; }
      .link-box a:hover { color: #ff1493; }
      .file-item { background: rgba(50, 50, 50, 0.9); color: #ffd1dc; }
    }
    .container {
      max-width: 900px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .card {
      border-radius: 20px;
      padding: 20px;
      width: 100%;
      max-width: 500px;
      text-align: center;
      position: relative;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border-radius: 15px;
    }
    .card::after {
      content: '🎀';
      position: absolute;
      top: -10px;
      right: -10px;
      font-size: 2em;
      transform: rotate(45deg);
    }
    .card:hover {
      transform: scale(1.02);
    }
    .card-title {
      font-size: 1.5em;
      margin-bottom: 10px;
      color: #ff69b4;
    }
    .switch-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 25px;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 25px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: #ff69b4;
    }
    input:checked + .slider:before {
      transform: translateX(25px);
    }
    .proxy-capsule {
      display: flex;
      border-radius: 15px;
      background: #ffe6f0;
    }
    .proxy-option {
      width: 70px;
      padding: 8px 0;
      text-align: center;
      cursor: pointer;
      color: #ff6f91;
      transition: background 0.2s ease;
    }
    .proxy-option.active {
      background: #ff69b4;
      color: white;
    }
    .proxy-option:not(.active):hover {
      background: #ffd1dc;
    }
    .proxy-status {
      margin-top: 15px;
      padding: 10px;
      border-radius: 10px;
      font-size: 0.9em;
    }
    .link-box {
      border-radius: 10px;
      padding: 10px;
      margin: 10px 0;
      font-size: 0.9em;
    }
    .link-box a {
      color: #ff69b4;
      text-decoration: none;
    }
    .link-box a:hover {
      color: #ff1493;
    }
    .button-group {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 10px;
    }
    .cute-button {
      padding: 10px 20px;
      border-radius: 15px;
      border: none;
      font-size: 0.9em;
      color: white;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    .cute-button:hover {
      transform: scale(1.05);
    }
    .clash-btn { background: #ff69b4; }
    .v2ray-btn { background: #ff85a2; }
    .logout-btn { background: #ff6666; }
    .upload-title {
      font-size: 1.3em;
      color: #ff85a2;
      margin-bottom: 10px;
    }
    .upload-label {
      padding: 8px 15px;
      background: #ff69b4;
      color: white;
      border-radius: 15px;
      cursor: pointer;
      display: inline-block;
      transition: transform 0.2s ease;
    }
    .upload-label:hover {
      transform: scale(1.05);
    }
    .file-list {
      margin: 10px 0;
      max-height: 100px;
      overflow-y: auto;
    }
    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 10px;
      border-radius: 8px;
      margin: 5px 0;
      font-size: 0.85em;
    }
    .file-item button {
      background: #ff9999;
      border: none;
      border-radius: 10px;
      padding: 3px 8px;
      color: white;
      cursor: pointer;
    }
    .file-item button:hover {
      background: #ff6666;
    }
    .upload-submit {
      background: #ff85a2;
      padding: 10px 20px;
      border-radius: 15px;
      border: none;
      color: white;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    .upload-submit:hover {
      transform: scale(1.05);
    }
    @media (max-width: 600px) {
      .card { padding: 15px; max-width: 90%; }
      .card-title { font-size: 1.2em; }
      .card::before { top: 6px; left: 6px; right: 6px; bottom: 6px; }
      .card::after { font-size: 1.5em; top: -8px; right: -8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1 class="card-title">欢迎来到订阅站</h1>
      <p style="font-size: 0.9em;">支持 ${小猫}${咪} 和 ${歪兔}${蕊蒽}</p>
    </div>
    <div class="card">
      <h2 class="card-title">代理设置</h2>
      <div class="switch-container">
        <div class="toggle-row">
          <label>代理开关</label>
          <label class="toggle-switch">
            <input type="checkbox" id="proxyToggle" onchange="toggleProxy()">
            <span class="slider"></span>
          </label>
        </div>
        <div class="proxy-capsule" id="proxyCapsule">
          <div class="proxy-option active" data-type="reverse" onclick="switchProxyType('reverse')">反代</div>
          <div class="proxy-option" data-type="socks5" onclick="switchProxyType('socks5')">SOCKS5</div>
        </div>
      </div>
      <div class="proxy-status" id="proxyStatus">直连</div>
    </div>
    <div class="card">
      <h2 class="card-title">${小猫}${咪} 订阅</h2>
      <div class="link-box">
        <p>订阅链接：<br><a href="https${符号}${hostName}/${订阅路径}/${小猫}${咪}">https${符号}${hostName}/${订阅路径}/${小猫}${咪}</a></p>
      </div>
      <div class="button-group">
        <button class="cute-button clash-btn" onclick="导入小猫咪('${订阅路径}', '${hostName}')">一键导入</button>
      </div>
    </div>
    <div class="card">
      <h2 class="card-title">${歪兔}${蕊蒽} 订阅</h2>
      <div class="link-box">
        <p>订阅链接：<br><a href="https${符号}${hostName}/${订阅路径}/${歪兔}${蕊蒽}">https${符号}${hostName}/${订阅路径}/${歪兔}${蕊蒽}</a></p>
      </div>
      <div class="button-group">
        <button class="cute-button v2ray-btn" onclick="导入${歪兔}${蕊蒽}('${订阅路径}', '${hostName}')">一键导入</button>
      </div>
    </div>
    <div class="card">
      <h2 class="upload-title">上传 IP</h2>
      <form id="uploadForm" action="/${订阅路径}/upload" method="POST" enctype="multipart/form-data">
        <label for="ipFiles" class="upload-label">选择文件</label>
        <input type="file" id="ipFiles" name="ipFiles" accept=".txt" multiple required onchange="显示文件()" style="display: none;">
        <div class="file-list" id="fileList"></div>
        <button type="submit" class="upload-submit" onclick="开始上传(event)">上传</button>
      </form>
    </div>
    <div class="card">
      <div class="button-group">
        <a href="/${订阅路径}/logout" class="cute-button logout-btn">退出登录</a>
      </div>
    </div>
  </div>
  <script>
    let proxyEnabled = localStorage.getItem('proxyEnabled') === 'true';
    let proxyType = localStorage.getItem('proxyType') || 'reverse';
    document.getElementById('proxyToggle').checked = proxyEnabled;
    updateProxyCapsuleUI();
    updateProxyStatus();

    function toggleProxy() {
      proxyEnabled = document.getElementById('proxyToggle').checked;
      localStorage.setItem('proxyEnabled', proxyEnabled);
      updateProxyCapsuleUI();
      saveProxyState();
      updateProxyStatus();
    }

    function switchProxyType(type) {
      proxyType = type;
      localStorage.setItem('proxyType', proxyType);
      updateProxyCapsuleUI();
      saveProxyState();
      updateProxyStatus();
    }

    function updateProxyCapsuleUI() {
      const options = document.querySelectorAll('.proxy-option');
      options.forEach(opt => opt.classList.toggle('active', opt.dataset.type === proxyType));
      document.getElementById('proxyCapsule').style.display = proxyEnabled ? 'flex' : 'none';
    }

    function updateProxyStatus() {
      const statusElement = document.getElementById('proxyStatus');
      if (!proxyEnabled) {
        statusElement.textContent = '直连';
      } else {
        fetch('/get-proxy-status')
          .then(response => response.json())
          .then(data => statusElement.textContent = data.status)
          .catch(() => statusElement.textContent = '直连');
      }
    }

    function saveProxyState() {
      const formData = new FormData();
      formData.append('proxyEnabled', proxyEnabled);
      formData.append('proxyType', proxyType);
      fetch('/set-proxy-state', { method: 'POST', body: formData });
    }

    function 导入小猫咪(订阅路径, hostName) {
      window.location.href = '${小猫}${咪}://install-config?url=https://' + hostName + '/${订阅路径}/${小猫}${咪}';
    }
    function 导入${歪兔}${蕊蒽}(订阅路径, hostName) {
      window.location.href = '${歪兔}${蕊蒽}://install-config?url=https://' + hostName + '/${订阅路径}/${歪兔}${蕊蒽}';
    }

    function 显示文件() {
      const fileInput = document.getElementById('ipFiles');
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';
      Array.from(fileInput.files).forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `<span>${file.name}</span><button onclick="移除文件(${index})">移除</button>`;
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
      const formData = new FormData(form);
      if (!formData.getAll('ipFiles').length) {
        alert('请先选择文件');
        return;
      }
      fetch(form.action, { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
          if (data.message) {
            alert(data.message);
            window.location.href = data.Location || '/${订阅路径}';
          }
        })
        .catch(err => alert('上传失败: ' + err.message));
    }
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
      font-family: Arial, sans-serif;
      color: #ff6f91;
      margin: 0;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    @media (prefers-color-scheme: light) { body { background: #fff0f5; } .content { background: rgba(255, 255, 255, 0.85); } }
    @media (prefers-color-scheme: dark) { body { background: #2a2a3b; } .content { background: rgba(30, 30, 30, 0.9); color: #ffd1dc; } }
    .content {
      padding: 20px;
      border-radius: 20px;
      max-width: 350px;
      width: 90%;
      text-align: center;
    }
    h1 {
      font-size: 1.5em;
      color: #ff69b4;
      margin-bottom: 15px;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .login-form input {
      padding: 10px;
      border-radius: 10px;
      border: 1px solid #ffb6c1;
      font-size: 0.9em;
      color: #ff6f91;
    }
    .login-form button {
      padding: 10px;
      background: #ff69b4;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
    }
    .error-message, .lock-message {
      color: #ff6666;
      margin-top: 10px;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="content">
    <h1>登录</h1>
    ${锁定状态 ? `
    <div class="lock-message">密码错误次数过多，请等待 <span id="countdown">${剩余时间}</span> 秒</div>
    ` : `
    <form class="login-form" action="/login/submit" method="POST">
      <input type="text" name="username" placeholder="账号" required>
      <input type="password" name="password" placeholder="密码" required>
      <button type="submit">登录</button>
    </form>
    ${输错密码 && 剩余次数 > 0 ? `<div class="error-message">密码错误，还剩 ${剩余次数} 次机会</div>` : ''}
    `}
  </div>
  <script>
    if (${锁定状态}) {
      let timeLeft = ${剩余时间};
      const countdown = document.getElementById('countdown');
      const timer = setInterval(() => {
        timeLeft--;
        countdown.textContent = timeLeft;
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
    body {
      font-family: Arial, sans-serif;
      color: #ff6f91;
      margin: 0;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    @media (prefers-color-scheme: light) { body { background: #fff0f5; } .content { background: rgba(255, 255, 255, 0.85); } }
    @media (prefers-color-scheme: dark) { body { background: #2a2a3b; } .content { background: rgba(30, 30, 30, 0.9); color: #ffd1dc; } }
    .content {
      padding: 20px;
      border-radius: 20px;
      max-width: 400px;
      width: 90%;
      text-align: center;
    }
    h1 { font-size: 1.5em; color: #ff69b4; margin-bottom: 15px; }
    p { font-size: 0.9em; color: #ff85a2; }
  </style>
</head>
<body>
  <div class="content">
    <h1>KV 未绑定</h1>
    <p>请在 Cloudflare Workers 设置中绑定 KV 命名空间（如 LOGIN_STATE），然后重新部署。</p>
  </div>
</body>
</html>
  `;
}

function 生成猫咪配置(hostName) {
  const 节点列表 = 优选节点.length ? 优选节点 : [`${hostName}:443`];
  const 节点配置 = 节点列表.map((节点, 索引) => {
    const [主内容, tls] = 节点.split("@");
    const [地址端口, 节点名字 = 节点名称] = 主内容.split("#");
    const [, 地址, 端口 = "443"] = 地址端口.match(/^\[(.*?)\](?::(\d+))?$/) || 地址端口.match(/^(.*?)(?::(\d+))?$/);
    const 修正地址 = 地址.includes(":") ? 地址.replace(/^\[|\]$/g, '') : 地址;
    const TLS开关 = tls === 'notls' ? 'false' : 'true';
    return `- name: "${节点名字}-${索引 + 1}"
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
      Host: ${hostName}`;
  }).join("\n");

  return `# Generated at: ${new Date().toISOString()}
mixed-port: 7890
allow-lan: true
mode: Rule
log-level: info
proxies:
${节点配置}
proxy-groups:
  - name: "节点选择"
    type: select
    proxies:
${节点列表.map((_, i) => `      - "${节点名称}-${i + 1}"`).join("\n")}
rules:
  - GEOIP,LAN,DIRECT
  - DOMAIN-SUFFIX,cn,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,节点选择
`;
}

function 生成备用配置(hostName) {
  const 节点列表 = 优选节点.length ? 优选节点 : [`${hostName}:443`];
  const 配置列表 = 节点列表.map(节点 => {
    const [主内容, tls = 'tls'] = 节点.split("@");
    const [地址端口, 节点名字 = 节点名称] = 主内容.split("#");
    const match = 地址端口.match(/^(?:\[([0-9a-fA-F:]+)\]|([^:]+))(?:\:(\d+))?$/);
    if (!match) return null;
    const 地址 = match[1] || match[2];
    const 端口 = match[3] || "443";
    if (!地址) return null;
    const 修正地址 = 地址.includes(":") ? `[${地址}]` : 地址;
    const TLS开关 = tls === 'notls' ? 'none' : 'tls';
    return `${歪啦}${伊埃斯}://${开门锁匙}@${修正地址}:${端口}?encryption=none&security=${TLS开关}&type=ws&host=${hostName}&path=${encodeURIComponent('/?ed=2560')}&sni=${hostName}#${节点名字}`;
  }).filter(Boolean);

  return `# Generated at: ${new Date().toISOString()}
${配置列表.length ? 配置列表.join("\n") : `${歪啦}${伊埃斯}://${开门锁匙}@${hostName}:443?encryption=none&security=tls&type=ws&host=${hostName}&path=${encodeURIComponent('/?ed=2560')}&sni=${hostName}#默认节点`}`;
}