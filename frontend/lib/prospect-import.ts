export type ProspectImport = { domains: string[]; rejected: number };

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ',') { row.push(cell); cell = ""; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Invalid CSV: an unfinished quoted field was found.");
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function businessDomain(value: string): string | null {
  try {
    const input = value.trim();
    if (!input || /\s/.test(input)) return null;
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (host.length > 253 || !host.includes('.') || /^[0-9.]+$/.test(host) || host.includes(':') ||
        /\.(localhost|local|internal|test|invalid)$/.test(host) ||
        !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
    return host;
  } catch { return null; }
}

/** Client-side convenience only. Backend URL/DNS security and plan limits remain authoritative. */
export function parseProspectImport(text: string): ProspectImport {
  if (new TextEncoder().encode(text).length > 100_000) throw new Error("Keep imports under 100 KB.");
  const clean = text.replace(/^\ufeff/, '').trim();
  if (!clean) return { domains: [], rejected: 0 };
  const rows = csvRows(clean);
  const headers = rows[0].map(v => v.trim().toLowerCase().replace(/[ _-]/g, ''));
  const column = headers.findIndex(v => ['website', 'domain', 'url', 'companywebsite', 'companydomain'].includes(v));
  let candidates: string[];
  if (column >= 0) candidates = rows.slice(1).map(row => row[column] || '');
  else if (headers.some(v => ['company', 'companyname', 'email', 'name'].includes(v)))
    throw new Error("Add a Website or Domain column to your CSV. Contact emails are not company domains.");
  else candidates = rows.flatMap(row => row.flatMap(cell => cell.trim().split(/\s+/)));
  const domains = new Set<string>(); let rejected = 0;
  for (const value of candidates) {
    if (!value.trim()) continue;
    const domain = businessDomain(value);
    if (domain) domains.add(domain); else rejected++;
  }
  if (domains.size > 10) throw new Error("Import up to 10 unique company websites per campaign. Your plan may have a lower limit.");
  return { domains: [...domains], rejected };
}
