const sitemapUrl = process.argv[2] || "https://talus.social/sitemap.xml";
const concurrency = Math.max(1, Number(process.env.SITEMAP_CHECK_CONCURRENCY || 20));

const sitemapResponse = await fetch(sitemapUrl, { redirect: "follow" });
if (!sitemapResponse.ok) {
  throw new Error(`Sitemap returned ${sitemapResponse.status}: ${sitemapUrl}`);
}

const xml = await sitemapResponse.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => (
  match[1]
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
));
if (urls.length === 0) throw new Error(`No URLs found in ${sitemapUrl}`);

const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < urls.length) {
    const index = cursor;
    cursor += 1;
    const url = urls[index];
    try {
      const response = await fetch(url, { redirect: "follow" });
      await response.body?.cancel();
      if (response.status !== 200) failures.push({ url, status: response.status });
    } catch (error) {
      failures.push({ url, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));

if (failures.length > 0) {
  console.error(JSON.stringify({ checked: urls.length, failures: failures.slice(0, 50) }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Sitemap check passed: ${urls.length} URLs returned HTTP 200.`);
}
