'use strict'

import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

// 前缀，如果自定义路由为example.com/gh/*，将PREFIX改为 '/gh/'，注意，少一个杠都会错！
const PREFIX = '/'
// 分支文件使用jsDelivr镜像的开关，0为关闭，默认关闭
const Config = {
    jsdelivr: 0
}

const whiteList = [] // 白名单，路径里面有包含字符的才会通过，e.g. ['/username/']

/** @type {RequestInit} */
const PREFLIGHT_INIT = {
    status: 204,
    headers: new Headers({
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
        'access-control-max-age': '1728000',
    }),
}

const exp1 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const exp2 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const exp3 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i
const exp4 = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const exp5 = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const exp6 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i
const exp7 = /^(?:https?:\/\/)?api\.github\.com\/.*$/i
const exp8 = /^(?:https?:\/\/)?git\.io\/.*$/i
const exp9 = /^(?:https?:\/\/)?gitlab\.com\/.*$/i

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function makeRes(body, status = 200, headers = {}) {
    headers['access-control-allow-origin'] = '*'
    return new Response(body, {status, headers})
}

/**
 * @param {string} urlStr
 */
function newUrl(urlStr) {
    try {
        return new URL(urlStr)
    } catch (err) {
        return null
    }
}

function checkUrl(u) {
    for (let i of [exp1, exp2, exp3, exp4, exp5, exp6, exp7, exp8, exp9]) {
        if (u.search(i) === 0) {
            return true
        }
    }
    return false
}

/**
 * 生成短链接的随机码
 * @param {number} length 短链接长度
 * @returns {string} 生成的短码
 */
function generateShortCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 存储短链接映射
 * @param {string} shortCode 短码
 * @param {string} originalUrl 原始URL
 * @param {KVNamespace} kv KV存储实例
 * @returns {Promise<string>} 短码
 */
async function storeShortUrl(shortCode, originalUrl, kv) {
    const key = `shorturl:${shortCode}`;
    const data = {
        url: originalUrl,
        created: Date.now(),
        accessCount: 0,
        lastAccessed: null
    };
    
    // 存储到KV，设置1年过期时间
    await kv.put(key, JSON.stringify(data), {
        expirationTtl: 31536000 // 1年，单位秒
    });
    
    return shortCode;
}

/**
 * 获取短链接对应的原始URL
 * @param {string} shortCode 短码
 * @param {KVNamespace} kv KV存储实例
 * @returns {Promise<string|null>} 原始URL或null
 */
async function getOriginalUrl(shortCode, kv) {
    const key = `shorturl:${shortCode}`;
    const dataStr = await kv.get(key);
    
    if (!dataStr) {
        return null; // 短链接不存在
    }
    
    const data = JSON.parse(dataStr);
    
    // 更新访问计数和最后访问时间
    data.accessCount += 1;
    data.lastAccessed = Date.now();
    
    // 异步更新KV中的数据
    kv.put(key, JSON.stringify(data), {
        expirationTtl: 31536000 // 重置过期时间
    });
    
    return data.url;
}

/**
 * 验证URL是否符合GitHub相关格式（使用正则测试）
 * @param {string} url 要检查的URL
 * @returns {boolean} 是否为有效的GitHub URL
 */
function validateGitHubUrl(url) {
    return checkUrl(url);
}

/**
 * 检查速率限制
 * @param {string} ip 客户端IP
 * @param {KVNamespace} kv KV存储实例
 * @returns {Promise<boolean>} 是否允许请求
 */
async function checkRateLimit(ip, kv) {
    const minuteKey = `ratelimit:${ip}:minute:${Math.floor(Date.now() / 60000)}`;
    const hourKey = `ratelimit:${ip}:hour:${Math.floor(Date.now() / 3600000)}`;
    
    // 获取当前计数
    const minuteCountStr = await kv.get(minuteKey);
    const hourCountStr = await kv.get(hourKey);
    
    const minuteCount = minuteCountStr ? parseInt(minuteCountStr) : 0;
    const hourCount = hourCountStr ? parseInt(hourCountStr) : 0;
    
    // 检查是否超出限制
    if (minuteCount >= 10) { // 每分钟10个请求
        return false;
    }
    
    if (hourCount >= 100) { // 每小时100个请求
        return false;
    }
    
    // 更新计数
    await kv.put(minuteKey, (minuteCount + 1).toString(), { expirationTtl: 60 });
    await kv.put(hourKey, (hourCount + 1).toString(), { expirationTtl: 3600 });
    
    return true;
}

/**
 * @param {FetchEvent} e
 */
async function fetchHandler(e) {
    const req = e.request
    const urlStr = req.url
    const urlObj = new URL(urlStr)
    
    console.log("in:" +urlStr)

    // 获取KV存储
    const kv = e.env ? (e.env.ASSETS || e.env.KV) : null;
    
    if (!kv) {
        console.error('KV storage not available');
        // 继续执行，但短链接功能将不可用
    }

    // 处理短链接访问
    if (urlObj.pathname.startsWith('/s/')) {
        if (!kv) {
            return new Response('KV storage not available', { status: 500 });
        }
        
        const shortCode = urlObj.pathname.slice(3); // 移除'/s/'前缀
        
        const originalUrl = await getOriginalUrl(shortCode, kv);
        if (!originalUrl) {
            return new Response('Short link not found', { status: 404 });
        }
        
        // 使用原始URL，通过现有代理逻辑获取内容
        return httpHandler(req, originalUrl);
    }
    
    // 处理生成短链接的API
    if (urlObj.pathname === '/api/shorten' && req.method === 'POST') {
        if (!kv) {
            return new Response(JSON.stringify({
                error: 'KV storage not available'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // 获取客户端IP
        const clientIP = req.headers.get('CF-Connecting-IP') || '0.0.0.0';
        
        // 检查速率限制
        const allowed = await checkRateLimit(clientIP, kv);
        if (!allowed) {
            return new Response(JSON.stringify({
                error: '请求过于频繁，请稍后再试'
            }), { 
                status: 429,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        try {
            const body = await req.json();
            const url = body.url;
            
            // 验证URL
            if (!url || !validateGitHubUrl(url)) {
                return new Response(JSON.stringify({
                    error: '不支持的URL格式'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // 生成短码
            let shortCode = generateShortCode();
            
            // 检查短码是否已存在，如果存在则重新生成
            let attempts = 0;
            while (attempts < 5) {
                const exists = await kv.get(`shorturl:${shortCode}`);
                if (!exists) break;
                shortCode = generateShortCode();
                attempts++;
            }
            
            // 存储映射
            await storeShortUrl(shortCode, url, kv);
            
            // 返回结果
            return new Response(JSON.stringify({
                originalUrl: url,
                shortUrl: `${urlObj.origin}/s/${shortCode}`
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (error) {
            console.error('Error processing shorten request:', error);
            return new Response(JSON.stringify({
                error: '处理请求失败'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // 处理批量生成短链接的API
    if (urlObj.pathname === '/api/shorten-bulk' && req.method === 'POST') {
        if (!kv) {
            return new Response(JSON.stringify({
                error: 'KV storage not available'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // 获取客户端IP
        const clientIP = req.headers.get('CF-Connecting-IP') || '0.0.0.0';
        
        // 检查速率限制
        const allowed = await checkRateLimit(clientIP, kv);
        if (!allowed) {
            return new Response(JSON.stringify({
                error: '请求过于频繁，请稍后再试'
            }), { 
                status: 429,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        try {
            const body = await req.json();
            const urls = body.urls || [];
            
            // 验证URL数量
            if (!urls.length) {
                return new Response(JSON.stringify({
                    error: '请提供至少一个URL'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            if (urls.length > 50) {
                return new Response(JSON.stringify({
                    error: '一次最多处理50个URL'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // 处理每个URL
            const results = [];
            for (const url of urls) {
                // 验证URL
                if (!url || !validateGitHubUrl(url)) {
                    results.push({
                        originalUrl: url,
                        error: '不支持的URL格式',
                        status: 'error'
                    });
                    continue;
                }
                
                // 生成短码
                let shortCode = generateShortCode();
                
                // 检查短码是否已存在
                let attempts = 0;
                while (attempts < 3) {
                    const exists = await kv.get(`shorturl:${shortCode}`);
                    if (!exists) break;
                    shortCode = generateShortCode();
                    attempts++;
                }
                
                // 存储映射
                await storeShortUrl(shortCode, url, kv);
                
                results.push({
                    originalUrl: url,
                    shortUrl: `${urlObj.origin}/s/${shortCode}`,
                    status: 'success'
                });
            }
            
            // 返回结果
            return new Response(JSON.stringify(results), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (error) {
            console.error('Error processing bulk shorten request:', error);
            return new Response(JSON.stringify({
                error: '处理请求失败'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // 处理OPTIONS请求（CORS预检请求）
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    let path = urlObj.searchParams.get('q')
    if (path) {
        return Response.redirect('https://' + urlObj.host + PREFIX + path, 301)
    }

    path = urlObj.href.substr(urlObj.origin.length + PREFIX.length)
    console.log ("path:" + path)

    // 判断有没有嵌套自己调用自己
    const exp0 = 'https:/' + urlObj.host + '/'
    console.log ("exp0:" + exp0)
    while (path.startsWith(exp0)) {
        console.log ("in while")
        path = path.replace(exp0, '')
    }
    console.log ("path:" + path)

    // cfworker 会把路径中的 `//` 合并成 `/`
    path = path.replace(/^https?:\/+/, 'https://')
    console.log ("path:" + path)

    if (path.search(exp1) === 0 || path.search(exp3) === 0 || path.search(exp4) === 0 || path.search(exp5) === 0 || path.search(exp6) === 0 || path.search(exp7) === 0 || path.search(exp8) === 0 || path.search(exp9) === 0) {
        
        console.log("exp 1,3,4,5,6,7,8, 9")

        return httpHandler(req, path)
    } else if (path.search(exp2) === 0) {
        if (Config.jsdelivr) {
            const newUrl = path.replace('/blob/', '@').replace(/^(?:https?:\/\/)?github\.com/, 'https://cdn.jsdelivr.net/gh')
            return Response.redirect(newUrl, 302)
        } else {
            path = path.replace('/blob/', '/raw/')
            return httpHandler(req, path)
        }
    } else if (path.search(exp4) === 0) {
        const newUrl = path.replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1').replace(/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com/, 'https://cdn.jsdelivr.net/gh')
        return Response.redirect(newUrl, 302)
    } else if (path==='perl-pe-para') {
      let perlstr = 'perl -pe'
      let responseText = 's#(bash.*?\\.sh)([^/\\w\\d])#\\1 | ' + perlstr + ' "\\$(curl -L ' + urlObj.origin + '/perl-pe-para)" \\2#g; ' +
                   's# (git)# https://\\1#g; ' +
                   's#(http.*?git[^/]*?/)#' + urlObj.origin + '/\\1#g';
      return new Response( responseText, { status: 200, 
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'max-age=300'
            }
          });
    } else {
        // 处理静态资源请求 - 使用 Workers Sites
        try {
            return await getAssetFromKV(e)
        } catch (err) {
            return new Response('Not Found', { status: 404 })
        }
    }
}

/**
 * @param {Request} req
 * @param {string} pathname
 */
function httpHandler(req, pathname) {
    const reqHdrRaw = req.headers

    // preflight
    if (req.method === 'OPTIONS' &&
        reqHdrRaw.has('access-control-request-headers')
    ) {
        return new Response(null, PREFLIGHT_INIT)
    }

    const reqHdrNew = new Headers(reqHdrRaw)

    let urlStr = pathname
    let flag = !Boolean(whiteList.length)
    for (let i of whiteList) {
        if (urlStr.includes(i)) {
            flag = true
            break
        }
    }
    if (!flag) {
        return new Response("blocked", {status: 403})
    }
    if (urlStr.startsWith('git')) {
        urlStr = 'https://' + urlStr
    }

    console.log("urlStr "+urlStr)

    const urlObj = newUrl(urlStr)

    /** @type {RequestInit} */
    const reqInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: 'manual',
        body: req.body
    }
    return proxy(urlObj, reqInit)
}

/**
 *
 * @param {URL} urlObj
 * @param {RequestInit} reqInit
 */
async function proxy(urlObj, reqInit) {
    const res = await fetch(urlObj.href, reqInit)
    const resHdrOld = res.headers
    const resHdrNew = new Headers(resHdrOld)

    const status = res.status

    if (resHdrNew.has('location')) {
        let _location = resHdrNew.get('location')
        if (checkUrl(_location))
            resHdrNew.set('location', PREFIX + _location)
        else {
            reqInit.redirect = 'follow'
            return proxy(newUrl(_location), reqInit)
        }
    }
    resHdrNew.set('access-control-expose-headers', '*')
    resHdrNew.set('access-control-allow-origin', '*')

    resHdrNew.delete('content-security-policy')
    resHdrNew.delete('content-security-policy-report-only')
    resHdrNew.delete('clear-site-data')

    return new Response(res.body, {
        status,
        headers: resHdrNew,
    })
}

// 监听 fetch 事件
addEventListener('fetch', e => {
    const ret = fetchHandler(e)
        .catch(err => makeRes('cfworker error:\n' + err.stack, 502))
    e.respondWith(ret)
})
