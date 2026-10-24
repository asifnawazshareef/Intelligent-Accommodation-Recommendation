import { readFileSync } from "node:fs";

// Versioned, bundled data. Generation never depends on a live image/search API.
const catalog = JSON.parse(readFileSync(
  new URL("../../public/seed/pakistan/v1/catalog.json", import.meta.url), "utf8",
));
export const pakistanCatalog = catalog.properties;
export const pakistanCatalogCities = [...new Set(pakistanCatalog.map(p => p.city))];
export const catalogProperties = (selectedCities) =>
  pakistanCatalog.filter(p => selectedCities.includes(p.city));
