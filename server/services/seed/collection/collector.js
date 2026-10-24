import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { discoverPages, parseProperty, propertyKey, normalize, sourceHosts } from "./parsers.js";
import { PublicClient, allowedUrl } from "./network.js";
export const starts = ["https://porterpakistan.com/hotels", "https://www.pchotels.com/hotel-and-resort", "https://www.sleepzon.com/en-pk-pakistan"];
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
async function runCollection({ directory, target = 1500, maxImages = 3, concurrency = 4, client = new PublicClient(), log = console.log, signal } = {}) {
  if (!directory || !Number.isInteger(target) || target < 1 || target > 5000 || !Number.isInteger(maxImages) || maxImages < 2 || maxImages > 5)
    throw new Error("Choose a directory, 1 to 5000 properties and 2 to 5 photos.");
  const cache = path.join(directory, "cache"); await fs.mkdir(cache, { recursive: true });
  const checkpoint = path.join(directory, "checkpoint.json");
  let state;
  try { state = JSON.parse(await fs.readFile(checkpoint, "utf8")); }
  catch (e) { if (e.code !== "ENOENT") throw e; state = { version: 1, pending: starts.map(url => ({ url, kind: "list" })), seen: [], properties: [], skipped: [], pages: 0 }; }
  const seen = new Set(state.seen), keys = new Set(state.properties.map(propertyKey));
  const names = new Set(state.properties.map(p => `${normalize(p.title)}|${normalize(p.city)}`));
  const photos = new Set(state.properties.flatMap(p => p.images.map(i => i.sha256)));
  const report = () => ({ target, collected: state.properties.length, remaining: Math.max(0, target-state.properties.length), pages: state.pages, skipped: state.skipped.length,
    sourceCounts: Object.fromEntries(sourceHosts.map(h => [h, state.properties.filter(p => new URL(p.sourceUrl).hostname === h).length])),
    status: state.properties.length >= target ? "ready" : signal?.aborted ? "paused" : state.pending.length ? "collecting" : "shortfall" });
  async function save() {
    state.seen = [...seen];
    await fs.writeFile(checkpoint + ".tmp", JSON.stringify(state)); await fs.rename(checkpoint + ".tmp", checkpoint);
    await fs.writeFile(path.join(directory, "report.json"), JSON.stringify(report(), null, 2));
    await fs.writeFile(path.join(directory, "catalog.json.tmp"), JSON.stringify({ version: "pakistan_collected_v1", target, report: report(), properties: state.properties.slice(0, target) }, null, 2));
    await fs.rename(path.join(directory, "catalog.json.tmp"), path.join(directory, "catalog.json"));
  }
  function enqueue(url, kind) {
    if (!allowedUrl(url) || seen.has(url) || state.pending.some(x => x.url === url)) return;
    if (state.pending.length + seen.size >= 15000) return;
    state.pending.push({ url, kind });
  }
  async function processPage(task) {
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000);
    const cacheFile = path.join(cache, sha(task.url) + ".html");
    let body;
    try { body = await fs.readFile(cacheFile, "utf8"); }
    catch (e) { if (e.code !== "ENOENT") throw e; body = (await client.request(task.url, { signal: deadline })).body.toString("utf8"); await fs.writeFile(cacheFile, body); }
    const links = discoverPages(body, task.url);
    if (task.kind === "list") {
      for (const u of links.details) enqueue(u, "detail");
      for (const u of links.lists) enqueue(u, "list");
      return;
    }
    const p = parseProperty(body, task.url);
    if (!p) throw new Error("Missing explicit property location or matching gallery.");
    const nameKey = `${normalize(p.title)}|${normalize(p.city)}`;
    if (keys.has(propertyKey(p)) || names.has(nameKey)) throw new Error("Duplicate property name and city.");
    const kept = [], local = new Set();
    for (const image of p.images.slice(0, 12)) {
      if (kept.length >= maxImages || deadline.aborted) break;
      try {
        const { body } = await client.request(image.url, { image: true, signal: deadline });
        const hash = sha(body);
        if (photos.has(hash) || local.has(hash)) continue;
        local.add(hash);
        kept.push({ ...image, sha256: hash,
          credit: { title: image.caption, author: "Photographer not identified by the source listing", sourceUrl: p.sourceUrl,
            license: "Source terms apply. No open license asserted.", licenseUrl: p.sourceUrl,
            changes: "External photo reference from this property's gallery. No image files redistributed." } });
      } catch { /* Try another actual gallery photograph; never insert a fallback. */ }
    }
    if (kept.length < 2) throw new Error("Fewer than two distinct accessible gallery photos.");
    p.images = kept; p.photoMatch = "source_property_gallery";
    if (state.properties.length >= target || keys.has(propertyKey(p)) || names.has(nameKey)) return;
    if (kept.some(i => photos.has(i.sha256))) throw new Error("Photos duplicate another property's gallery.");
    keys.add(propertyKey(p)); names.add(nameKey); kept.forEach(i => photos.add(i.sha256)); state.properties.push(p);
  }
  while (state.pending.length && state.properties.length < target && !signal?.aborted) {
    state.pending.sort((a, b) => Number(a.kind === "list") - Number(b.kind === "list"));
    const batch = state.pending.splice(0, concurrency);
    await Promise.all(batch.map(async task => {
      if (seen.has(task.url)) return;
      seen.add(task.url);
      try { await processPage(task); }
      catch (e) {
        if (signal?.aborted) { seen.delete(task.url); state.pending.unshift(task); }
        else if (/Could not read source robots/.test(e.message) && (task.attempts || 0) < 2) {
          seen.delete(task.url); state.pending.push({ ...task, attempts: (task.attempts || 0) + 1 });
        } else state.skipped.push({ url: task.url, reason: String(e.message).slice(0, 250) });
      }
      state.pages++;
    }));
    await save();
    log(JSON.stringify(report()));
  }
  await save(); return { ...report(), catalogPath: path.join(directory, "catalog.json") };
}

export async function collect(options) {
  await fs.mkdir(options.directory, { recursive: true });
  const lock = path.join(options.directory, "collector.lock");
  let handle;
  try { handle = await fs.open(lock, "wx"); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    const previous = JSON.parse(await fs.readFile(lock, "utf8"));
    let running = true;
    try { process.kill(previous.pid, 0); } catch (e) { if (e.code === "ESRCH") running = false; }
    if (running) throw new Error("Collection is already running. Follow report.json or stop that process first.");
    await fs.unlink(lock); handle = await fs.open(lock, "wx");
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid })); return await runCollection(options); }
  finally { await handle.close(); await fs.unlink(lock); }
}
