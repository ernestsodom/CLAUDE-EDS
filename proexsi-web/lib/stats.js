// Métricas del sitio para el panel de gestión.
import { hasDb, sql, ensureSchema, mem } from './db.js';

const TZ = 'America/Santiago';

export async function getStats(days = 30) {
  days = Math.min(Math.max(Number(days) || 30, 1), 365);
  if (hasDb()) return dbStats(days);
  return memStats(days);
}

async function dbStats(days) {
  await ensureSchema();
  const q = sql();
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const prev = new Date(Date.now() - 2 * days * 864e5).toISOString();
  const [kpi, kpiPrev, daily, sources, refs, pages, sections, devices, browsers, countries, cities, clicks, hours, leads, leadsPrev, leadsDaily] = await Promise.all([
    q`select count(*) filter (where type='pageview')::int as pageviews, count(distinct visitor)::int as visitors,
             count(distinct session)::int as sessions, count(*) filter (where type='click')::int as clicks
      from events where ts >= ${since}`,
    q`select count(*) filter (where type='pageview')::int as pageviews, count(distinct visitor)::int as visitors,
             count(distinct session)::int as sessions from events where ts >= ${prev} and ts < ${since}`,
    q`select to_char(date_trunc('day', ts at time zone ${TZ}), 'YYYY-MM-DD') as d,
             count(*) filter (where type='pageview')::int as pageviews, count(distinct visitor)::int as visitors
      from events where ts >= ${since} group by 1 order by 1`,
    q`select coalesce(source,'Directo') as k, count(distinct session)::int as v from events
      where ts >= ${since} and type='pageview' group by 1 order by 2 desc`,
    q`select referrer as k, count(distinct session)::int as v from events
      where ts >= ${since} and type='pageview' and referrer is not null and referrer <> '' group by 1 order by 2 desc limit 10`,
    q`select path as k, count(*)::int as v, count(distinct visitor)::int as u from events
      where ts >= ${since} and type='pageview' group by 1 order by 2 desc limit 15`,
    q`select section as k, count(distinct session)::int as v from events
      where ts >= ${since} and type='section' group by 1 order by 2 desc`,
    q`select coalesce(device,'Otro') as k, count(distinct visitor)::int as v from events where ts >= ${since} group by 1 order by 2 desc`,
    q`select coalesce(browser,'Otro') as k, count(distinct visitor)::int as v from events where ts >= ${since} group by 1 order by 2 desc`,
    q`select coalesce(country,'Desconocido') as k, count(distinct visitor)::int as v from events where ts >= ${since} group by 1 order by 2 desc limit 10`,
    q`select coalesce(city,'Desconocida') as k, count(distinct visitor)::int as v from events where ts >= ${since} group by 1 order by 2 desc limit 10`,
    q`select label as k, count(*)::int as v from events where ts >= ${since} and type='click' and label <> '' group by 1 order by 2 desc limit 12`,
    q`select extract(hour from ts at time zone ${TZ})::int as k, count(*)::int as v from events
      where ts >= ${since} and type='pageview' group by 1 order by 1`,
    q`select count(*)::int as n from leads where ts >= ${since}`,
    q`select count(*)::int as n from leads where ts >= ${prev} and ts < ${since}`,
    q`select to_char(date_trunc('day', ts at time zone ${TZ}), 'YYYY-MM-DD') as d, count(*)::int as n from leads where ts >= ${since} group by 1 order by 1`,
  ]);
  return build(days, kpi[0], kpiPrev[0], daily, sources, refs, pages, sections, devices, browsers, countries, cities, clicks, hours, leads[0].n, leadsPrev[0].n, leadsDaily);
}

function memStats(days) {
  const since = Date.now() - days * 864e5, prevT = Date.now() - 2 * days * 864e5;
  const ev = mem.events.filter(e => +new Date(e.ts) >= since);
  const evPrev = mem.events.filter(e => +new Date(e.ts) >= prevT && +new Date(e.ts) < since);
  const uniq = (arr, f) => new Set(arr.map(f)).size;
  const group = (arr, key, val = () => 1, distinct) => {
    const m = new Map();
    for (const e of arr) { const k = key(e); if (k == null || k === '') continue; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(distinct ? distinct(e) : Math.random()); }
    return [...m].map(([k, s]) => ({ k, v: s.size })).sort((a, b) => b.v - a.v);
  };
  const day = e => new Date(e.ts).toLocaleDateString('sv-SE', { timeZone: TZ });
  const pv = ev.filter(e => e.type === 'pageview');
  const kpi = { pageviews: pv.length, visitors: uniq(ev, e => e.visitor), sessions: uniq(ev, e => e.session), clicks: ev.filter(e => e.type === 'click').length };
  const kpiPrev = { pageviews: evPrev.filter(e => e.type === 'pageview').length, visitors: uniq(evPrev, e => e.visitor), sessions: uniq(evPrev, e => e.session) };
  const daily = [...new Set(ev.map(day))].sort().map(d => ({ d, pageviews: pv.filter(e => day(e) === d).length, visitors: uniq(ev.filter(e => day(e) === d), e => e.visitor) }));
  const pages = group(pv, e => e.path).map(r => ({ ...r, v: pv.filter(e => e.path === r.k).length, u: uniq(pv.filter(e => e.path === r.k), e => e.visitor) }));
  const hours = group(pv, e => Number(new Date(e.ts).toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false })) % 24).map(r => ({ k: r.k, v: pv.filter(e => (Number(new Date(e.ts).toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false })) % 24) === r.k).length }));
  const lds = mem.leads.filter(l => +new Date(l.ts) >= since);
  return build(days, kpi, kpiPrev, daily,
    group(pv, e => e.source || 'Directo', 0, e => e.session),
    group(pv, e => e.referrer, 0, e => e.session).slice(0, 10),
    pages.slice(0, 15),
    group(ev.filter(e => e.type === 'section'), e => e.section, 0, e => e.session),
    group(ev, e => e.device || 'Otro', 0, e => e.visitor),
    group(ev, e => e.browser || 'Otro', 0, e => e.visitor),
    group(ev, e => e.country || 'Desconocido', 0, e => e.visitor).slice(0, 10),
    group(ev, e => e.city || 'Desconocida', 0, e => e.visitor).slice(0, 10),
    group(ev.filter(e => e.type === 'click'), e => e.label).map(r => ({ k: r.k, v: ev.filter(e => e.type === 'click' && e.label === r.k).length })).slice(0, 12),
    hours, lds.length, mem.leads.filter(l => +new Date(l.ts) >= prevT && +new Date(l.ts) < since).length,
    [...new Set(lds.map(day))].sort().map(d => ({ d, n: lds.filter(l => day(l) === d).length })));
}

function build(days, kpi, kpiPrev, daily, sources, refs, pages, sections, devices, browsers, countries, cities, clicks, hours, leads, leadsPrev, leadsDaily) {
  // Serie diaria completa (días sin visitas en 0)
  const byDay = new Map(daily.map(r => [r.d, r]));
  const byLead = new Map(leadsDaily.map(r => [r.d, r.n]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toLocaleDateString('sv-SE', { timeZone: TZ });
    series.push({ d, pageviews: byDay.get(d)?.pageviews || 0, visitors: byDay.get(d)?.visitors || 0, leads: byLead.get(d) || 0 });
  }
  const h = Array.from({ length: 24 }, (_, i) => hours.find(r => Number(r.k) === i)?.v || 0);
  return {
    days,
    kpi: { ...kpi, leads, pagesPerSession: kpi.sessions ? +(kpi.pageviews / kpi.sessions).toFixed(2) : 0, conversion: kpi.sessions ? +(100 * leads / kpi.sessions).toFixed(2) : 0 },
    prev: { ...kpiPrev, leads: leadsPrev },
    series, sources, referrers: refs, pages, sections, devices, browsers, countries, cities, clicks, hours: h,
  };
}
