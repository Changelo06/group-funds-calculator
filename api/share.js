const escapeHtml = value => String(value || "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[character]));

module.exports = (request, response) => {
  const requestUrl = new URL(request.url, "http://localhost"), fundId = requestUrl.searchParams.get("fund") || "", fundTitle = (requestUrl.searchParams.get("title") || "Shared split fund").slice(0, 100), creator = (requestUrl.searchParams.get("creator") || "RM331 member").slice(0, 60), date = (requestUrl.searchParams.get("date") || "").slice(0, 40), title = [fundTitle, creator, date].filter(Boolean).join(" · "), description = `Split fund created by ${creator}${date ? ` on ${date}` : ""}.`;
  const appUrl = new URL("/", requestUrl); appUrl.searchParams.set("fund", fundId); appUrl.hash = "funds";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl.toString())}"></head><body><p>Opening <a href="${escapeHtml(appUrl.toString())}">${escapeHtml(title)}</a>…</p></body></html>`;
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(html);
};
