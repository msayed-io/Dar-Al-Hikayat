import React from 'react';

/** Google's provider-supplied search attribution stays inside a scriptless, isolated frame. */
export function GroundedSearchSuggestions({ html }: { html: string }) {
  if (!html || html.length > 50_000) return null;
  const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src https://www.gstatic.com data:; base-uri 'none'; form-action 'none'";
  return <iframe title="اقتراحات بحث Google ومصادره" sandbox="allow-popups allow-popups-to-escape-sandbox"
    referrerPolicy="no-referrer" style={{ width: '100%', height: 120, border: 0, marginTop: 8 }}
    srcDoc={`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body>${html}</body></html>`} />;
}
