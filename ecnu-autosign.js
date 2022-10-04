const __version = '0.1.0';
const scriptName = 'ECNU 自动签到';
const getOpenKeyRegex = /^https?:\/\/anti-epidemic\.ecnu\.edu\.cn\/clock\/mini\/wx\/new\?open_key\=(.+)/;
const openKeyKey = 'ECNU_OPENKEY';
const ecnuIDKey = 'ECNU_ID';
const ecnuNameKey = 'ECNU_NAME';

const magicJS = MagicJS(scriptName, "INFO");

function getMiniToken(openKey) {
    return new Promise((resolve, reject) => {
        magicJS.get(`https://anti-epidemic.ecnu.edu.cn/clock/mini/wx/new?open_key=${openKey}`, (err, res, data) => {
            if (err) {
                magicJS.logError(`Fail to obtain mini token: ${err}`);
                reject('无法获得 Mini Token。');
            } else {
                let obj = typeof data === "string" ? JSON.parse(data) : data;
                if (obj.message) {
                    magicJS.logInfo(`Successfully obtained mini token: ${obj.message}`);
                    resolve(obj.message);
                }
            }
        })
    });
}

function sign(miniToken, number, name) {
    const hastString = `${name}${number}ecnu1024`;
    const hash = md5(hastString);
    const recordTime = Date.now();

    const put = (options, callback) => {
        let _options = magicJS.adapterHttpOptions(options, 'PUT');
        // Adapted from https://github.com/blackmatrix7/MagicJS/blob/37cbe3a85ecccff7d3e1af9b998fd08e0ce890ae/src/magic.js#L505
        $task.fetch(_options).then(
            (resp) => {
                resp['status'] = resp.statusCode;
                callback(null, resp, resp.body);
            },
            (reason) => {
                callback(reason.error, null, null);
            }
        );
    }

    return new Promise((resolve, reject) => {
        put({
            url: 'https://anti-epidemic.ecnu.edu.cn/clock/mini/record',
            headers: {
                'MiniToken': miniToken,
                'Referer': 'https://servicewechat.com/wxfcaebbc17bdc154b/26/page-frame.html',
            },
            method: 'PUT',
            body: {
                number: number,
                location: '在学校',
                health: '健康，未超过37.3',
                recordTime: recordTime,
                token: hash,
            }
        }, (err, res, data) => {
            if (err) {
                magicJS.logError(`Fail to sign: ${err}`);
                reject('签到失败。');
            }
            let obj = typeof data === "string" ? JSON.parse(data) : data;
            magicJS.logInfo(`Sign result: ${JSON.stringify(data)}`);
            resolve(`${JSON.stringify(data)}`);
        });
    })
}

(async () => {
    if (magicJS.isRequest && getOpenKeyRegex.test(magicJS.request.url)) {
        const openKey = getOpenKeyRegex.exec(magicJS.request.url);
        const currentOpenKey = magicJS.read(openKeyKey);
        if (openKey && openKey.length > 0) {
            magicJS.logInfo('Acquired Open Key: ' + openKey[1]);
            if (currentOpenKey !== openKey[1]) {
                magicJS.write(openKeyKey, openKey[1]);
                magicJS.notify(scriptName, 'ECNU 认证信息已更新。', `Open Key: ${openKey[1]}`);
            } else {
                magicJS.notify(scriptName, 'ECNU 认证信息已获取。', `Open Key: ${openKey[1]}`);
            }

        }
    } else if (magicJS.isResponse && getOpenKeyRegex.test(magicJS.request.url)) {
        try {
            const obj = JSON.parse(magicJS.response.body);
            magicJS.logInfo(obj);
            if (magicJS.response.status === 200 && obj.result && obj.result.number && obj.result.name) {
                const uid = obj.result.number;
                const name = obj.result.name;
                magicJS.write(ecnuIDKey, uid);
                magicJS.write(ecnuNameKey, name);
                magicJS.logInfo(`Acquired user information. ID: ${uid}, name: {name}`);
                magicJS.notify(scriptName, 'ECNU 用户信息已更新。', `${name} (${uid})`);
            }
            else {
                magicJS.notify(scriptName, '无法获取 ECNU 用户信息。', '请尝试在小程序中重新登录。');
            }
        } catch (err) {
            magicJS.logError(`Fail to get user info: ${err}`);
            magicJS.notify(scriptName, '无法获取 ECNU 用户信息。', err);
        }
        magicJS.done(magicJS.response);
    } else {
        const openKey = magicJS.read(openKeyKey);
        const ecnuID = magicJS.read(ecnuIDKey);
        const name = magicJS.read(ecnuNameKey);
        magicJS.logInfo(`Open Key: ${openKey}; ECNU ID: ${ecnuID}; Name: ${name}`);
        magicJS.logInfo(`[ecnu-autosign] V${__version}, @billchen2k`);
        magicJS.logInfo('Signing started...');
        if (openKey) {
            const [miniTokenError, miniToken] = await magicJS.attempt(magicJS.retry(getMiniToken, 3, 1000)(openKey));
            if (miniTokenError) {
                magicJS.notify(scriptName, '签到失败', `错误：${miniTokenError}。用户信息可能已过期，请重新打开小程序获取。`);
            }
            const [signError, signResult] = await magicJS.attempt(magicJS.retry(sign, 3, 1000)(miniToken, ecnuID, name));
            if (signError) {
                magicJS.notify(scriptName, '签到失败', `错误：${miniTokenError}。用户信息可能已过期，请重新打开小程序获取。`)
            }
            const date = new Date().toISOString().split('T')[0];
            magicJS.notify(scriptName, `${date} 签到完成`, `服务器消息：${signResult}`);

        } else {
            magicJS.notify(scriptName, '错误：找不到 Open Key。', '请先在开启 Quantumult X 时手动打开一次学生健康打卡小程序，点击「开始使用」进入签到页面来获取 Open Key。');
            magicJS.logError('Fail to sign: Cannot find Open Key.');
        }
    }
     magicJS.done();
})();




// Ref: https://stackoverflow.com/a/60467595/10926869
function md5(inputString) {
    var hc = "0123456789abcdef";
    function rh(n) {var j, s = ""; for (j = 0; j <= 3; j++) s += hc.charAt((n >> (j * 8 + 4)) & 0x0F) + hc.charAt((n >> (j * 8)) & 0x0F); return s;}
    function ad(x, y) {var l = (x & 0xFFFF) + (y & 0xFFFF); var m = (x >> 16) + (y >> 16) + (l >> 16); return (m << 16) | (l & 0xFFFF);}
    function rl(n, c) {return (n << c) | (n >>> (32 - c));}
    function cm(q, a, b, x, s, t) {return ad(rl(ad(ad(a, q), ad(x, t)), s), b);}
    function ff(a, b, c, d, x, s, t) {return cm((b & c) | ((~b) & d), a, b, x, s, t);}
    function gg(a, b, c, d, x, s, t) {return cm((b & d) | (c & (~d)), a, b, x, s, t);}
    function hh(a, b, c, d, x, s, t) {return cm(b ^ c ^ d, a, b, x, s, t);}
    function ii(a, b, c, d, x, s, t) {return cm(c ^ (b | (~d)), a, b, x, s, t);}
    function sb(x) {
        var i; var nblk = ((x.length + 8) >> 6) + 1; var blks = new Array(nblk * 16); for (i = 0; i < nblk * 16; i++) blks[i] = 0;
        for (i = 0; i < x.length; i++) blks[i >> 2] |= x.charCodeAt(i) << ((i % 4) * 8);
        blks[i >> 2] |= 0x80 << ((i % 4) * 8); blks[nblk * 16 - 2] = x.length * 8; return blks;
    }
    var i, x = sb(inputString), a = 1732584193, b = -271733879, c = -1732584194, d = 271733878, olda, oldb, oldc, oldd;
    for (i = 0; i < x.length; i += 16) {
        olda = a; oldb = b; oldc = c; oldd = d;
        a = ff(a, b, c, d, x[i + 0], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = ff(b, c, d, a, x[i + 3], 22, -1044525330); a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983); a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = ff(b, c, d, a, x[i + 15], 22, 1236535329); a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i + 0], 20, -373897302); a = gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = gg(b, c, d, a, x[i + 8], 20, 1163531501); a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734); a = hh(a, b, c, d, x[i + 5], 4, -378558);
        d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = hh(b, c, d, a, x[i + 10], 23, -1094730640); a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i + 0], 11, -358537222);
        c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189); a = hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = ii(a, b, c, d, x[i + 0], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = ii(b, c, d, a, x[i + 5], 21, -57434055); a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799); a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = ii(b, c, d, a, x[i + 9], 21, -343485551); a = ad(a, olda); b = ad(b, oldb); c = ad(c, oldc); d = ad(d, oldd);
    }
    return rh(a) + rh(b) + rh(c) + rh(d);
}

// https://github.com/blackmatrix7/MagicJS
// https://github.com/blackmatrix7/ios_rule_script/tree/master/script
// prettier-ignore
function MagicJS(scriptName = "MagicJS", logLevel = "INFO") {return new class {constructor() {if (this.version = "2.2.3.3", this.scriptName = scriptName, this.logLevels = {DEBUG: 5, INFO: 4, NOTIFY: 3, WARNING: 2, ERROR: 1, CRITICAL: 0, NONE: -1}, this.isLoon = "undefined" != typeof $loon, this.isQuanX = "undefined" != typeof $task, this.isJSBox = "undefined" != typeof $drive, this.isNode = "undefined" != typeof module && !this.isJSBox, this.isSurge = "undefined" != typeof $httpClient && !this.isLoon, this.node = {request: void 0, fs: void 0, data: {}}, this.iOSUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Mobile/15E148 Safari/604.1", this.pcUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36 Edg/84.0.522.59", this.logLevel = logLevel, this._barkUrl = "", this.isNode) {this.node.fs = require("fs"), this.node.request = require("request"); try {this.node.fs.accessSync("./magic.json", this.node.fs.constants.R_OK | this.node.fs.constants.W_OK)} catch (err) {this.node.fs.writeFileSync("./magic.json", "{}", {encoding: "utf8"})} this.node.data = require("./magic.json")} else this.isJSBox && ($file.exists("drive://MagicJS") || $file.mkdir("drive://MagicJS"), $file.exists("drive://MagicJS/magic.json") || $file.write({data: $data({string: "{}"}), path: "drive://MagicJS/magic.json"}))} set barkUrl(url) {this._barkUrl = url.replace(/\/+$/g, "")} set logLevel(level) {this._logLevel = "string" == typeof level ? level.toUpperCase() : "DEBUG"} get logLevel() {return this._logLevel} get isRequest() {return "undefined" != typeof $request && "undefined" == typeof $response} get isResponse() {return "undefined" != typeof $response} get request() {return "undefined" != typeof $request ? $request : void 0} get response() {return "undefined" != typeof $response ? ($response.hasOwnProperty("status") && ($response.statusCode = $response.status), $response.hasOwnProperty("statusCode") && ($response.status = $response.statusCode), $response) : void 0} get platform() {return this.isSurge ? "Surge" : this.isQuanX ? "Quantumult X" : this.isLoon ? "Loon" : this.isJSBox ? "JSBox" : this.isNode ? "Node.js" : "Unknown"} read(key, session = "") {let val = ""; this.isSurge || this.isLoon ? val = $persistentStore.read(key) : this.isQuanX ? val = $prefs.valueForKey(key) : this.isNode ? val = this.node.data : this.isJSBox && (val = $file.read("drive://MagicJS/magic.json").string); try {this.isNode && (val = val[key]), this.isJSBox && (val = JSON.parse(val)[key]), session && ("string" == typeof val && (val = JSON.parse(val)), val = val && "object" == typeof val ? val[session] : null)} catch (err) {this.logError(err), val = session ? {} : null, this.del(key)} void 0 === val && (val = null); try {val && "string" == typeof val && (val = JSON.parse(val))} catch (err) {} return this.logDebug(`READ DATA [${key}]${session ? `[${session}]` : ""}(${typeof val})\n${JSON.stringify(val)}`), val} write(key, val, session = "") {let data = session ? {} : ""; if (session && (this.isSurge || this.isLoon) ? data = $persistentStore.read(key) : session && this.isQuanX ? data = $prefs.valueForKey(key) : this.isNode ? data = this.node.data : this.isJSBox && (data = JSON.parse($file.read("drive://MagicJS/magic.json").string)), session) {try {"string" == typeof data && (data = JSON.parse(data)), data = "object" == typeof data && data ? data : {}} catch (err) {this.logError(err), this.del(key), data = {}} this.isJSBox || this.isNode ? (data[key] && "object" == typeof data[key] || (data[key] = {}), data[key].hasOwnProperty(session) || (data[key][session] = null), void 0 === val ? delete data[key][session] : data[key][session] = val) : void 0 === val ? delete data[session] : data[session] = val} else this.isNode || this.isJSBox ? void 0 === val ? delete data[key] : data[key] = val : data = void 0 === val ? null : val; "object" == typeof data && (data = JSON.stringify(data)), this.isSurge || this.isLoon ? $persistentStore.write(data, key) : this.isQuanX ? $prefs.setValueForKey(data, key) : this.isNode ? this.node.fs.writeFileSync("./magic.json", data) : this.isJSBox && $file.write({data: $data({string: data}), path: "drive://MagicJS/magic.json"}), this.logDebug(`WRITE DATA [${key}]${session ? `[${session}]` : ""}(${typeof val})\n${JSON.stringify(val)}`)} del(key, session = "") {this.logDebug(`DELETE KEY [${key}]${session ? `[${session}]` : ""}`), this.write(key, null, session)} notify(title = this.scriptName, subTitle = "", body = "", opts = "") {let convertOptions; if (opts = (_opts => {let newOpts = {}; return "string" == typeof _opts ? this.isLoon ? newOpts = {openUrl: _opts} : this.isQuanX && (newOpts = {"open-url": _opts}) : "object" == typeof _opts && (this.isLoon ? (newOpts.openUrl = _opts["open-url"] ? _opts["open-url"] : "", newOpts.mediaUrl = _opts["media-url"] ? _opts["media-url"] : "") : this.isQuanX && (newOpts = _opts["open-url"] || _opts["media-url"] ? _opts : {})), newOpts})(opts), 1 == arguments.length && (title = this.scriptName, subTitle = "", body = arguments[0]), this.logNotify(`title:${title}\nsubTitle:${subTitle}\nbody:${body}\noptions:${"object" == typeof opts ? JSON.stringify(opts) : opts}`), this.isSurge) $notification.post(title, subTitle, body); else if (this.isLoon) opts ? $notification.post(title, subTitle, body, opts) : $notification.post(title, subTitle, body); else if (this.isQuanX) $notify(title, subTitle, body, opts); else if (this.isNode) {if (this._barkUrl) {let content = encodeURI(`${title}/${subTitle}\n${body}`); this.get(`${this._barkUrl}/${content}`, () => {})} } else if (this.isJSBox) {let push = {title: title, body: subTitle ? `${subTitle}\n${body}` : body}; $push.schedule(push)} } notifyDebug(title = this.scriptName, subTitle = "", body = "", opts = "") {"DEBUG" === this.logLevel && (1 == arguments.length && (title = this.scriptName, subTitle = "", body = arguments[0]), this.notify(title = title, subTitle = subTitle, body = body, opts = opts))} log(msg, level = "INFO") {this.logLevels[this._logLevel] < this.logLevels[level.toUpperCase()] || console.log(`[${level}] [${this.scriptName}]\n${msg}\n`)} logDebug(msg) {this.log(msg, "DEBUG")} logInfo(msg) {this.log(msg, "INFO")} logNotify(msg) {this.log(msg, "NOTIFY")} logWarning(msg) {this.log(msg, "WARNING")} logError(msg) {this.log(msg, "ERROR")} logRetry(msg) {this.log(msg, "RETRY")} adapterHttpOptions(options, method) {let _options = "object" == typeof options ? Object.assign({}, options) : {url: options, headers: {}}; _options.hasOwnProperty("header") && !_options.hasOwnProperty("headers") && (_options.headers = _options.header, delete _options.header); const headersMap = {accept: "Accept", "accept-ch": "Accept-CH", "accept-charset": "Accept-Charset", "accept-features": "Accept-Features", "accept-encoding": "Accept-Encoding", "accept-language": "Accept-Language", "accept-ranges": "Accept-Ranges", "access-control-allow-credentials": "Access-Control-Allow-Credentials", "access-control-allow-origin": "Access-Control-Allow-Origin", "access-control-allow-methods": "Access-Control-Allow-Methods", "access-control-allow-headers": "Access-Control-Allow-Headers", "access-control-max-age": "Access-Control-Max-Age", "access-control-expose-headers": "Access-Control-Expose-Headers", "access-control-request-method": "Access-Control-Request-Method", "access-control-request-headers": "Access-Control-Request-Headers", age: "Age", allow: "Allow", alternates: "Alternates", authorization: "Authorization", "cache-control": "Cache-Control", connection: "Connection", "content-encoding": "Content-Encoding", "content-language": "Content-Language", "content-length": "Content-Length", "content-location": "Content-Location", "content-md5": "Content-MD5", "content-range": "Content-Range", "content-security-policy": "Content-Security-Policy", "content-type": "Content-Type", cookie: "Cookie", dnt: "DNT", date: "Date", etag: "ETag", expect: "Expect", expires: "Expires", from: "From", host: "Host", "if-match": "If-Match", "if-modified-since": "If-Modified-Since", "if-none-match": "If-None-Match", "if-range": "If-Range", "if-unmodified-since": "If-Unmodified-Since", "last-event-id": "Last-Event-ID", "last-modified": "Last-Modified", link: "Link", location: "Location", "max-forwards": "Max-Forwards", negotiate: "Negotiate", origin: "Origin", pragma: "Pragma", "proxy-authenticate": "Proxy-Authenticate", "proxy-authorization": "Proxy-Authorization", range: "Range", referer: "Referer", "retry-after": "Retry-After", "sec-websocket-extensions": "Sec-Websocket-Extensions", "sec-websocket-key": "Sec-Websocket-Key", "sec-websocket-origin": "Sec-Websocket-Origin", "sec-websocket-protocol": "Sec-Websocket-Protocol", "sec-websocket-version": "Sec-Websocket-Version", server: "Server", "set-cookie": "Set-Cookie", "set-cookie2": "Set-Cookie2", "strict-transport-security": "Strict-Transport-Security", tcn: "TCN", te: "TE", trailer: "Trailer", "transfer-encoding": "Transfer-Encoding", upgrade: "Upgrade", "user-agent": "User-Agent", "variant-vary": "Variant-Vary", vary: "Vary", via: "Via", warning: "Warning", "www-authenticate": "WWW-Authenticate", "x-content-duration": "X-Content-Duration", "x-content-security-policy": "X-Content-Security-Policy", "x-dnsprefetch-control": "X-DNSPrefetch-Control", "x-frame-options": "X-Frame-Options", "x-requested-with": "X-Requested-With", "x-surge-skip-scripting": "X-Surge-Skip-Scripting"}; if ("object" == typeof _options.headers) for (let key in _options.headers) headersMap[key] && (_options.headers[headersMap[key]] = _options.headers[key], delete _options.headers[key]); _options.headers && "object" == typeof _options.headers && _options.headers["User-Agent"] || (_options.headers && "object" == typeof _options.headers || (_options.headers = {}), this.isNode ? _options.headers["User-Agent"] = this.pcUserAgent : _options.headers["User-Agent"] = this.iOSUserAgent); let skipScripting = !1; if (("object" == typeof _options.opts && (!0 === _options.opts.hints || !0 === _options.opts["Skip-Scripting"]) || "object" == typeof _options.headers && !0 === _options.headers["X-Surge-Skip-Scripting"]) && (skipScripting = !0), skipScripting || (this.isSurge ? _options.headers["X-Surge-Skip-Scripting"] = !1 : this.isLoon ? _options.headers["X-Requested-With"] = "XMLHttpRequest" : this.isQuanX && ("object" != typeof _options.opts && (_options.opts = {}), _options.opts.hints = !1)), this.isSurge && !skipScripting || delete _options.headers["X-Surge-Skip-Scripting"], !this.isQuanX && _options.hasOwnProperty("opts") && delete _options.opts, this.isQuanX && _options.hasOwnProperty("opts") && delete _options.opts["Skip-Scripting"], "GET" === method && !this.isNode && _options.body) {let qs = Object.keys(_options.body).map(key => void 0 === _options.body ? "" : `${encodeURIComponent(key)}=${encodeURIComponent(_options.body[key])}`).join("&"); _options.url.indexOf("?") < 0 && (_options.url += "?"), _options.url.lastIndexOf("&") + 1 != _options.url.length && _options.url.lastIndexOf("?") + 1 != _options.url.length && (_options.url += "&"), _options.url += qs, delete _options.body} return this.isQuanX ? (_options.hasOwnProperty("body") && "string" != typeof _options.body && (_options.body = JSON.stringify(_options.body)), _options.method = method) : this.isNode ? (delete _options.headers["Accept-Encoding"], "object" == typeof _options.body && ("GET" === method ? (_options.qs = _options.body, delete _options.body) : "POST" === method && (_options.json = !0, _options.body = _options.body))) : this.isJSBox && (_options.header = _options.headers, delete _options.headers), _options} adapterHttpResponse(resp) {let _resp = {body: resp.body, headers: resp.headers, json: () => JSON.parse(_resp.body)}; return resp.hasOwnProperty("statusCode") && resp.statusCode && (_resp.status = resp.statusCode), _resp} get(options, callback) {let _options = this.adapterHttpOptions(options, "GET"); this.logDebug(`HTTP GET: ${JSON.stringify(_options)}`), this.isSurge || this.isLoon ? $httpClient.get(_options, callback) : this.isQuanX ? $task.fetch(_options).then(resp => {resp.status = resp.statusCode, callback(null, resp, resp.body)}, reason => callback(reason.error, null, null)) : this.isNode ? this.node.request.get(_options, (err, resp, data) => {resp = this.adapterHttpResponse(resp), callback(err, resp, data)}) : this.isJSBox && (_options.handler = resp => {let err = resp.error ? JSON.stringify(resp.error) : void 0, data = "object" == typeof resp.data ? JSON.stringify(resp.data) : resp.data; callback(err, resp.response, data)}, $http.get(_options))} getPromise(options) {return new Promise((resolve, reject) => {magicJS.get(options, (err, resp) => {err ? reject(err) : resolve(resp)})})} post(options, callback) {let _options = this.adapterHttpOptions(options, "POST"); if (this.logDebug(`HTTP POST: ${JSON.stringify(_options)}`), this.isSurge || this.isLoon) $httpClient.post(_options, callback); else if (this.isQuanX) $task.fetch(_options).then(resp => {resp.status = resp.statusCode, callback(null, resp, resp.body)}, reason => {callback(reason.error, null, null)}); else if (this.isNode) {let resp = this.node.request.post(_options, callback); resp.status = resp.statusCode, delete resp.statusCode} else this.isJSBox && (_options.handler = resp => {let err = resp.error ? JSON.stringify(resp.error) : void 0, data = "object" == typeof resp.data ? JSON.stringify(resp.data) : resp.data; callback(err, resp.response, data)}, $http.post(_options))} get http() {return {get: this.getPromise, post: this.post}} done(value = {}) {"undefined" != typeof $done && $done(value)} isToday(day) {if (null == day) return !1; {let today = new Date; return "string" == typeof day && (day = new Date(day)), today.getFullYear() == day.getFullYear() && today.getMonth() == day.getMonth() && today.getDay() == day.getDay()} } isNumber(val) {return "NaN" !== parseFloat(val).toString()} attempt(promise, defaultValue = null) {return promise.then(args => [null, args]).catch(ex => (this.logError(ex), [ex, defaultValue]))} retry(fn, retries = 5, interval = 0, callback = null) {return (...args) => new Promise((resolve, reject) => {function _retry(...args) {Promise.resolve().then(() => fn.apply(this, args)).then(result => {"function" == typeof callback ? Promise.resolve().then(() => callback(result)).then(() => {resolve(result)}).catch(ex => {retries >= 1 ? interval > 0 ? setTimeout(() => _retry.apply(this, args), interval) : _retry.apply(this, args) : reject(ex), retries--}) : resolve(result)}).catch(ex => {this.logRetry(ex), retries >= 1 && interval > 0 ? setTimeout(() => _retry.apply(this, args), interval) : retries >= 1 ? _retry.apply(this, args) : reject(ex), retries--})} _retry.apply(this, args)})} formatTime(time, fmt = "yyyy-MM-dd hh:mm:ss") {var o = {"M+": time.getMonth() + 1, "d+": time.getDate(), "h+": time.getHours(), "m+": time.getMinutes(), "s+": time.getSeconds(), "q+": Math.floor((time.getMonth() + 3) / 3), S: time.getMilliseconds()}; /(y+)/.test(fmt) && (fmt = fmt.replace(RegExp.$1, (time.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let k in o) new RegExp("(" + k + ")").test(fmt) && (fmt = fmt.replace(RegExp.$1, 1 == RegExp.$1.length ? o[k] : ("00" + o[k]).substr(("" + o[k]).length))); return fmt} now() {return this.formatTime(new Date, "yyyy-MM-dd hh:mm:ss")} today() {return this.formatTime(new Date, "yyyy-MM-dd")} sleep(time) {return new Promise(resolve => setTimeout(resolve, time))} }(scriptName)}