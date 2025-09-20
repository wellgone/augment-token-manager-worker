// 简化的邮箱生成器 CloudFlare Workers 脚本

// 获取可用域名列表
function getAvailableDomains(env) {
  try {
    if (env.EMAIL_DOMAINS) {
      if (Array.isArray(env.EMAIL_DOMAINS)) {
        return env.EMAIL_DOMAINS;
      }
    }
    return ['example.com']; // 默认域名
  } catch (error) {
    console.error('解析域名配置失败:', error);
    return ['example.com'];
  }
}

// 随机选择一个域名
function getRandomDomain(env) {
  const domains = getAvailableDomains(env);
  return domains[Math.floor(Math.random() * domains.length)];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 处理API请求
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url);
    }

    // 处理主页请求
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(getIndexHTML(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    // 对于其他请求，返回404
    return new Response('Not Found', { status: 404 });
  }
};

// 处理API请求
async function handleApiRequest(request, env, url) {
  const path = url.pathname.replace('/api', '');
  
  try {
    switch (path) {
      case '/generate-email':
        return handleGenerateEmail(request, env);
      case '/domains':
        return handleGetDomains(request, env);
      case '/verification-code':
        return handleVerificationCode(request, env);
      default:
        return new Response('API endpoint not found', { status: 404 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取可用域名列表
async function handleGetDomains(request, env) {
  if (request.method === 'GET') {
    const domains = getAvailableDomains(env);
    return new Response(JSON.stringify({ domains }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}

// 获取验证码
async function handleVerificationCode(request, env) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 从外部API获取邮件列表 - 只获取最新一封
    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1小时前的时间戳
    const apiUrl = `https://email.qianshe.dpdns.org/api/allEmail/list?emailId=0&size=1&timeSort=0&type=receive&searchType=name`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInRva2VuIjoiN2I1NmYzNjItYzM2Ni00ZjhhLTljZDUtN2Q1OWYxYzg0OWE0IiwiaWF0IjoxNzU2ODg4NTQ0fQ.w9BlFqjzGPIWEnib5FtoRRWhBPdf5qIF3sqZPfu631A' // 你提到的后端写死的authorization
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: '获取邮件失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    // 统一返回200状态，由前端判断是否有验证码
    if (data.code !== 200 || !data.data || !data.data.list) {
      return new Response(JSON.stringify({
        success: false,
        error: '邮件数据格式错误'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取最新的一封邮件（列表应该是按时间排序的，第一封就是最新的）
    const latestEmail = data.data.list[0];

    if (!latestEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: '没有找到邮件'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查邮件时间是否在1小时内
    const emailTime = new Date(latestEmail.createTime).getTime();
    if (emailTime < oneHourAgo) {
      return new Response(JSON.stringify({
        success: false,
        error: '没有找到1小时内的邮件'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 提取验证码（这里假设验证码在邮件内容中，你可能需要根据实际邮件格式调整）
    const verificationCode = extractVerificationCode(latestEmail);

    return new Response(JSON.stringify({
      success: true,
      recipientEmail: latestEmail.toEmail,
      verificationCode: verificationCode,
      timestamp: latestEmail.createTime
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: '获取验证码失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 从邮件内容中提取验证码
function extractVerificationCode(email) {
  const content = (email.content || email.text || '').toLowerCase();

  // 优先查找 "Your verification code is:" 格式
  const verificationMatch = content.match(/your verification code is[:：]\s*(\d{4,6})/i);
  if (verificationMatch) {
    return verificationMatch[1];
  }

  // 备用模式：查找独立的6位数字
  const codeMatch = content.match(/\b(\d{6})\b/g);
  if (codeMatch) {
    // 返回最后一个6位数字（通常是验证码）
    return codeMatch[codeMatch.length - 1];
  }

  return null;
}

// 生成随机邮箱
async function handleGenerateEmail(request, env) {
  if (request.method === 'POST') {
    try {
      const { type = 'mixed', prefix = '', length = 0, domain: customDomain = '' } = await request.json();
      
      // 使用自定义域名或随机选择一个域名
      const selectedDomain = customDomain || getRandomDomain(env);
      const email = generateRandomEmail(type, prefix, length, selectedDomain);
      const availableDomains = getAvailableDomains(env);

      return new Response(JSON.stringify({ 
        email, 
        domain: selectedDomain,
        availableDomains 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: '生成邮箱失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// 生成随机邮箱
function generateRandomEmail(type, prefix, length, domain) {
  if (!length || length === 0) {
    length = Math.floor(Math.random() * 8) + 8;
  } else {
    length = Math.max(8, Math.min(15, length));
  }

  let localPart = '';

  switch (type) {
    case 'mixed':
      localPart = generateRandomLocalPart(length);
      break;
    case 'word':
      localPart = generateWordBasedEmail(prefix, length);
      break;
    default:
      localPart = generateRandomLocalPart(length);
  }

  return `${localPart}@${domain}`;
}

// 生成随机邮箱本地部分（小写字母+数字）
function generateRandomLocalPart(length) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';

  let result = '';
  let digitCount = 0;
  const minDigits = 2;

  result += letters.charAt(Math.floor(Math.random() * letters.length));

  // 中间字符：确保至少有2个数字
  const middleLength = length - 2; // 减去首尾字符
  const positions = [];

  // 生成中间字符位置数组
  for (let i = 1; i <= middleLength; i++) {
    positions.push(i);
  }

  // 随机选择至少2个位置放数字
  const digitPositions = [];
  const numDigitsToPlace = Math.max(minDigits, Math.floor(Math.random() * Math.min(middleLength, 4)) + minDigits);

  // 随机选择数字位置
  while (digitPositions.length < Math.min(numDigitsToPlace, middleLength)) {
    const pos = Math.floor(Math.random() * middleLength) + 1;
    if (!digitPositions.includes(pos)) {
      digitPositions.push(pos);
    }
  }

  // 填充中间字符
  for (let i = 1; i < length - 1; i++) {
    if (digitPositions.includes(i)) {
      result += numbers.charAt(Math.floor(Math.random() * numbers.length));
      digitCount++;
    } else {
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
  }

  // 末尾字符必须是字母
  if (length > 1) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // 确保末尾是字母（如果当前末尾是数字，替换为字母）
  if (length > 1 && /\d/.test(result[result.length - 1])) {
    result = result.substring(0, result.length - 1) +
             letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // 如果数字不够2个，强制替换一些中间字母为数字（保持首尾是字母）
  if (digitCount < minDigits && length > 3) {
    const needMoreDigits = minDigits - digitCount;
    for (let i = 0; i < needMoreDigits; i++) {
      // 随机选择中间的一个字母位置替换为数字（不包括首尾）
      let pos = Math.floor(Math.random() * (length - 2)) + 1;
      let attempts = 0;
      // 确保这个位置不是数字，且不是末尾
      while ((pos >= result.length - 1 || /\d/.test(result[pos])) && attempts < 10) {
        pos = Math.floor(Math.random() * (length - 2)) + 1;
        attempts++;
      }
      if (pos < result.length - 1 && pos > 0) {
        result = result.substring(0, pos) +
                numbers.charAt(Math.floor(Math.random() * numbers.length)) +
                result.substring(pos + 1);
      }
    }
  }

  return result;
}

// 生成单词邮箱
function generateWordBasedEmail(prefix, length) {
  const words = ['happy', 'lucky', 'smart', 'quick', 'bright', 'cool', 'fast', 'nice', 'super', 'magic'];
  const word = words[Math.floor(Math.random() * words.length)];
  const numbers = '0123456789';

  let base = prefix ? prefix + word : word;
  
  // 确保长度符合要求
  if (base.length < length) {
    const remaining = length - base.length;
    for (let i = 0; i < remaining; i++) {
      if (i < remaining / 2) {
        base += numbers.charAt(Math.floor(Math.random() * numbers.length));
      } else {
        base += 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26));
      }
    }
  } else if (base.length > length) {
    base = base.substring(0, length);
  }

  return base.toLowerCase();
}

// 生成简化的HTML页面
function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>简化邮箱生成器</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📧</text></svg>" type="image/svg+xml">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .container { background: rgba(255, 255, 255, 0.95); border-radius: 20px; padding: 2rem; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); max-width: 500px; width: 100%; }
        h1 { text-align: center; color: #333; margin-bottom: 2rem; font-size: 2rem; }
        .form-group { margin-bottom: 1.5rem; }
        label { display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500; }
        input, select, button:not(.copy-btn) { width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 10px; font-size: 1rem; transition: all 0.3s ease; }
        input:focus, select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        button:not(.copy-btn) { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; cursor: pointer; font-weight: 600; margin-top: 1rem; }
        button:not(.copy-btn):hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); }
        .result { margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #667eea; }
        .email-display { font-family: 'Courier New', monospace; font-size: 1.1rem; font-weight: bold; color: #333; word-break: break-all; margin: 0.5rem 0; }
        .copy-btn { background: #28a745; padding: 0.6rem 1.2rem; font-size: 0.9rem; cursor: pointer; border: none; border-radius: 5px; color: white; white-space: nowrap; width: auto; display: flex; align-items: center; justify-content: center; margin: 0; line-height: 1; height: 2.4rem; }
        .copy-btn:hover { background: #218838; }
        .tip { background: #e3f2fd; padding: 1rem; border-radius: 10px; margin-bottom: 1.5rem; font-size: 0.9rem; color: #1976d2; }
        #customDomainGroup { display: none; }
        .btn-receive { background: #17a2b8; margin-top: 0.5rem; }
        .result-error { border-left-color: #dc3545; }
        .domain-info { margin-top: 1rem; font-size: 0.9rem; color: #666; }

        /* 验证码卡片样式 */
        .verification-card { text-align: center; margin: 1rem 0; }
        .verification-code-row { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1rem; }
        .verification-code { font-size: 2em; font-weight: bold; color: #007bff; letter-spacing: 0.2em; line-height: 1; height: 2.4rem; display: flex; align-items: center; }
        .verification-info { font-size: 0.85em; color: #666; }

        /* 历史记录样式 */
        .history-item { text-align: center; margin: 0.3rem 0; border-radius: 8px; padding: 0.8rem; }
        .history-item.latest { margin: 1rem 0; padding: 1.5rem 0.8rem; background-color: rgba(0, 123, 255, 0.05); }
        .history-item.old { border-top: 1px solid #eee; padding-top: 0.3rem; }
        .history-code { font-size: 1.1em; font-weight: normal; color: #007bff; letter-spacing: 0.2em; margin-bottom: 0.3rem; }
        .history-code.latest { font-size: 2em; font-weight: bold; margin: 0; }
        .history-info { font-size: 0.8em; color: #666; margin-bottom: 0.3rem; }
        .history-label { font-size: 0.7em; color: #ccc; }

        /* 动画和其他样式 */
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .btn-stop { background: #dc3545 !important; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 简化邮箱生成器</h1>
        <div class="tip">💡 字母数字混合，首尾字母</div>
        <div class="form-group">
            <label for="emailType">📧 邮箱类型</label>
            <select id="emailType">
                <option value="mixed">随机混合</option>
                <option value="word">单词组合</option>
            </select>
        </div>
        <div class="form-group">
            <label for="emailPrefix">🏷️ 前缀（可选）</label>
            <input type="text" id="emailPrefix" placeholder="例如: test, user">
        </div>
        <div class="form-group">
            <label for="emailLength">📏 长度（8-15，0为随机）</label>
            <input type="number" id="emailLength" min="0" max="15" placeholder="0">
        </div>
        <div class="form-group">
            <label for="domainSelect">🌐 选择域名</label>
            <select id="domainSelect" onchange="toggleCustomDomain()">
                <option value="">随机选择</option>
                <option value="custom">自定义</option>
            </select>
        </div>
        <div class="form-group" id="customDomainGroup">
            <label for="customDomainInput">✏️ 自定义域名</label>
            <input type="text" id="customDomainInput" placeholder="输入自定义域名">
        </div>
        <div id="result"></div>
        <button onclick="generateEmail()">🎯 生成邮箱</button>
        <button onclick="openEmailReceiver()" class="btn-receive">📧 接收邮件</button>
        <button onclick="toggleVerificationRefresh()" id="verificationBtn" class="btn-receive">获取验证码</button>
        <div id="verificationResult"></div>
    </div>
    <script>
        window.addEventListener('load', loadDomains);

        async function loadDomains() {
            try {
                const response = await fetch('/api/domains');
                const data = await response.json();
                const domainSelect = document.getElementById('domainSelect');
                domainSelect.innerHTML = '<option value="">随机选择</option><option value="custom">自定义</option>';
                data.domains.forEach(domain => {
                    const option = document.createElement('option');
                    option.value = domain;
                    option.textContent = domain;
                    domainSelect.appendChild(option);
                });
            } catch (error) { console.error('获取域名失败:', error); }
        }

        function toggleCustomDomain() {
            const domainSelect = document.getElementById('domainSelect');
            const customDomainGroup = document.getElementById('customDomainGroup');
            if (domainSelect.value === 'custom') {
                customDomainGroup.style.display = 'block';
            } else {
                customDomainGroup.style.display = 'none';
                document.getElementById('customDomainInput').value = '';
            }
        }
        async function generateEmail() {
            const type = document.getElementById('emailType').value;
            const prefix = document.getElementById('emailPrefix').value;
            const lengthInput = document.getElementById('emailLength').value;
            const length = lengthInput ? parseInt(lengthInput) : 0;
            let domain = document.getElementById('domainSelect').value;
            if (domain === 'custom') {
                domain = document.getElementById('customDomainInput').value.trim();
            }
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div>生成中...</div>';
            try {
                const response = await fetch('/api/generate-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, prefix, length, domain })
                });
                const result = await response.json();
                if (response.ok) {
                    resultDiv.innerHTML = \`<div class="result">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
                            <div>📧 生成的邮箱：</div>
                            <button class="copy-btn" onclick="copyToClipboard('\${result.email.replace(/'/g, "\\'")}')">复制邮箱</button>
                        </div>
                        <div class="email-display">\${result.email}</div>
                        <div class="domain-info">使用域名: \${result.domain}</div>
                    </div>\`;
                } else {
                    resultDiv.innerHTML = '<div class="result result-error">❌ ' + result.error + '</div>';
                }
            } catch (error) {
                resultDiv.innerHTML = '<div class="result result-error">❌ 生成失败，请重试</div>';
            }
        }
        async function copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                showToast('邮箱已复制到剪贴板！');
            } catch (error) {
                const textArea = document.createElement('textarea');
                textArea.value = text; document.body.appendChild(textArea);
                textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea);
                showToast('邮箱已复制到剪贴板！');
            }
        }
        function showToast(message) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 1rem; border-radius: 10px; z-index: 1000'; toast.style.animation = 'slideIn 0.3s ease';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        function openEmailReceiver() { window.open('https://email.qianshe.dpdns.org/', '_blank'); }

        async function getVerificationCode() {
            const resultDiv = document.getElementById('verificationResult');
            resultDiv.innerHTML = '<div>获取验证码中...</div>';

            try {
                const response = await fetch('/api/verification-code');
                const result = await response.json();

                if (result.success && result.verificationCode) {
                    resultDiv.innerHTML = \`<div class="result">
                        <div class="verification-card">
                            <div class="verification-code-row">
                                <div class="verification-code">\${result.verificationCode}</div>
                                <button class="copy-btn" onclick="copyToClipboard('\${result.verificationCode.replace(/'/g, "\\'")}')" >📄 复制</button>
                            </div>
                            <div class="verification-info">✉ \${result.recipientEmail} | ⏰ \${new Date(result.timestamp).toLocaleString()}</div>
                        </div>

                        </div>
                        </div>\`;

                    // 如果开启了自动刷新，则启动定时器
                    if (isAutoRefreshEnabled) {
                        startVerificationCodeRefresh();
                    }
                } else {
                    resultDiv.innerHTML = '<div class="result result-error">❌ ' + (result.error || '获取验证码失败') + '</div>';
                }
            } catch (error) {
                resultDiv.innerHTML = '<div class="result result-error">❌ 获取验证码失败，请重试</div>';
            }
        }

        let refreshInterval;
        let refreshState = {
            isActive: false,        // 是否正在自动刷新
            currentCode: null,      // 当前验证码
            lastCode: null,        // 上次验证码
            refreshInterval: null, // 主定时器
            checkInterval: null,   // 检测定时器
            nextRefreshTime: 30,   // 下次刷新间隔（秒）
            maxHistory: 5,         // 最大历史记录数
            history: []            // 历史记录数组
        };

        function toggleVerificationRefresh() {
            const btn = document.getElementById('verificationBtn');

            if (refreshState.isActive) {
                // 当前正在刷新，点击后停止
                stopAutoRefresh();
                btn.textContent = '获取验证码';
                btn.className = 'btn-receive';
            } else {
                // 当前停止状态，点击后开始
                startAutoRefresh();
                btn.textContent = '⏸️ 停止刷新';
                btn.className = 'btn-receive btn-stop';
            }
        }

        function startAutoRefresh() {
            refreshState.isActive = true;
            // 立即获取一次验证码
            getInitialVerificationCode();
        }

        function stopAutoRefresh() {
            refreshState.isActive = false;
            refreshState.currentCode = null;
            refreshState.lastCode = null;
            refreshState.nextRefreshTime = 30;

            // 清除所有定时器
            if (refreshState.refreshInterval) {
                clearInterval(refreshState.refreshInterval);
                refreshState.refreshInterval = null;
            }
            if (refreshState.checkInterval) {
                clearInterval(refreshState.checkInterval);
                refreshState.checkInterval = null;
            }
        }

        function getInitialVerificationCode() {
            fetch('/api/verification-code')
                .then(response => response.json())
                .then(result => {
                    if (result.verificationCode) {
                        updateVerificationCode(result);
                        startSmartRefresh();
                    }
                })
                .catch(error => {
                    console.error('获取验证码失败:', error);
                    stopAutoRefresh();
                    document.getElementById('verificationBtn').textContent = '获取验证码';
                });
        }

        function startSmartRefresh() {
            // 清除现有定时器
            if (refreshState.refreshInterval) {
                clearInterval(refreshState.refreshInterval);
            }
            if (refreshState.checkInterval) {
                clearInterval(refreshState.checkInterval);
            }

            // 设置主刷新定时器（30秒）
            refreshState.refreshInterval = setInterval(() => {
                fetchNewVerificationCode();
            }, refreshState.nextRefreshTime * 1000);

            // 设置检查定时器（30秒后检查是否需要调整刷新间隔）
            refreshState.checkInterval = setTimeout(() => {
                checkAndAdjustRefreshTime();
            }, refreshState.nextRefreshTime * 1000);
        }

        function fetchNewVerificationCode() {
            fetch('/api/verification-code')
                .then(response => response.json())
                .then(result => {
                    if (result.success && result.verificationCode && refreshState.isActive) {
                        // 比较新旧验证码
                        if (result.verificationCode !== refreshState.currentCode) {
                            // 验证码已更新，继续保持30秒间隔
                            refreshState.lastCode = refreshState.currentCode;
                            refreshState.currentCode = result.verificationCode;
                            addVerificationRecord(result);
                        } else {
                            // 验证码未变，调整为10秒间隔
                            adjustRefreshTime(10);
                        }
                    }
                })
                .catch(error => {
                    console.error('刷新验证码失败:', error);
                    // 如果连续失败3次，停止自动刷新
                    if (!refreshState.errorCount) refreshState.errorCount = 0;
                    refreshState.errorCount++;

                    if (refreshState.errorCount >= 3) {
                        showToast('验证码获取失败，请手动重试');
                        stopAutoRefresh();
                        document.getElementById('verificationBtn').textContent = '获取验证码';
                        document.getElementById('verificationBtn').className = 'btn-receive';
                    }
                });
        }

        function checkAndAdjustRefreshTime() {
            if (refreshState.currentCode && refreshState.currentCode === refreshState.lastCode) {
                // 30秒后验证码未变化，调整为10秒刷新
                adjustRefreshTime(10);
            }
        }

        function adjustRefreshTime(newInterval) {
            refreshState.nextRefreshTime = newInterval;

            // 重新启动智能刷新
            if (refreshState.refreshInterval) {
                clearInterval(refreshState.refreshInterval);
            }
            if (refreshState.checkInterval) {
                clearTimeout(refreshState.checkInterval);
            }

            // 设置新的定时器
            refreshState.refreshInterval = setInterval(() => {
                fetchNewVerificationCode();
            }, newInterval * 1000);

            refreshState.checkInterval = setTimeout(() => {
                checkAndAdjustRefreshTime();
            }, newInterval * 1000);
        }

        function updateVerificationCode(result) {
            refreshState.lastCode = refreshState.currentCode;
            refreshState.currentCode = result.verificationCode;
            addVerificationRecord(result);
        }

        function addVerificationRecord(result) {
            // 检查是否已存在相同的验证码记录
            const existingRecord = refreshState.history.find(record =>
                record.verificationCode === result.verificationCode &&
                record.recipientEmail === result.recipientEmail &&
                record.timestamp === result.timestamp
            );

            // 如果已存在相同记录，则不重复添加
            if (existingRecord) {
                console.log('验证码记录已存在，跳过添加');
                return;
            }

            // 创建新记录
            const record = {
                id: Date.now(),
                recipientEmail: result.recipientEmail,
                verificationCode: result.verificationCode,
                timestamp: result.timestamp,
                displayTime: new Date(result.timestamp).toLocaleString()
            };

            // 插入到第一行
            refreshState.history.unshift(record);

            // 限制最大历史记录数
            if (refreshState.history.length > refreshState.maxHistory) {
                refreshState.history = refreshState.history.slice(0, refreshState.maxHistory);
            }

            // 更新显示
            updateVerificationDisplay();
        }

        function updateVerificationDisplay() {
            const resultDiv = document.getElementById('verificationResult');

            if (refreshState.history.length === 0) {
                resultDiv.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem 0;">点击"获取验证码"开始</div>';
                return;
            }

            // 生成历史记录HTML
            const historyHtml = refreshState.history.map((record, index) => {
                const isLatest = index === 0;
                const fontSize = isLatest ? '2em' : '1.1em';
                const fontWeight = isLatest ? 'bold' : 'normal';
                const marginBottom = isLatest ? '1rem' : '0.3rem';
                const bgColor = isLatest ? 'rgba(0, 123, 255, 0.05)' : 'transparent';

                const itemClass = 'history-item' + (isLatest ? ' latest' : '') + (index > 0 && !isLatest ? ' old' : '');
                const codeClass = 'history-code' + (isLatest ? ' latest' : '');

                return '<div class="' + itemClass + '">' +
                        (isLatest ?
                            '<div class="verification-code-row">' +
                                '<div class="' + codeClass + '">' + record.verificationCode + '</div>' +
                                \`<button class="copy-btn" onclick="copyToClipboard('\${record.verificationCode.replace(/'/g, "\\'")}')">📄 复制</button>\` +
                            '</div>' :
                            '<div class="' + codeClass + '">' + record.verificationCode + '</div>'
                        ) +
                        '<div class="history-info">✉ ' + record.recipientEmail + ' | ⏰ ' + record.displayTime + '</div>' +
                        (isLatest ? '' : '<div class="history-label">历史记录</div>') +
                    '</div>';
            }).join('');

            resultDiv.innerHTML = historyHtml;
        }

        function stopVerificationCodeRefresh() {
            // 这个函数已被 stopAutoRefresh() 替代
        }

        // 页面卸载时清除定时器
        window.addEventListener('beforeunload', () => {
            stopAutoRefresh();
        });
    </script>
</body>
</html>`;
}
