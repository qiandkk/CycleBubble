/**
 * CycleBubble API 客户端
 * 负责所有后端交互，替代 localStorage
 */
var CB_API = (function () {
  // 自动适配：本地开发用 localhost:8765（dev.ps1 端口约定），线上用 Render 后端。
  var BASE;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    BASE = "http://localhost:8765";
  } else {
    // 线上后端地址（Render 部署）
    BASE = "https://cyclebubble-api.onrender.com";
  }
  var TOKEN_KEY = "cb_token";

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }

  function setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function request(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);

    var res = await fetch(BASE + path, opts);

    if (res.status === 401) {
      clearToken();
      throw new Error("未登录或登录已过期");
    }

    if (!res.ok) {
      var err = await res.json().catch(function () { return { detail: "请求失败" }; });
      throw new Error(err.detail || "请求失败");
    }

    return res.json();
  }

  // ====== 认证 ======
  async function register(email, password, nickname) {
    var data = await request("POST", "/api/auth/register", {
      email: email, password: password, nickname: nickname
    });
    setToken(data.token);
    return data;
  }

  async function login(email, password) {
    var data = await request("POST", "/api/auth/login", {
      email: email, password: password
    });
    setToken(data.token);
    return data;
  }

  function logout() {
    clearToken();
    window.location.reload();
  }

  // ====== Memory ======
  async function createMemory(rawText, isPublic) {
    return request("POST", "/api/memories", {
      raw_text: rawText, is_public: isPublic || false
    });
  }

  async function getMemories() {
    return request("GET", "/api/memories");
  }

  // ====== Pattern + Bubble ======
  async function getPatterns() {
    return request("GET", "/api/patterns");
  }

  async function getBubbleState() {
    return request("GET", "/api/bubble-state");
  }

  // ====== Growth ======
  async function getGrowth() {
    return request("GET", "/api/growth");
  }

  // ====== Resonance ======
  async function getResonanceFeed() {
    return request("GET", "/api/resonance/feed");
  }

  async function createResponse(memoryId, responseType, content) {
    return request("POST", "/api/resonance/" + memoryId + "/responses", {
      response_type: responseType,
      content: content
    });
  }

  // ====== Cycle ======
  async function addPeriod(periodStart, periodEnd) {
    var body = { period_start: periodStart };
    if (periodEnd) body.period_end = periodEnd;
    return request("POST", "/api/cycle/periods", body);
  }

  async function getCycleStatus() {
    return request("GET", "/api/cycle/status");
  }

  async function getPeriods() {
    return request("GET", "/api/cycle/periods");
  }

  return {
    BASE: BASE,
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    register: register,
    login: login,
    logout: logout,
    createMemory: createMemory,
    getMemories: getMemories,
    getPatterns: getPatterns,
    getBubbleState: getBubbleState,
    getGrowth: getGrowth,
    getResonanceFeed: getResonanceFeed,
    createResponse: createResponse,
    addPeriod: addPeriod,
    getCycleStatus: getCycleStatus,
    getPeriods: getPeriods
  };
})();
