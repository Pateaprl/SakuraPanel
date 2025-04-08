import { connect } from 'cloudflare:sockets';

// 常量定义
const CONFIG_PATH = "config";
const NODE_FILE_PATHS = [
  'https://v2.i-sweet.us.kg/ips.txt',
  'https://v2.i-sweet.us.kg/url.txt'
];
const DEFAULT_PROXY_IP = 'ts.hpc.tw';
const DEFAULT_NODE_NAME = '🌸樱花';
const FAKE_DOMAIN = 'lkssite.vip';
const MAX_LOGIN_FAILS = 5;
const LOCK_DURATION = 5 * 60 * 1000;
const LIGHT_BG = 'https://i.meee.com.tw/el91luR.png';
const DARK_BG = 'https://i.meee.com.tw/QPWx8nX.png';
const CONTENT_TYPES = {
  HTML: "text/html;charset=utf-8",
  JSON: "application/json;charset=utf-8",
  TEXT: "text/plain;charset=utf-8"
};
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
};

// 全局变量
let preferredNodes = [];
let proxyIp = DEFAULT_PROXY_IP;
let socks5Cred = '';
let maxLoginFails = MAX_LOGIN_FAILS;
let lockDuration = LOCK_DURATION;

// 辅助函数
const createResponse = (content, status = 200, headers = {}) => new Response(content, {
  status,
  headers: { "Content-Type": CONTENT_TYPES.HTML, ...NO_CACHE_HEADERS, ...headers }
});

const createRedirect = (path, extraHeaders = {}) => new Response(null, {
  status: 302,
  headers: { "Location": path, ...NO_CACHE_HEADERS, ...extraHeaders }
});

const createJsonResponse = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": CONTENT_TYPES.JSON, ...NO_CACHE_HEADERS, ...extraHeaders }
});

const generateUuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});

const hashPassword = async (password) => {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const checkLockStatus = async (env, deviceId) => {
  const lockTimestamp = await env.LOGIN_STATE.get(`lock_${deviceId}`);
  const now = Date.now();
  const isLocked = lockTimestamp && now < Number(lockTimestamp);
  return {
    isLocked,
    remainingTime: isLocked ? Math.ceil((Number(lockTimestamp) - now) / 1000) : 0
  };
};

const generateAuthPage = (type, params = {}) => {
  const authData = {
    register: {
      title: '🌸首次使用注册🌸',
      form: `
        <form class="auth-form" action="/register/submit" method="POST" enctype="application/x-www-form-urlencoded">
          <input type="text" name="username" placeholder="设置账号" required pattern="^[a-zA-Z0-9]{4,20}$" title="4-20位字母数字">
          <input type="password" name="password" placeholder="设置密码" required minlength="6">
          <input type="password" name="confirm" placeholder="确认密码" required>
          <button type="submit">立即注册</button>
        </form>
        ${params.error ? `<div class="error-message">${params.error}</div>` : ''}
      `
    },
    login: {
      title: '🌸欢迎回来🌸',
      form: `
        <form class="auth-form" action="/login/submit" method="POST" enctype="application/x-www-form-urlencoded">
          <input type="text" name="username" placeholder="登录账号" required>
          <input type="password" name="password" placeholder="登录密码" required>
          <button type="submit" id="loginButton" ${params.isLocked ? 'disabled' : ''}>立即登录</button>
        </form>
        ${params.wrongPass ? `<div class="error-message">密码错误，剩余尝试次数：${params.attemptsLeft}</div>` : ''}
        ${params.isLocked ? `<div class="lock-message">账户锁定，请<span id="countdown">${params.remainingTime}</span>秒后重试</div>` : ''}
        ${params.error ? `<div class="error-message">${params.error}</div>` : ''}
      `
    }
  };

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
      position: relative;
      overflow: hidden;
      transition: background 0.5s ease;
    }
    @media (prefers-color-scheme: light) {
      body { background: linear-gradient(135deg, #ffe6f0, #fff0f5); }
      .auth-container { background: rgba(255, 245, 247, 0.9); box-shadow: 0 8px 20px rgba(255, 182, 193, 0.3); }
    }
    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(135deg, #1e1e2f, #2a2a3b); }
      .auth-container { background: rgba Bart(30, 30, 30, 0.9); color: #ffd1dc; box-shadow: 0 8px 20px rgba(255, 133, 162, 0.2); }
    }
    .background-media {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: -1;
      transition: opacity 0.5s ease;
    }
    .auth-container {
      padding: 30px;
      border-radius: 25px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      position: relative;
      z-index: 1;
    }
    h1 {
      font-size: 1.8em;
      color: #ff69b4;
      margin-bottom: 20px;
      text-shadow: 1px 1px 3px rgba(255, 105, 180, 0.2);
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 15px;
      width: 100%;
      max-width: 300px;
      margin: 0 auto;
    }
    .auth-form input {
      padding: 12px;
      border-radius: 15px;
      border: 2px solid #ffb6c1;
      font-size: 1em;
      width: 100%;
      box-sizing: border-box;
    }
    .auth-form button {
      padding: 12px;
      background: linear-gradient(to right, #ffb6c1, #ff69b4);
      color: white;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-size: 1em;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .auth-form button:hover {
      transform: scale(1.05);
      box-shadow: 0 5px 15px rgba(255, 105, 180, 0.4);
    }
    .auth-form button:active { transform: scale(0.95); }
    .auth-form button:disabled { background: #ccc; cursor: not-allowed; box-shadow: none; transform: none; }
    .error-message { color: #ff6666; margin-top: 15px; font-size: 0.9em; }
    .lock-message { color: #ff6666; margin-top: 20px; font-size: 1.1em; display: flex; align-items: center; justify-content: center; gap: 5px; }
    #countdown { color: #ff1493; font-weight: bold; min-width: 50px; text-align: center; }
    @media (max-width: 600px) {
      .auth-container { padding: 20px; }
      h1 { font-size: 1.5em; }
      .auth-form input, .auth-form button { padding: 10px; font-size: 0.95em; }
    }
  </style>
</head>
<body>
  <img id="backgroundImage" class="background-media">
  <div class="auth-container">
    <h1>${authData[type].title}</h1>
    ${authData[type].form}
  </div>
  <script>
    const lightBg = '${LIGHT_BG}';
    const darkBg = '${DARK_BG}';
    const bgImage = document.getElementById('backgroundImage');
    const updateBackground = () => {
      bgImage.src = window.matchMedia('(prefers-color-scheme: dark)').matches ? darkBg : lightBg;
      bgImage.onerror = () => bgImage.style.display = 'none';
    };
    updateBackground();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBackground);

    let remainingTime = ${params.isLocked ? params.remainingTime : 0};
    const countdownElement = document.getElementById('countdown');
    const loginButton = document.getElementById('loginButton');

    const startCountdown = () => {
      if (!countdownElement) return;
      const interval = setInterval(() => {
        if (remainingTime <= 0) {
          clearInterval(interval);
          countdownElement.textContent = '0';
          loginButton.disabled = false;
          document.querySelector('.lock-message').textContent = '锁定已解除，请重新尝试登录';
          fetch('/reset-login-failures', { method: 'POST' });
          return;
        }
        countdownElement.textContent = remainingTime--;
      }, 1000);
    };

    const syncWithServer = () => {
      fetch('/check-lock')
        .then(res => res.json())
        .then(data => {
          remainingTime = data.locked ? data.remainingTime : 0;
          countdownElement.textContent = remainingTime;
          loginButton.disabled = data.locked;
          if (!data.locked) document.querySelector('.lock-message').textContent = '锁定已解除，请重新尝试登录';
        })
        .catch(err => console.error('同步锁定状态失败:', err));
    };

    if (${params.isLocked}) {
      startCountdown();
      setInterval(syncWithServer, 10000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncWithServer());
    }

    document.querySelector('.auth-form')?.addEventListener('submit', e => !e.isTrusted && (e.preventDefault(), console.log('阻止非用户触发的表单提交')));
    let lastUA = navigator.userAgent;
    setInterval(() => {
      const currentUA = navigator.userAgent;
      if (currentUA !== lastUA) {
        console.log('UA 已切换，从', lastUA, '到', currentUA);
        lastUA = currentUA;
      }
    }, 500);
  </script>
</body>
</html>`;
};

// 节点配置相关
const getOrInitUuid = async (env) => {
  let uuid = await env.LOGIN_STATE.get('current_uuid');
  if (!uuid) {
    uuid = generateUuid();
    await env.LOGIN_STATE.put('current_uuid', uuid);
  }
  return uuid;
};

const loadNodesAndConfig = async (env, hostName) => {
  try {
    const manualNodesCache = await env.LOGIN_STATE.get('manual_preferred_ips');
    const manualNodes = manualNodesCache ? JSON.parse(manualNodesCache).map(line => line.trim()).filter(Boolean) : [];

    const responses = await Promise.all(NODE_FILE_PATHS.map(async path => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`请求 ${path} 失败，状态码: ${res.status}`);
        return (await res.text()).split('\n').map(line => line.trim()).filter(Boolean);
      } catch (err) {
        console.error(`拉取 ${path} 失败: ${err.message}`);
        return [];
      }
    }));

    const domainNodes = [...new Set(responses.flat())];
    const mergedNodes = [...new Set([...manualNodes, ...domainNodes])];
    const cachedNodes = await env.LOGIN_STATE.get('ip_preferred_ips');
    const currentNodes = cachedNodes ? JSON.parse(cachedNodes) : [];
    const isSame = JSON.stringify(mergedNodes) === JSON.stringify(currentNodes);

    if (mergedNodes.length) {
      preferredNodes = mergedNodes;
      if (!isSame) {
        const version = String(Date.now());
        await Promise.all([
          env.LOGIN_STATE.put('ip_preferred_ips', JSON.stringify(mergedNodes)),
          env.LOGIN_STATE.put('ip_preferred_ips_version', version),
          env.LOGIN_STATE.put('config_clash', await generateConfig1(env, hostName)),
          env.LOGIN_STATE.put('config_clash_version', version),
          env.LOGIN_STATE.put('config_v2ray', await generateConfig2(env, hostName)),
          env.LOGIN_STATE.put('config_v2ray_version', version)
        ]);
      }
    } else {
      preferredNodes = currentNodes.length ? currentNodes : [`${hostName}:443`];
    }
  } catch (err) {
    const cachedNodes = await env.LOGIN_STATE.get('ip_preferred_ips');
    preferredNodes = cachedNodes ? JSON.parse(cachedNodes) : [`${hostName}:443`];
    await env.LOGIN_STATE.put('ip_error_log', JSON.stringify({ time: Date.now(), error: '所有路径拉取失败或手动上传为空' }), { expirationTtl: 86400 });
  }
};

const getConfig = async (env, type, hostName) => {
  const configKey = `config_${type}`;
  const versionKey = `${configKey}_version`;
  const [cachedConfig, configVersion, nodeVersion] = await Promise.all([
    env.LOGIN_STATE.get(configKey),
    env.LOGIN_STATE.get(versionKey) || '0',
    env.LOGIN_STATE.get('ip_preferred_ips_version') || '0'
  ]);

  if (cachedConfig && configVersion === nodeVersion) return cachedConfig;

  const newConfig = type === 'clash' ? await generateConfig1(env, hostName) : await generateConfig2(env, hostName);
  await Promise.all([
    env.LOGIN_STATE.put(configKey, newConfig),
    env.LOGIN_STATE.put(versionKey, nodeVersion)
  ]);
  return newConfig;
};

// 主逻辑
export default {
  async fetch(request, env) {
    try {
      if (!env.LOGIN_STATE) return createResponse(generateKvUnboundPage());

      const upgradeHeader = request.headers.get('Upgrade');
      const url = new URL(request.url);
      const hostName = request.headers.get('Host');
      const ua = request.headers.get('User-Agent') || 'unknown';
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const deviceId = `${ua}_${ip}`;

      if (upgradeHeader === 'websocket') {
        proxyIp = env.PROXYIP || proxyIp;
        socks5Cred = env.SOCKS5 || socks5Cred;
        return await handleWebSocket(request, env);
      }

      let formData;
      const contentType = request.headers.get('Content-Type') || '';
      const isFormSubmit = url.pathname === '/login/submit' || url.pathname === '/register/submit';
      if (isFormSubmit) {
        if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
          console.log(`无效请求: UA=${ua}, IP=${ip}, Path=${url.pathname}, Headers=${JSON.stringify([...request.headers])}`);
          return createResponse(generateAuthPage(url.pathname === '/login/submit' ? 'login' : 'register', { error: '请通过正常表单提交' }), 400);
        }
        formData = await request.formData().catch(() => {
          return createResponse(generateAuthPage(url.pathname === '/login/submit' ? 'login' : 'register', { error: '提交数据格式错误，请重试' }), 400);
        });
      }

      if (url.pathname === '/register/submit') {
        const { username, password, confirm } = Object.fromEntries(formData);
        if (!username || !password || password !== confirm) {
          return createResponse(generateAuthPage('register', { error: password !== confirm ? '两次密码不一致' : '请填写完整信息' }), 400);
        }
        if (await env.LOGIN_STATE.get('stored_credentials')) return createRedirect('/login');
        const hashedPass = await hashPassword(password);
        await env.LOGIN_STATE.put('stored_credentials', JSON.stringify({ username, password: hashedPass }));
        const token = Math.random().toString(36).substring(2);
        await env.LOGIN_STATE.put('current_token', token, { expirationTtl: 300 });
        return createRedirect(`/${CONFIG_PATH}`, { 'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Strict` });
      }

      if (url.pathname === '/login/submit') {
        const lockStatus = await checkLockStatus(env, deviceId);
        if (lockStatus.isLocked) return createResponse(generateAuthPage('login', { isLocked: true, remainingTime: lockStatus.remainingTime }), 403);

        const storedCreds = await env.LOGIN_STATE.get('stored_credentials');
        if (!storedCreds) return createRedirect('/register');

        const { username, password } = Object.fromEntries(formData);
        const creds = JSON.parse(storedCreds);
        const passMatch = (await hashPassword(password)) === creds.password;

        if (username === creds.username && passMatch) {
          const token = Math.random().toString(36).substring(2);
          await Promise.all([
            env.LOGIN_STATE.put('current_token', token, { expirationTtl: 300 }),
            env.LOGIN_STATE.put(`fail_${deviceId}`, '0')
          ]);
          return createRedirect(`/${CONFIG_PATH}`, { 'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Strict` });
        }

        const fails = Number(await env.LOGIN_STATE.get(`fail_${deviceId}`) || 0) + 1;
        await env.LOGIN_STATE.put(`fail_${deviceId}`, String(fails));
        if (fails >= maxLoginFails) {
          await env.LOGIN_STATE.put(`lock_${deviceId}`, String(Date.now() + lockDuration), { expirationTtl: 300 });
          const newLockStatus = await checkLockStatus(env, deviceId);
          return createResponse(generateAuthPage('login', { isLocked: true, remainingTime: newLockStatus.remainingTime }), 403);
        }
        return createResponse(generateAuthPage('login', { wrongPass: true, attemptsLeft: maxLoginFails - fails }), 401);
      }

      const isRegistered = await env.LOGIN_STATE.get('stored_credentials');
      if (!isRegistered && url.pathname !== '/register') return createResponse(generateAuthPage('register'));

      switch (url.pathname) {
        case '/login':
          if (!await env.LOGIN_STATE.get('stored_credentials')) return createRedirect('/register');
          const lockStatus = await checkLockStatus(env, deviceId);
          if (lockStatus.isLocked) return createResponse(generateAuthPage('login', { isLocked: true, remainingTime: lockStatus.remainingTime }));
          const token = request.headers.get('Cookie')?.split('=')[1];
          if (token && token === await env.LOGIN_STATE.get('current_token')) return createRedirect(`/${CONFIG_PATH}`);
          const fails = Number(await env.LOGIN_STATE.get(`fail_${deviceId}`) || 0);
          return createResponse(generateAuthPage('login', { wrongPass: fails > 0, attemptsLeft: maxLoginFails - fails }));

        case '/reset-login-failures':
          await Promise.all([
            env.LOGIN_STATE.put(`fail_${deviceId}`, '0'),
            env.LOGIN_STATE.delete(`lock_${deviceId}`)
          ]);
          return new Response(null, { status: 200 });

        case '/check-lock':
          const lockCheck = await checkLockStatus(env, deviceId);
          return createJsonResponse({ locked: lockCheck.isLocked, remainingTime: lockCheck.remainingTime });

        case `/${CONFIG_PATH}`:
          const currentToken = await env.LOGIN_STATE.get('current_token');
          if (!request.headers.get('Cookie')?.split('=')[1] || request.headers.get('Cookie')?.split('=')[1] !== currentToken) {
            return createRedirect('/login');
          }
          const uuid = await getOrInitUuid(env);
          return createResponse(generateSubPage(CONFIG_PATH, hostName, uuid));

        case `/${CONFIG_PATH}/logout`:
          await env.LOGIN_STATE.delete('current_token');
          return createRedirect('/login', { 'Set-Cookie': 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict' });

        case `/${CONFIG_PATH}/clash`:
          await loadNodesAndConfig(env, hostName);
          return new Response(await getConfig(env, 'clash', hostName), { status: 200, headers: { "Content-Type": CONTENT_TYPES.TEXT } });

        case `/${CONFIG_PATH}/v2rayng`:
          await loadNodesAndConfig(env, hostName);
          return new Response(await getConfig(env, 'v2ray', hostName), { status: 200, headers: { "Content-Type": CONTENT_TYPES.TEXT } });

        case `/${CONFIG_PATH}/upload`:
          const uploadToken = request.headers.get('Cookie')?.split('=')[1];
          if (!uploadToken || uploadToken !== await env.LOGIN_STATE.get('current_token')) {
            return createJsonResponse({ error: '未登录或Token无效，请重新登录' }, 401);
          }
          formData = await request.formData();
          const ipFiles = formData.getAll('ipFiles');
          if (!ipFiles.length) return createJsonResponse({ error: '未选择任何文件' }, 400);

          let allIpList = [];
          for (const ipFile of ipFiles) {
            if (!ipFile?.text) throw new Error(`文件 ${ipFile.name} 无效`);
            const ipText = await ipFile.text();
            const ipList = ipText.split('\n').map(line => line.trim()).filter(Boolean);
            if (!ipList.length) console.warn(`文件 ${ipFile.name} 内容为空`);
            allIpList = allIpList.concat(ipList);
          }
          if (!allIpList.length) return createJsonResponse({ error: '所有上传文件内容为空' }, 400);

          const uniqueIpList = [...new Set(allIpList)];
          const currentManualNodes = await env.LOGIN_STATE.get('manual_preferred_ips');
          const currentList = currentManualNodes ? JSON.parse(currentManualNodes) : [];
          if (JSON.stringify(currentList.sort()) === JSON.stringify(uniqueIpList.sort())) {
            return createJsonResponse({ message: '上传内容与现有节点相同，无需更新' }, 200);
          }

          const version = String(Date.now());
          await Promise.all([
            env.LOGIN_STATE.put('manual_preferred_ips', JSON.stringify(uniqueIpList)),
            env.LOGIN_STATE.put('ip_preferred_ips_version', version),
            env.LOGIN_STATE.put('config_clash', await generateConfig1(env, hostName)),
            env.LOGIN_STATE.put('config_clash_version', version),
            env.LOGIN_STATE.put('config_v2ray', await generateConfig2(env, hostName)),
            env.LOGIN_STATE.put('config_v2ray_version', version)
          ]);
          return createJsonResponse({ message: '上传成功，即将跳转' }, 200, { 'Location': `/${CONFIG_PATH}` });

        case `/${CONFIG_PATH}/change-uuid`:
          const changeToken = request.headers.get('Cookie')?.split('=')[1];
          if (!changeToken || changeToken !== await env.LOGIN_STATE.get('current_token')) {
            return createJsonResponse({ error: '未登录或Token无效' }, 401);
          }
          const newUuid = generateUuid();
          const version = String(Date.now());
          await Promise.all([
            env.LOGIN_STATE.put('current_uuid', newUuid),
            env.LOGIN_STATE.put('config_clash', await generateConfig1(env, hostName)),
            env.LOGIN_STATE.put('config_v2ray', await generateConfig2(env, hostName)),
            env.LOGIN_STATE.put('config_clash_version', version),
            env.LOGIN_STATE.put('config_v2ray_version', version)
          ]);
          return createJsonResponse({ uuid: newUuid }, 200);

        case '/set-proxy-state':
          formData = await request.formData();
          await Promise.all([
            env.LOGIN_STATE.put('proxyEnabled', formData.get('proxyEnabled')),
            env.LOGIN_STATE.put('proxyType', formData.get('proxyType'))
          ]);
          return new Response(null, { status: 200 });

        case '/get-proxy-status':
          const [proxyEnabled, proxyType] = await Promise.all([
            env.LOGIN_STATE.get('proxyEnabled') === 'true',
            env.LOGIN_STATE.get('proxyType') || 'reverse'
          ]);
          let status = '直连';
          if (proxyEnabled) {
            if (proxyType === 'reverse' && proxyIp) status = '反代';
            else if (proxyType === 'socks5' && socks5Cred) status = 'SOCKS5';
          }
          return createJsonResponse({ status });

        default:
          url.hostname = FAKE_DOMAIN;
          url.protocol = 'https:';
          return fetch(new Request(url, request));
      }
    } catch (error) {
      console.error(`全局错误: ${error.message}`);
      return createJsonResponse({ error: `服务器内部错误: ${error.message}` }, 500);
    }
  }
};

// WebSocket 处理
const handleWebSocket = async (request, env) => {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  const uuid = await getOrInitUuid(env);
  const result = await parseHeader(decrypt(request.headers.get('sec-websocket-protocol')), env, uuid);
  if (!result) return new Response('Invalid request', { status: 400 });
  const { socket, initialData } = result;
  setupPipeline(server, socket, initialData);
  return new Response(null, { status: 101, webSocket: client });
};

const decrypt = (encoded) => {
  encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(encoded), c => c.charCodeAt(0)).buffer;
};

const parseHeader = async (data, env, uuid) => {
  const arr = new Uint8Array(data);
  if (verifyKey(arr.slice(1, 17)) !== uuid) return null;

  const offset = arr[17];
  const port = new DataView(data.slice(18 + offset + 1, 20 + offset + 1)).getUint16(0);
  const addrType = arr[20 + offset + 1];
  const addrStart = 20 + offset + 2;

  let address = '';
  switch (addrType) {
    case 1: address = new Uint8Array(data.slice(addrStart, addrStart + 4)).join('.'); break;
    case 2: address = new TextDecoder().decode(data.slice(addrStart + 1, addrStart + 1 + arr[addrStart])); break;
    case 3: address = Array.from({ length: 8 }, (_, i) => new DataView(data.slice(addrStart, addrStart + 16)).getUint16(i * 2).toString(16)).join(':'); break;
    default: return null;
  }

  const initialData = data.slice(addrStart + (addrType === 2 ? arr[addrStart] + 1 : addrType === 1 ? 4 : 16));
  const socket = await smartConnect(address, port, addrType, env);
  return { socket, initialData };
};

const smartConnect = async (address, port, addrType, env) => {
  if (!address.trim()) return tryDirectConnect(address, port);

  const isDomain = addrType === 2 && !address.match(/^\d+\.\d+\.\d+\.\d+$/);
  const isIp = addrType === 1 || (addrType === 2 && address.match(/^\d+\.\d+\.\d+\.\d+$/)) || addrType === 3;

  if (isDomain || isIp) {
    const [proxyEnabled, proxyType] = await Promise.all([
      env.LOGIN_STATE.get('proxyEnabled') === 'true',
      env.LOGIN_STATE.get('proxyType') || 'reverse'
    ]);

    if (!proxyEnabled) return tryDirectConnect(address, port);

    if (proxyType === 'reverse' && proxyIp) {
      try {
        const [host, proxyPort] = proxyIp.split(':');
        const conn = connect({ hostname: host, port: proxyPort || port });
        await conn.opened;
        console.log(`通过反代连接: ${proxyIp}`);
        return conn;
      } catch (err) {
        console.error(`反代连接失败: ${err.message}`);
      }
    } else if (proxyType === 'socks5' && socks5Cred) {
      try {
        const conn = await createSocks5(addrType, address, port);
        console.log(`通过 SOCKS5 连接: ${address}:${port}`);
        return conn;
      } catch (err) {
        console.error(`SOCKS5 连接失败: ${err.message}`);
      }
    }
    return tryDirectConnect(address, port);
  }
  return tryDirectConnect(address, port);
};

const tryDirectConnect = async (address, port) => {
  const conn = connect({ hostname: address, port });
  await conn.opened;
  console.log(`回退到直连: ${address}:${port}`);
  return conn;
};

const verifyKey = (arr) => Array.from(arr.slice(0, 16), b => b.toString(16).padStart(2, '0'))
  .join('').match(/(.{8})(.{4})(.{4})(.{4})(.{12})/).slice(1).join('-').toLowerCase();

const setupPipeline = async (server, socket, initialData) => {
  await server.send(new Uint8Array([0, 0]).buffer);
  const dataStream = new ReadableStream({
    async start(controller) {
      if (initialData) controller.enqueue(initialData);
      server.addEventListener('message', e => controller.enqueue(e.data));
      server.addEventListener('close', () => { controller.close(); socket.close(); setTimeout(() => server.close(1000), 2); });
      server.addEventListener('error', () => { controller.close(); socket.close(); setTimeout(() => server.close(1001), 2); });
    }
  });
  dataStream.pipeTo(new WritableStream({
    async write(data) {
      const writer = socket.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
    }
  }));
  socket.readable.pipeTo(new WritableStream({
    async write(data) {
      await server.send(data);
    }
  }));
};

const createSocks5 = async (addrType, address, port) => {
  const { username, password, hostname, port: socksPort } = await parseSocks5Cred(socks5Cred);
  const conn = connect({ hostname, port: socksPort });
  await conn.opened;
  const writer = conn.writable.getWriter();
  const reader = conn.readable.getReader();
  const encoder = new TextEncoder();

  await writer.write(new Uint8Array([5, 2, 0, 2]));
  let res = (await reader.read()).value;
  if (res[1] === 0x02) {
    if (!username || !password) return closeConn(conn, writer, reader);
    await writer.write(new Uint8Array([1, username.length, ...encoder.encode(username), password.length, ...encoder.encode(password)]));
    res = (await reader.read()).value;
    if (res[0] !== 0x01 || res[1] !== 0x00) return closeConn(conn, writer, reader);
  }

  let addrBytes;
  switch (addrType) {
    case 1: addrBytes = new Uint8Array([1, ...address.split('.').map(Number)]); break;
    case 2: addrBytes = new Uint8Array([3, address.length, ...encoder.encode(address)]); break;
    case 3: addrBytes = new Uint8Array([4, ...address.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]); break;
    default: return closeConn(conn, writer, reader);
  }

  await writer.write(new Uint8Array([5, 1, 0, ...addrBytes, port >> 8, port & 0xff]));
  res = (await reader.read()).value;
  if (res[0] !== 0x05 || res[1] !== 0x00) return closeConn(conn, writer, reader);

  writer.releaseLock();
  reader.releaseLock();
  return conn;

  function closeConn(conn, writer, reader) {
    writer.releaseLock();
    reader.releaseLock();
    conn.close();
    return new Response('SOCKS5握手失败', { status: 400 });
  }
};

const parseSocks5Cred = async (cred) => {
  const [latter, former] = cred.split("@").reverse();
  let username, password, hostname, port;
  if (former) [username, password] = former.split(":");
  const latters = latter.split(":");
  port = Number(latters.pop());
  hostname = latters.join(":");
  return { username, password, hostname, port };
};

const generateSubPage = (configPath, hostName, uuid) => `
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
      align-items: flex-start;
      transition: background 0.5s ease;
    }
    @media (prefers-color-scheme: light) {
      body { background: linear-gradient(135deg, #ffe6f0, #fff0f5); }
      .card { background: rgba(255, 245, 247, 0.9); box-shadow: 0 8px 20px rgba(255, 182, 193, 0.3); }
      .card::before { border: 2px dashed #ffb6c1; }
      .card:hover { box-shadow: 0 10px 25px rgba(255, 182, 193, 0.5); }
      .link-box, .proxy-status, .uuid-box { background: rgba(255, 240, 245, 0.9); border: 2px dashed #ffb6c1; }
      .file-item { background: rgba(255, 245, 247, 0.9); }
    }
    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(135deg, #1e1e2f, #2a2a3b); }
      .card { background: rgba(30, 30, 30, 0.9); color: #ffd1dc; box-shadow: 0 8px 20px rgba(255, 133, 162, 0.2); }
      .card::before { border: 2px dashed #ff85a2; }
      .card:hover { box-shadow: 0 10px 25px rgba(255, 133, 162, 0.4); }
      .link-box, .proxy-status, .uuid-box { background: rgba(40, 40, 40, 0.9); border: 2px dashed #ff85a2; color: #ffd1dc; }
      .link-box a, .uuid-box span { color: #ff85a2; }
      .link-box a:hover { color: #ff1493; }
      .file-item { background: rgba(50, 50, 50, 0.9); color: #ffd1dc; }
    }
    .background-media {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: -1;
      transition: opacity 0.5s ease;
    }
    .container {
      max-width: 900px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 25px;
      position: relative;
      z-index: 1;
      padding-bottom: 20px;
    }
    .card {
      border-radius: 25px;
      padding: 25px;
      width: 100%;
      max-width: 500px;
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      position: relative;
      overflow: visible;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border-radius: 20px;
      z-index: -1;
    }
    .card:hover { transform: scale(1.03); }
    .card::after {
      content: '🎀';
      position: absolute;
      top: -20px;
      right: -20px;
      font-size: 60px;
      color: #ff69b4;
      transform: rotate(20deg);
      z-index: 1;
      text-shadow: 2px 2px 4px rgba(255, 105, 180, 0.3);
      pointer-events: none;
    }
    @media (prefers-color-scheme: dark) {
      .card::after { color: #ff85a2; text-shadow: 2px 2px 4px rgba(255, 133, 162, 0.3); }
    }
    .card-title {
      font-size: 1.6em;
      color: #ff69b4;
      margin-bottom: 15px;
      text-shadow: 1px 1px 3px rgba(255, 105, 180, 0.2);
    }
    .switch-container { display: flex; flex-direction: column; align-items: center; gap: 15px; }
    .toggle-row { display: flex; align-items: center; gap: 15px; }
    .toggle-switch { position: relative; display: inline-block; width: 60px; height: 34px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 34px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .slider { background-color: #ff69b4; }
    input:checked + .slider:before { transform: translateX(26px); }
    .proxy-capsule { display: flex; border-radius: 20px; overflow: hidden; background: #ffe6f0; box-shadow: 0 4px 10px rgba(255, 182, 193, 0.2); }
    .proxy-option { width: 80px; padding: 10px 0; text-align: center; cursor: pointer; color: #ff6f91; transition: all 0.3s ease; position: relative; font-size: 1em; }
    .proxy-option.active { background: linear-gradient(to right, #ffb6c1, #ff69b4); color: white; box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.1); }
    .proxy-option:not(.active):hover { background: #ffd1dc; }
    .proxy-option[data-type="socks5"].active { background: linear-gradient(to right, #ffd1dc, #ff85a2); }
    .proxy-option::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: rgba(255, 255, 255, 0.2); transform: rotate(30deg); transition: all 0.5s ease; pointer-events: none; }
    .proxy-option:hover::before { top: 100%; left: 100%; }
    .proxy-status, .uuid-box { margin-top: 20px; padding: 15px; border-radius: 15px; font-size: 0.95em; word-break: break-all; transition: background 0.3s ease, color 0.3s ease; width: 100%; box-sizing: border-box; }
    .proxy-status.success { background: rgba(212, 237, 218, 0.9); color: #155724; }
    .proxy-status.direct { background: rgba(233, 236, 239, 0.9); color: #495057; }
    .link-box { border-radius: 15px; padding: 15px; margin: 10px 0; font-size: 0.95em; word-break: break-all; }
    .link-box a { color: #ff69b4; text-decoration: none; transition: color 0.3s ease; }
    .link-box a:hover { color: #ff1493; }
    .button-group { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-top: 15px; }
    .cute-button {
      padding: 12px 25px;
      border-radius: 20px;
      border: none;
      font-size: 1em;
      color: white;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .cute-button:hover { transform: scale(1.05); box-shadow: 0 5px 15px rgba(255, 105, 180, 0.4); }
    .cute-button:active { transform: scale(0.95); }
    .config1-btn { background: linear-gradient(to right, #ffb6c1, #ff69b4); }
    .config2-btn { background: linear-gradient(to right, #ffd1dc, #ff85a2); }
    .logout-btn { background: linear-gradient(to right, #ff9999, #ff6666); }
    .uuid-btn { background: linear-gradient(to right, #ffdead, #ff85a2); }
    .upload-title { font-size: 1.4em; color: #ff85a2; margin-bottom: 15px; }
    .upload-label { padding: 10px 20px; background: linear-gradient(to right, #ffb6c1, #ff69b4); color: white; border-radius: 20px; cursor: pointer; display: inline-block; transition: all 0.3s ease; }
    .upload-label:hover { transform: scale(1.05); box-shadow: 0 5px 15px rgba(255, 105, 180, 0.4); }
    .file-list { margin: 15px 0; max-height: 120px; overflow-y: auto; text-align: left; }
    .file-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 10px; margin: 5px 0; font-size: 0.9em; }
    .file-item button { background: #ff9999; border: none; border-radius: 15px; padding: 5px 10px; color: white; cursor: pointer; transition: background 0.3s ease; }
    .file-item button:hover { background: #ff6666; }
    .upload-submit { background: linear-gradient(to right, #ffdead, #ff85a2); padding: 12px 25px; border-radius: 20px; border: none; color: white; cursor: pointer; transition: all 0.3s ease; }
    .upload-submit:hover { transform: scale(1.05); box-shadow: 0 5px 15px rgba(255, 105, 180, 0.4); }
    .progress-container { display: none; margin-top: 15px; }
    .progress-bar { width: 100%; height: 15px; background: #ffe6f0; border-radius: 10px; overflow: hidden; border: 1px solid #ffb6c1; }
    .progress-fill { height: 100%; background: linear-gradient(to right, #ff69b4, #ff1493); width: 0; transition: width 0.3s ease; }
    .progress-text { text-align: center; font-size: 0.85em; color: #ff6f91; margin-top: 5px; }
    @media (max-width: 600px) {
      .card { padding: 15px; max-width: 90%; }
      .card-title { font-size: 1.3em; }
      .switch-container { gap: 10px; }
      .toggle-row { gap: 10px; }
      .proxy-option { width: 70px; padding: 8px 0; font-size: 0.9em; }
      .proxy-status, .uuid-box { font-size: 0.9em; padding: 12px; }
      .link-box { font-size: 0.9em; padding: 12px; }
      .cute-button, .upload-label, .upload-submit { padding: 10px 20px; font-size: 0.9em; }
      .card::after { font-size: 50px; top: -15px; right: -15px; }
    }
  </style>
</head>
<body>
  <img id="backgroundImage" class="background-media">
  <div class="container">
    <div class="card">
      <h1 class="card-title">🌸 欢迎来到樱花订阅站 🌸</h1>
      <p style="font-size: 1em;">支持 <span style="color: #ff69b4;">clash</span> 和 <span style="color: #ff85a2;">v2rayng</span> 哦~</p>
    </div>
    <div class="card">
      <h2 class="card-title">🔑 当前 UUID</h2>
      <div class="uuid-box"><span id="currentUUID">${uuid}</span></div>
      <div class="button-group">
        <button class="cute-button uuid-btn" onclick="更换UUID()">更换 UUID</button>
      </div>
    </div>
    <div class="card">
      <h2 class="card-title">🌟 代理设置</h2>
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
      <h2 class="card-title">🐾 配置1订阅</h2>
      <div class="link-box">
        <p>订阅链接：<br><a href="https://${hostName}/${configPath}/clash">https://${hostName}/${configPath}/clash</a></p>
      </div>
      <div class="button-group">
        <button class="cute-button config1-btn" onclick="导入Config('${configPath}', '${hostName}', 'clash')">一键导入</button>
      </div>
    </div>
    <div class="card">
      <h2 class="card-title">🐰 配置2订阅</h2>
      <div class="link-box">
        <p>订阅链接：<br><a href="https://${hostName}/${configPath}/v2rayng">https://${hostName}/${configPath}/v2rayng</a></p>
      </div>
      <div class="button-group">
        <button class="cute-button config2-btn" onclick="导入Config('${configPath}', '${hostName}', 'v2rayng')">一键导入</button>
      </div>
    </div>
    <div class="card">
      <h2 class="upload-title">🌟 上传你的魔法 IP</h2>
      <form id="uploadForm" action="/${configPath}/upload" method="POST" enctype="multipart/form-data">
        <label for="ipFiles" class="upload-label">选择文件</label>
        <input type="file" id="ipFiles" name="ipFiles" accept=".txt" multiple required onchange="显示文件()" style="display: none;">
        <div class="file-list" id="fileList"></div>
        <button type="submit" class="upload-submit" onclick="开始上传(event)">上传</button>
        <div class="progress-container" id="progressContainer">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-text" id="progressText">0%</div>
        </div>
      </form>
    </div>
    <div class="card">
      <div class="button-group">
        <a href="/${configPath}/logout" class="cute-button logout-btn">退出登录</a>
      </div>
    </div>
  </div>
  <script>
    const lightBg = '${LIGHT_BG}';
    const darkBg = '${DARK_BG}';
    const bgImage = document.getElementById('backgroundImage');
    const updateBackground = () => {
      bgImage.src = window.matchMedia('(prefers-color-scheme: dark)').matches ? darkBg : lightBg;
      bgImage.onerror = () => bgImage.style.display = 'none';
    };
    updateBackground();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBackground);

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
        statusElement.className = 'proxy-status direct';
      } else {
        fetch('/get-proxy-status')
          .then(response => response.json())
          .then(data => {
            statusElement.textContent = data.status;
            statusElement.className = 'proxy-status ' + (data.status === '直连' ? 'direct' : 'success');
          })
          .catch(() => {
            statusElement.textContent = '直连';
            statusElement.className = 'proxy-status direct';
          });
      }
    }

    function saveProxyState() {
      const formData = new FormData();
      formData.append('proxyEnabled', proxyEnabled);
      formData.append('proxyType', proxyType);
      fetch('/set-proxy-state', { method: 'POST', body: formData }).then(() => updateProxyStatus());
    }

    function 导入Config(configPath, hostName, type) {
      window.location.href = type + '://install-config?url=https://' + hostName + '/${configPath}/' + type;
    }

    function 更换UUID() {
      fetch('/${configPath}/change-uuid', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          if (data.uuid) {
            document.getElementById('currentUUID').textContent = data.uuid;
            alert('UUID 已更换成功！请重新获取订阅链接~');
          } else {
            alert('更换 UUID 失败，请稍后再试~');
          }
        })
        .catch(() => alert('更换 UUID 失败，网络出错啦~'));
    }

    function 显示文件() {
      const fileInput = document.getElementById('ipFiles');
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';
      Array.from(fileInput.files).forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = \`<span>\${file.name} (\${(file.size / 1024).toFixed(2)} KB)</span><button onclick="移除文件(\${index})">移除</button>\`;
        fileList.appendChild(div);
      });
    }

    function 移除文件(index) {
      const fileInput = document.getElementById('ipFiles');
      const dt = new DataTransfer();
      Array.from(fileInput.files).forEach((file, i) => i !== index && dt.items.add(file));
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
        alert('小仙女，请先选择文件哦~');
        return;
      }

      progressContainer.style.display = 'block';
      progressFill.style.width = '0%';
      progressText.textContent = '0%';

      const xhr = new XMLHttpRequest();
      xhr.open('POST', form.action, true);

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          progressFill.style.width = percent + '%';
          progressText.textContent = Math.round(percent) + '%';
        }
      };

      xhr.onload = () => {
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status === 200) {
            if (response.message) {
              setTimeout(() => {
                alert(response.message);
                window.location.href = response.Location || '/${configPath}';
              }, 500);
            } else {
              throw new Error('响应格式错误');
            }
          } else {
            throw new Error(response.error || '未知错误');
          }
        } catch (err) {
          progressContainer.style.display = 'none';
          alert(\`上传失败啦，状态码: \${xhr.status}，原因: \${err.message}\`);
        }
      };

      xhr.onerror = () => {
        progressContainer.style.display = 'none';
        alert('网络坏掉了，小仙女请检查一下哦~');
      };

      xhr.send(formData);
    }

    let lastUA = navigator.userAgent;
    function checkUAChange() {
      const currentUA = navigator.userAgent;
      if (currentUA !== lastUA) {
        console.log('UA 已切换，从', lastUA, '到', currentUA);
        lastUA = currentUA;
        adjustLayoutForUA();
      }
    }
    setInterval(checkUAChange, 500);

    function adjustLayoutForUA() {
      const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
      const container = document.querySelector('.container');
      const cards = document.querySelectorAll('.card');
      if (isMobile) {
        container.style.padding = '10px';
        cards.forEach(card => { card.style.maxWidth = '100%'; card.style.padding = '15px'; });
      } else {
        container.style.padding = '20px';
        cards.forEach(card => { card.style.maxWidth = '500px'; card.style.padding = '25px'; });
      }
    }
    adjustLayoutForUA();
  </script>
</body>
</html>`;

const generateKvUnboundPage = () => `
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
      position: relative;
      overflow: hidden;
      transition: background 0.5s ease;
    }
    @media (prefers-color-scheme: light) {
      body { background: linear-gradient(135deg, #ffe6f0, #fff0f5); }
      .content { background: rgba(255, 245, 247, 0.9); box-shadow: 0 8px 20px rgba(255, 182, 193, 0.3); }
    }
    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(135deg, #1e1e2f, #2a2a3b); }
      .content { background: rgba(30, 30, 30, 0.9); color: #ffd1dc; box-shadow: 0 8px 20px rgba(255, 133, 162, 0.2); }
    }
    .background-media {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: -1;
      transition: opacity 0.5s ease;
    }
    .content {
      padding: 30px;
      border-radius: 25px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      position: relative;
      z-index: 1;
    }
    h1 { font-size: 1.8em; color: #ff69b4; text-shadow: 1px 1px 3px rgba(255, 105, 180, 0.2); margin-bottom: 20px; }
    p { font-size: 1.1em; line-height: 1.6; color: #ff85a2; }
    .highlight { color: #ff1493; font-weight: bold; }
    .instruction { margin-top: 20px; font-size: 1em; color: #ff69b4; }
    @media (max-width: 600px) {
      .content { padding: 20px; }
      h1 { font-size: 1.5em; }
      p { font-size: 0.95em; }
    }
  </style>
</head>
<body>
  <img id="backgroundImage" class="background-media">
  <div class="content">
    <h1>💔 哎呀，KV没绑定哦</h1>
    <p>小仙女，你的 <span class="highlight">Cloudflare KV 存储空间</span> 还没绑定呢~<br>快去 <span class="highlight">Cloudflare Workers</span> 设置里绑一个 KV 命名空间（比如 <span class="highlight">LOGIN_STATE</span>），然后重新部署一下吧！</p>
    <div class="instruction">绑定好后，访问 <span class="highlight">/config</span> 就可以进入订阅啦~</div>
  </div>
  <script>
    const lightBg = '${LIGHT_BG}';
    const darkBg = '${DARK_BG}';
    const bgImage = document.getElementById('backgroundImage');
    const updateBackground = () => {
      bgImage.src = window.matchMedia('(prefers-color-scheme: dark)').matches ? darkBg : lightBg;
      bgImage.onerror = () => bgImage.style.display = 'none';
    };
    updateBackground();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBackground);

    let lastUA = navigator.userAgent;
    setInterval(() => {
      const currentUA = navigator.userAgent;
      if (currentUA !== lastUA) {
        console.log('UA 已切换，从', lastUA, '到', currentUA);
        lastUA = currentUA;
      }
    }, 500);
  </script>
</body>
</html>`;

const generateConfig1 = async (env, hostName) => {
  const uuid = await getOrInitUuid(env);
  const nodes = preferredNodes.length ? preferredNodes : [`${hostName}:443`];
  const countryGroups = {};

  nodes.forEach((node, index) => {
    const [main, tls] = node.split("@");
    const [addrPort, name = DEFAULT_NODE_NAME] = main.split("#");
    const [, addr, port = "443"] = addrPort.match(/^\[(.*?)\](?::(\d+))?$/) || addrPort.match(/^(.*?)(?::(\d+))?$/);
    const fixedAddr = addr.includes(":") ? addr.replace(/^\[|\]$/g, '') : addr;
    const tlsEnabled = tls === 'notls' ? 'false' : 'true';
    const country = name.split('-')[0] || '默认';
    const addrType = fixedAddr.includes(":") ? "IPv6" : "IPv4";

    countryGroups[country] = countryGroups[country] || { IPv4: [], IPv6: [] };
    countryGroups[country][addrType].push({
      name: `${name}-${countryGroups[country][addrType].length + 1}`,
      config: `- name: "${name}-${countryGroups[country][addrType].length + 1}"
  type: vless
  server: ${fixedAddr}
  port: ${port}
  uuid: ${uuid}
  udp: false
  tls: ${tlsEnabled}
  sni: ${hostName}
  network: ws
  ws-opts:
    path: "/?ed=2560"
    headers:
      Host: ${hostName}`
    });
  });

  const countries = Object.keys(countryGroups).sort();
  const nodeConfigs = countries.flatMap(c => [...countryGroups[c].IPv4, ...countryGroups[c].IPv6].map(n => n.config)).join("\n");
  const countryGroupConfigs = countries.map(c => `
  - name: "${c}"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 120
    tolerance: 50
    proxies:
${[...countryGroups[c].IPv4, ...countryGroups[c].IPv6].map(n => `      - "${n.name}"`).join("\n")}
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
${nodeConfigs}

proxy-groups:
  - name: "🚀节点选择"
    type: select
    proxies:
      - "🤪自动选择"
      - "🥰负载均衡"
${countries.map(c => `      - "${c}"`).join("\n")}

  - name: "🤪自动选择"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 120
    tolerance: 50
    proxies:
${countries.map(c => `      - "${c}"`).join("\n")}

  - name: "🥰负载均衡"
    type: load-balance
    strategy: round-robin
    proxies:
${countries.map(c => `      - "${c}"`).join("\n")}

${countryGroupConfigs}

rules:
  - GEOIP,LAN,DIRECT
  - DOMAIN-SUFFIX,cn,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,🚀节点选择`;
};

const generateConfig2 = async (env, hostName) => {
  const uuid = await getOrInitUuid(env);
  const nodes = preferredNodes.length ? preferredNodes : [`${hostName}:443`];
  const configs = nodes.map(node => {
    try {
      const [main, tls = 'tls'] = node.split("@");
      const [addrPort, name = DEFAULT_NODE_NAME] = main.split("#");
      const match = addrPort.match(/^(?:\[([0-9a-fA-F:]+)\]|([^:]+))(?:\:(\d+))?$/);
      if (!match) return null;
      const addr = match[1] || match[2];
      const port = match[3] || "443";
      if (!addr) return null;
      const fixedAddr = addr.includes(":") ? `[${addr}]` : addr;
      const security = tls === 'notls' ? 'none' : 'tls';
      const encodedPath = encodeURIComponent('/?ed=2560');
      return `vless://${uuid}@${fixedAddr}:${port}?encryption=none&security=${security}&type=ws&host=${hostName}&path=${encodedPath}&sni=${hostName}#${name}`;
    } catch (err) {
      console.error(`生成配置2节点失败: ${node}, 错误: ${err.message}`);
      return null;
    }
  }).filter(Boolean);

  return `# Generated at: ${new Date().toISOString()}
${configs.length ? configs.join("\n") : `vless://${uuid}@${hostName}:443?encryption=none&security=tls&type=ws&host=${hostName}&path=${encodeURIComponent('/?ed=2560')}&sni=${hostName}#默认节点`}`;
};