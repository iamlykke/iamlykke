// Builds assets/languages.svg from the byte counts of all public, non-fork repos.
// Run: node scripts/languages.mjs   (GITHUB_TOKEN is optional but avoids rate limits)
import { writeFile } from "node:fs/promises";

const USER = "iamlykke";
const TOP = 6;
const COLORS = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Astro: "#ff5d01",
  CSS: "#663399",
  SCSS: "#c6538c",
  HTML: "#e34c26",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  Other: "#8b949e",
};

const headers = { Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const repos = (await gh(`/users/${USER}/repos?per_page=100&type=owner`)).filter(
  (r) => !r.fork && !r.archived && r.name !== USER,
);

const totals = {};
for (const repo of repos) {
  for (const [lang, bytes] of Object.entries(await gh(`/repos/${USER}/${repo.name}/languages`))) {
    totals[lang] = (totals[lang] ?? 0) + bytes;
  }
}

const sum = Object.values(totals).reduce((a, b) => a + b, 0);
// Languages under 1% go to "Other" so the legend stays readable
const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
const main = sorted.slice(0, TOP).filter(([, bytes]) => bytes / sum >= 0.01);
const langs = main.map(([name, bytes]) => ({ name, share: bytes / sum }));
const rest = sum - main.reduce((a, [, b]) => a + b, 0);
if (rest > 0) langs.push({ name: "Other", share: rest / sum });

const W = 560;
const PAD = 28;
const BAR_W = W - PAD * 2;
const ROWS = Math.ceil(langs.length / 2);
const H = 120 + ROWS * 30;

let x = PAD;
const segments = langs
  .map(({ name, share }, i) => {
    const w = Math.max(share * BAR_W, 2);
    const seg = `<rect x="${x.toFixed(1)}" y="66" width="${w.toFixed(1)}" height="12" fill="${COLORS[name] ?? COLORS.Other}" class="grow" style="animation-delay:${i * 0.12}s"/>`;
    x += w;
    return seg;
  })
  .join("\n    ");

const legend = langs
  .map(({ name, share }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lx = PAD + col * (BAR_W / 2);
    const ly = 112 + row * 30;
    return `<g>
      <circle cx="${lx + 6}" cy="${ly - 5}" r="6" fill="${COLORS[name] ?? COLORS.Other}"/>
      <text x="${lx + 20}" y="${ly}" class="t">${name}</text>
      <text x="${lx + BAR_W / 2 - 16}" y="${ly}" class="m" text-anchor="end">${(share * 100).toFixed(1)}%</text>
    </g>`;
  })
  .join("\n    ");

const updated = new Date().toISOString().slice(0, 10);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Most used languages">
  <style>
    .card { fill: #ffffff; stroke: #d0d7de; }
    .h { font: 700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; fill: #1f2328; }
    .t { font: 500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; fill: #1f2328; }
    .m { font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; fill: #59636e; }
    @media (prefers-color-scheme: dark) {
      .card { fill: #0d1117; stroke: #30363d; }
      .h, .t { fill: #f0f6fc; }
      .m { fill: #9198a1; }
    }
    .grow { transform-box: fill-box; transform-origin: left; animation: grow .9s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes grow { from { transform: scaleX(0) } }
  </style>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" class="card"/>
  <text x="${PAD}" y="44" class="h">Most used languages</text>
  <text x="${W - PAD}" y="44" class="m" text-anchor="end">${repos.length} repos · ${updated}</text>
  <clipPath id="bar"><rect x="${PAD}" y="66" width="${BAR_W}" height="12" rx="6"/></clipPath>
  <g clip-path="url(#bar)">
    ${segments}
  </g>
    ${legend}
</svg>
`;

await writeFile(new URL("../assets/languages.svg", import.meta.url), svg);
console.log(langs.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(", "));
