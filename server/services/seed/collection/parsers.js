import { load } from "cheerio";
import crypto from "node:crypto";
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
import { normalize, propertyKey } from "./identity.js";
export { normalize, propertyKey };
export const sourceHosts = ["www.sleepzon.com", "porterpakistan.com", "www.pchotels.com"];
export function absolute(value, base) {
  try { const u = new URL(value, base); return u.protocol === "https:" && !u.username && !u.password && !u.port ? u.href.split("#")[0] : null; } catch { return null; }
}
export function linkedData($) {
  const result = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    result.push(node);
    Object.values(node).forEach(visit);
  };
  $('script[type="application/ld+json"]').each((_, e) => {
    try { visit(JSON.parse($(e).text())); } catch { /* A malformed block must not hide valid blocks. */ }
  });
  return result;
}
export function discoverPages(body, url) {
  const $ = load(body), host = new URL(url).hostname;
  const links = [...new Set($("a[href]").map((_, e) => absolute($(e).attr("href"), url)).get().filter(Boolean))];
  if (host === "www.sleepzon.com") return {
    details: links.filter(u => new URL(u).hostname === host && /\/[a-z0-9-]+-\d+-en$/.test(new URL(u).pathname) && !/hotels-pk-/.test(u)),
    lists: links.filter(u => new URL(u).hostname === host && /\/[a-z0-9-]+-hotels-pk-[-\d]+(?:-\d+)?-en$/.test(new URL(u).pathname)),
  };
  if (host === "porterpakistan.com") return {
    details: links.filter(u => /^https:\/\/porterpakistan\.com\/hotel\/[^/?#]+$/.test(u)),
    lists: links.filter(u => /^https:\/\/porterpakistan\.com\/hotels(?:\?page=\d+)?$/.test(u)),
  };
  if (host === "www.pchotels.com") return {
    details: links.filter(u => /^https:\/\/www\.pchotels\.com\/hotel-and-resort\/[^/?#]+$/.test(u)), lists: [],
  };
  return { details: [], lists: [] };
}
function result(url, title, city, address, images, geo) {
  title = clean(title); city = clean(city); address = clean(address);
  if (title.length < 3 || title.length > 300 || !city || city.length >= 80 || !address || address.length > 1000) return null;
  const urls = [...new Set(images.map(i => absolute(i, url)).filter(Boolean))];
  if (urls.length < 2) return null;
  return { id: `pk_${crypto.createHash("sha256").update(url).digest("hex").slice(0, 20)}`,
    title, city, address, sourceUrl: url, country: "Pakistan", geo,
    description: address === city
      ? `Accommodation listed in ${city}, Pakistan. The source listing does not publish a precise street address. Photographs are referenced from its gallery.`
      : `Accommodation listed at ${address}, ${city}, Pakistan. Property details and photographs are referenced from the linked listing.`,
    images: urls.map((image, index) => ({ url: image, caption: `${title}: source gallery photo ${index + 1}` })),
    checkedAt: new Date().toISOString().slice(0, 10),
  };
}
export function parseProperty(body, url) {
  const $ = load(body), host = new URL(url).hostname;
  if (host === "www.sleepzon.com") {
    const hotel = linkedData($).find(x => ["Hotel", "LodgingBusiness", "Apartment", "VacationRental", "GuestHouse", "Hostel", "Resort"].includes(x["@type"]) && x.address);
    if (!hotel) return null;
    const a = hotel.address, country = typeof a.addressCountry === "object" ? a.addressCountry.name : a.addressCountry;
    if (!["PK", "Pakistan"].includes(country)) return null;
    const images = $('img[alt]').toArray().filter(e => {
      const alt = clean($(e).attr("alt")).toLowerCase(), name = clean(hotel.name).toLowerCase();
      return alt === name || alt.startsWith(`${name},`) || alt.startsWith(`${name} (`);
    })
      .map(e => $(e).attr("src") || $(e).attr("data-src")).filter(u => /https:\/\/[^/]*bstatic\.com\/xdata\/images\/hotel\//.test(u || ""));
    // The same picture is often listed at several sizes. Use its image ID.
    const seen = new Set();
    const unique = images.filter(u => { const id = u.match(/\/(\d+)\.(?:jpg|png|webp)/)?.[1] || u; if (seen.has(id)) return false; seen.add(id); return true; });
    return result(url, hotel.name, a.addressLocality, a.streetAddress, unique, hotel.geo);
  }
  if (host === "porterpakistan.com") {
    const title = clean($("h1").first().text()) || clean($("title").text()).replace(/\s*[|\-]\s*Porter Pakistan.*$/i, "");
    // Require an explicit location on the page, rather than inferring one from a name.
    const city = clean($('[itemprop="addressLocality"]').first().text()) || clean($("h5").filter((_, e) => $(e).find(".loc2").length).first().text());
    const address = clean($('[itemprop="streetAddress"]').first().text()) || clean($(".hotel-address, .service-address").first().text()) || city;
    const gallery = $('a[data-lightbox=brand-slider] img').toArray().map(e => $(e).attr("data-src") || $(e).attr("src"));
    return result(url, title, city, address, gallery, undefined);
  }
  if (host === "www.pchotels.com") {
    const title = clean($("h1").first().text());
    const hotel = linkedData($).find(x => x.address && ["Hotel", "LodgingBusiness"].includes(x["@type"]));
    if (!hotel) return null;
    const a = hotel.address;
    const country = typeof a.addressCountry === "object" ? a.addressCountry.name : a.addressCountry;
    if (!["PK", "Pakistan"].includes(country)) return null;
    return result(url, hotel.name || title, a.addressLocality, a.streetAddress,
      $("img.custom-carousel-img").toArray().filter(e => normalize($(e).attr("alt")).startsWith(normalize(hotel.name))).map(e => $(e).attr("src")), hotel.geo);
  }
  return null;
}
