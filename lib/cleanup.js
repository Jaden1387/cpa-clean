const STATUS_KEYWORDS = new Set([
  "token_invalidated",
  "token_revoked",
  "usage_limit_reached",
]);

const MESSAGE_KEYWORDS = [
  "额度获取失败：401",
  '"status":401',
  '"status": 401',
  "your authentication token has been invalidated.",
  "encountered invalidated oauth token for user",
  "token_invalidated",
  "token_revoked",
  "usage_limit_reached",
];

const PROBE_TARGET_URL = "https://chatgpt.com/backend-api/codex/responses/compact";
const PROBE_MODEL = "gpt-5.1-codex";

function now() {
  return new Date().toTimeString().slice(0, 8);
}

function normalizeApiRoot(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }

  let path = parsed.pathname || "";
  if (path.endsWith("/management.html")) {
    path = `${path.slice(0, -"/management.html".length)}/v0/management`;
  }

  for (const suffix of ["/api-call", "/auth-files"]) {
    if (path.endsWith(suffix)) {
      path = path.slice(0, -suffix.length);
    }
  }

  parsed.pathname = path.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function toInt(input, defaultValue, minimum) {
  const n = Number.parseInt(String(input ?? defaultValue), 10);
  return Number.isFinite(n) ? Math.max(minimum, n) : Math.max(minimum, defaultValue);
}

function toBool(input, defaultValue) {
  if (typeof input === "boolean") return input;
  const text = String(input ?? defaultValue).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return defaultValue;
}

export function webDefaults() {
  return {
    management_url: process.env.CPA_MANAGEMENT_URL || "http://127.0.0.1:8317/management.html",
    management_token: process.env.CPA_MANAGEMENT_TOKEN || "management_token",
    management_timeout: toInt(process.env.MANAGEMENT_TIMEOUT_SECONDS, 15, 1),
    active_probe: toBool(process.env.ACTIVE_PROBE, true),
    probe_timeout: toInt(process.env.PROBE_TIMEOUT_SECONDS, 8, 1),
    probe_workers: toInt(process.env.PROBE_WORKERS, 12, 1),
    delete_workers: toInt(process.env.DELETE_WORKERS, 8, 1),
    max_active_probes: toInt(process.env.MAX_ACTIVE_PROBES, 120, 0),
  };
}

function configFromPayload(payload) {
  const defaults = webDefaults();
  return {
    management_url: normalizeApiRoot(payload.management_url ?? defaults.management_url),
    management_token: String((payload.management_token ?? defaults.management_token) || "").trim(),
    management_timeout: toInt(payload.management_timeout, defaults.management_timeout, 1),
    active_probe: toBool(payload.active_probe, defaults.active_probe),
    probe_timeout: toInt(payload.probe_timeout, defaults.probe_timeout, 1),
    probe_workers: toInt(payload.probe_workers, defaults.probe_workers, 1),
    delete_workers: toInt(payload.delete_workers, defaults.delete_workers, 1),
    max_active_probes: toInt(payload.max_active_probes, defaults.max_active_probes, 0),
  };
}

function validateConfig(config) {
  if (!config.management_url) throw new Error("management_url 不能为空");
  if (!config.management_token) throw new Error("management_token 不能为空");
  if (!/^https?:\/\//.test(config.management_url)) {
    throw new Error("management_url 必须以 http:// 或 https:// 开头");
  }
}

async function requestJson(url, init = {}) {
  const resp = await fetch(url, init);
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { resp, text, data };
}

function reasonFromStatus(fileObj) {
  const message = String(fileObj?.status_message || "");
  if (!message) return "";

  const lower = message.toLowerCase();
  for (const keyword of MESSAGE_KEYWORDS) {
    if (lower.includes(keyword)) return keyword;
  }

  try {
    const parsed = JSON.parse(message);
    if (Number(parsed?.status || 0) === 401) return "status_401";
    const code = String(parsed?.error?.code || "");
    if (STATUS_KEYWORDS.has(code)) return code;
  } catch {
    return "";
  }
  return "";
}

function looks401(fileObj) {
  if (Number(fileObj?.status || 0) === 401) return true;
  const text = String(fileObj?.status_message || "").toLowerCase();
  return text.includes("401") || text.includes("unauthorized");
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  }

  const size = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: size }, () => runner()));
  return results;
}

async function listAuthFiles(config) {
  const endpoint = `${config.management_url}/auth-files`;
  const { resp, data } = await requestJson(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.management_token}` },
    signal: AbortSignal.timeout(config.management_timeout * 1000),
  });

  if (resp.status === 404) {
    throw new Error(`auth-files 接口不存在: ${endpoint} (HTTP 404). 请确认 management_url 为管理 API 根路径`);
  }

  if (!resp.ok) {
    throw new Error(`读取 auth-files 失败: HTTP ${resp.status}`);
  }

  return Array.isArray(data?.files) ? data.files : [];
}

async function deleteAuthFile(config, name) {
  const endpoint = `${config.management_url}/auth-files?name=${encodeURIComponent(name)}`;
  const { resp, text, data } = await requestJson(endpoint, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.management_token}` },
    signal: AbortSignal.timeout(config.management_timeout * 1000),
  });

  if (resp.ok) return { ok: true, error: "" };
  const detail = data ? JSON.stringify(data) : text;
  return { ok: false, error: `HTTP ${resp.status}: ${detail}` };
}

async function probeAuthIndex(config, authIndex) {
  const endpoint = `${config.management_url}/api-call`;
  const payload = {
    auth_index: authIndex,
    method: "POST",
    url: PROBE_TARGET_URL,
    header: {
      Authorization: "Bearer $TOKEN$",
      "Content-Type": "application/json",
      "User-Agent": "codex_cli_rs/0.101.0",
    },
    data: JSON.stringify({
      model: PROBE_MODEL,
      input: [{ role: "user", content: "ping" }],
    }),
  };

  const { resp, data } = await requestJson(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.management_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.probe_timeout * 1000),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return {
    status_code: Number(data?.status_code || 0),
    body: String(data?.body || ""),
  };
}

export async function executeCleanup(payload, addLog = () => {}) {
  const config = configFromPayload(payload || {});
  validateConfig(config);

  const log = (msg) => addLog(`[${now()}] ${msg}`);
  log("开始清理");
  log(`配置: active_probe=${config.active_probe}, probe_workers=${config.probe_workers}, delete_workers=${config.delete_workers}, max_active_probes=${config.max_active_probes}`);

  const files = await listAuthFiles(config);
  log(`拉取 auth-files 成功，总数: ${files.length}`);

  const fixedHits = [];
  let probeCandidates = [];

  for (const fileObj of files) {
    const name = String(fileObj?.name || "");
    if (!name) continue;

    const reason = reasonFromStatus(fileObj);
    if (reason) {
      fixedHits.push({ name, keyword: reason, status_message: String(fileObj?.status_message || "") });
      continue;
    }

    const provider = String(fileObj?.provider || "").trim().toLowerCase();
    const authIndex = String(fileObj?.auth_index || "").trim();
    if (config.active_probe && provider === "codex" && authIndex) {
      probeCandidates.push(fileObj);
    }
  }

  if (config.active_probe && config.max_active_probes > 0 && probeCandidates.length > config.max_active_probes) {
    log(`主动探测候选 ${probeCandidates.length}，仅探测前 ${config.max_active_probes} 个`);
    probeCandidates = probeCandidates.slice(0, config.max_active_probes);
  }

  const probedHits = [];
  if (config.active_probe && config.max_active_probes !== 0 && probeCandidates.length > 0) {
    log(`开始主动探测，候选 ${probeCandidates.length} 个`);
    let done = 0;
    const total = probeCandidates.length;

    await runPool(probeCandidates, config.probe_workers, async (fileObj) => {
      const name = String(fileObj?.name || "");
      const authIndex = String(fileObj?.auth_index || "").trim();
      if (!authIndex) {
        done += 1;
        return;
      }

      try {
        const { status_code, body } = await probeAuthIndex(config, authIndex);
        const bodyLower = body.toLowerCase();
        let reason = "";
        if (status_code === 401) reason = "probe_status_401";
        else if (bodyLower.includes("401") || bodyLower.includes("unauthorized")) reason = "probe_body_401";
        else {
          for (const keyword of MESSAGE_KEYWORDS) {
            if (bodyLower.includes(keyword)) {
              reason = `probe_${keyword}`;
              break;
            }
          }
        }

        if (reason) {
          probedHits.push({ name, keyword: reason, status_message: String(fileObj?.status_message || "") });
          log(`探测命中: ${name} -> ${reason}`);
        }
      } catch (err) {
        log(`探测异常: ${name} -> ${String(err)}`);
      } finally {
        done += 1;
        if (done % 20 === 0 || done === total) {
          log(`探测进度: ${done}/${total}`);
        }
      }
    });
  } else {
    log("主动探测已关闭或无候选");
  }

  const mergedMap = new Map();
  for (const hit of [...fixedHits, ...probedHits]) {
    if (!mergedMap.has(hit.name)) mergedMap.set(hit.name, hit);
  }
  const matched = Array.from(mergedMap.values());
  log(`命中删除规则: ${matched.length}`);

  let deletedMain = 0;
  const failures = [];

  if (matched.length > 0) {
    let done = 0;
    const total = matched.length;

    await runPool(matched, config.delete_workers, async (hit) => {
      const { ok, error } = await deleteAuthFile(config, hit.name);
      done += 1;
      if (ok) {
        deletedMain += 1;
        log(`删除成功: ${hit.name} (${done}/${total})`);
      } else {
        failures.push({ name: hit.name, error });
        log(`删除失败: ${hit.name} -> ${error}`);
      }
    });
  } else {
    log("主流程无删除目标");
  }

  let deleted401 = 0;
  try {
    const files2 = await listAuthFiles(config);
    const excluded = new Set(matched.map((x) => x.name));
    const targets401 = files2
      .filter((f) => {
        const name = String(f?.name || "");
        return name && !excluded.has(name) && looks401(f);
      })
      .map((f) => ({
        name: String(f?.name || ""),
        keyword: "status_401",
        status_message: String(f?.status_message || ""),
      }));

    if (targets401.length === 0) {
      log("401补删: 无目标");
    } else {
      log(`401补删: 待删除 ${targets401.length} 个`);
      await runPool(targets401, config.delete_workers, async (hit) => {
        const { ok, error } = await deleteAuthFile(config, hit.name);
        if (ok) {
          deleted401 += 1;
          log(`删除成功: ${hit.name} (401补删)`);
        } else {
          failures.push({ name: hit.name, error });
          log(`删除失败: ${hit.name} -> ${error}`);
        }
      });
    }
  } catch (err) {
    const message = String(err);
    log(`401补删列表读取失败: ${message}`);
    failures.push({ name: "<list>", error: message });
  }

  const report = {
    scanned_total: files.length,
    matched_total: matched.length,
    deleted_main: deletedMain,
    deleted_401: deleted401,
    deleted_total: deletedMain + deleted401,
    failures,
    matched,
  };

  log(`完成: scanned=${report.scanned_total}, matched=${report.matched_total}, deleted_main=${report.deleted_main}, deleted_401=${report.deleted_401}, deleted_total=${report.deleted_total}`);
  if (report.failures.length > 0) {
    log(`失败数: ${report.failures.length}`);
  }

  return report;
}
