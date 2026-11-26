const clean = s => String(s || "").replace(/\s+/g, " ").trim();
export const normalize = (s) => clean(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const propertyKey = (p) => `${normalize(p.title)}|${normalize(p.city)}|${normalize(p.address).replace(/\b(pakistan|pk|\d{5})\b/g, "").trim()}`;
