import axios from "axios";
import { setTimeout as delay } from "node:timers/promises";
import { sourceHosts } from "./parsers.js";
const agent = "IARS-FYP-Collector/1.0";
export const allowedImageHost = (host) => host.endsWith(".bstatic.com") || ["porterpakistan.com", "www.pchotels.com"].includes(host);
export function allowedUrl(value, image = false) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.port && (image ? allowedImageHost(u.hostname) : sourceHosts.includes(u.hostname)); } catch { return false; }
}
// Select this collector's own group when present, otherwise the wildcard group.
export function robotsAllowed(text, pathname) {
  const groups = []; let group = { agents: [], rules: [] };
  for (const raw of text.split(/\r?\n/)) {
    const match = /^([^:]+):\s*(.*)$/.exec(raw.split("#")[0].trim());
    if (!match) continue;
    const field = match[1].toLowerCase(), value = match[2].trim();
    if (field === "user-agent") {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if (["allow", "disallow"].includes(field)) group.rules.push({ field, value });
  }
  groups.push(group);
  const own = groups.filter(g => g.agents.some(a => a !== "*" && agent.toLowerCase().startsWith(a)));
  const selected = own.length ? own : groups.filter(g => g.agents.includes("*"));
  const rules = [];
  for (const { field, value } of selected.flatMap(g => g.rules)) {
    if (!value) continue;
    const pattern = value.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    if (new RegExp(`^${pattern}`).test(pathname)) rules.push({ length: value.replace(/\*/g, "").length, allow: field === "allow" });
  }
  rules.sort((a, b) => b.length - a.length || Number(b.allow) - Number(a.allow));
  return !rules.length || rules[0].allow;
}
export class PublicClient {
  constructor({ intervalMs = 1000, fetcher = axios.get } = {}) {
    this.intervalMs = intervalMs; this.fetcher = fetcher;
    this.next = new Map(); this.robots = new Map(); this.blocked = new Set();
  }
  async request(url, { image = false, robots = false, signal } = {}) {
    signal?.throwIfAborted();
    if (!allowedUrl(url, image)) throw new Error("URL is outside the configured public sources.");
    const u = new URL(url);
    if (this.blocked.has(u.hostname)) throw new Error("Source stopped after an access restriction.");
    if (!image && !robots) {
      if (!this.robots.has(u.origin)) this.robots.set(u.origin, this.request(`${u.origin}/robots.txt`, { robots: true }).then(r => r.body.toString()).catch(() => null));
      const text = await this.robots.get(u.origin);
      if (text === null) { this.robots.delete(u.origin); throw new Error("Could not read source robots rules. Retry later."); }
      if (!robotsAllowed(text, u.pathname + u.search)) throw new Error("Robots rules do not allow this page.");
    }
    const wait = Math.max(0, (this.next.get(u.hostname) || 0) - Date.now());
    this.next.set(u.hostname, Date.now() + wait + (image ? 100 : this.intervalMs));
    if (wait) await delay(wait, undefined, { signal });
    const attempts = image ? 1 : 3;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const r = await this.fetcher(url, { responseType: "arraybuffer", timeout: image ? 8000 : 20000, maxRedirects: 0, signal,
          maxContentLength: image ? 2_000_000 : 4_000_000,
          headers: { "User-Agent": agent, Accept: image ? "image/*" : "text/html,text/plain" }, validateStatus: () => true });
        if ([301, 302, 303, 307, 308].includes(r.status)) throw new Error("Redirect skipped. Use a canonical configured source URL.");
        if ([401, 403].includes(r.status)) { if (!image) this.blocked.add(u.hostname); throw new Error(`Source access restriction (${r.status}).`); }
        if (r.status === 429 || r.status >= 500) { if (attempt < attempts - 1) { const retry = r.headers["retry-after"];
          const retryMs = /^\d+$/.test(String(retry || "")) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry || "") - Date.now()) || 10000 * 2 ** attempt;
          const resume = Date.now() + Math.max(1000, retryMs);
          this.next.set(u.hostname, Math.max(this.next.get(u.hostname) || 0, resume));
          await delay(Math.max(1000, retryMs), undefined, { signal }); continue; } }
        if (robots && r.status === 404) return { body: Buffer.from(""), type: "text/plain" };
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
        const body = Buffer.from(r.data), type = r.headers["content-type"] || "";
        const photoMagic = body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
          body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          (body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP");
        if (image && (!type.startsWith("image/") || body.length < 2000 || !photoMagic)) throw new Error("Not a usable property photograph.");
        return { body, type };
      } catch (error) { if (signal?.aborted || attempt === attempts - 1 || error.response || /restriction|Redirect|HTTP|photograph/.test(error.message)) throw error; await delay(500 * 2 ** attempt, undefined, { signal }); }
    }
  }
}
