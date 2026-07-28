# Post-Deploy SEO Checklist

Run these steps in Google Search Console after every deploy that changes public metadata, content, or URLs on https://rgarciade.github.io/airecorder/.

1. **Inspect the homepage URL** — Search Console → URL Inspection → `https://rgarciade.github.io/airecorder/` → confirm the live page matches what's indexed (title, description, canonical).
2. **Submit/verify the sitemap** — Search Console → Sitemaps → confirm `sitemap.xml` is submitted and its "Discovered URLs" count matches expectations.
3. **Request indexing** — for the homepage and any newly changed URLs, use "Request Indexing" from the URL Inspection tool.
4. **Monitor queries and impressions** — Search Console → Performance, check weekly for the two weeks following deploy for changes in impressions/clicks on branded and intent queries (e.g. "local AI meeting recorder", "private meeting transcription").

This is a manual, human-run checklist — it is not automated by CI.
