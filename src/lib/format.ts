const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");

/** Webcast-style mission clock: T-00:00:09 / T+00:02:41 / T+3d 04:12:09. */
export function formatMet(met: number) {
  const sign = met < 0 ? "T−" : "T+";
  let s = Math.abs(met);
  if (met < 0) s = Math.ceil(s);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${sign}${d}d ${hms}` : `${sign}${hms}`;
}

export function splitMet(met: number) {
  const full = formatMet(met);
  return { sign: full.slice(0, 2), rest: full.slice(2) };
}

export function formatInt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

export function formatKm(km: number) {
  if (km >= 1e7) return `${(km / 1e6).toFixed(1)}M`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)}M`;
  if (km >= 1e4) return formatInt(km);
  if (km >= 100) return km.toFixed(0);
  return km.toFixed(1);
}

export function formatLightTime(s: number) {
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  if (s < 60) return `${s.toFixed(2)} s`;
  return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
}

export function formatPct(f: number) {
  return `${(f * 100).toFixed(1)}%`;
}
