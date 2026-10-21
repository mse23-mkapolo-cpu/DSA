// graph.js - Malawi road network data, algorithms and map drawing.
// Shared by the web demo (index.html) and the PDF report.
// Mirrors src/graph.hpp and data/malawi_roads.csv.

// Schematic town positions [x, y] (north at the top, roughly geographic but
// spread out so every road and distance is readable) and the label side.
const TOWNS = {
  "Chitipa":    [150,   50, "w"],
  "Karonga":    [400,   60, "w"],
  "Rumphi":     [300,  170, "e"],
  "Mzuzu":      [300,  270, "w"],
  "Nkhata Bay": [410,  300, "w"],
  "Mzimba":     [150,  340, "w"],
  "Kasungu":    [110,  480, "w"],
  "Nkhotakota": [410,  470, "e"],
  "Ntchisi":    [250,  530, "n"],
  "Dowa":       [250,  610, "w"],
  "Salima":     [430,  630, "e"],
  "Lilongwe":   [150,  670, "w"],
  "Mchinji":    [40,   720, "s"],
  "Dedza":      [300,  750, "w"],
  "Ntcheu":     [300,  850, "w"],
  "Mangochi":   [600,  775, "e"],
  "Balaka":     [440,  880, "s"],
  "Liwonde":    [570,  880, "e"],
  "Zomba":      [610,  970, "e"],
  "Blantyre":   [440, 1010, "w"],
  "Mwanza":     [200,  990, "w"],
  "Chikwawa":   [280, 1100, "w"],
  "Thyolo":     [460, 1120, "s"],
  "Mulanje":    [630, 1090, "e"],
  "Nsanje":     [380, 1220, "e"],
};

const ROADS_CSV = `Chitipa,Karonga,100
Chitipa,Rumphi,230
Karonga,Rumphi,165
Rumphi,Mzuzu,67
Mzuzu,Nkhata Bay,47
Mzuzu,Mzimba,110
Mzimba,Kasungu,140
Nkhata Bay,Nkhotakota,230
Kasungu,Nkhotakota,120
Kasungu,Ntchisi,90
Kasungu,Lilongwe,127
Kasungu,Mchinji,140
Nkhotakota,Ntchisi,70
Nkhotakota,Salima,110
Ntchisi,Dowa,50
Dowa,Lilongwe,55
Dowa,Salima,85
Lilongwe,Salima,103
Lilongwe,Mchinji,110
Lilongwe,Dedza,85
Dedza,Salima,125
Dedza,Ntcheu,75
Salima,Mangochi,190
Ntcheu,Balaka,60
Ntcheu,Blantyre,160
Balaka,Liwonde,30
Balaka,Blantyre,110
Liwonde,Mangochi,70
Liwonde,Zomba,55
Zomba,Blantyre,65
Zomba,Mulanje,100
Blantyre,Mwanza,95
Blantyre,Thyolo,45
Blantyre,Mulanje,70
Thyolo,Mulanje,45
Blantyre,Chikwawa,50
Chikwawa,Nsanje,125
Thyolo,Nsanje,150`;

// Lake Malawi outline in the same schematic coordinates.
const LAKE = [
  [455, 15], [445, 150], [440, 260], [440, 380], [445, 500], [455, 590], [520, 680],
  [578, 735], [598, 700], [605, 600], [575, 450], [550, 300], [530, 150], [515, 15],
];

function parseGraph(csv) {
  const names = [], index = new Map(), adj = [], edges = [];
  const node = (n) => {
    if (!index.has(n)) { index.set(n, names.length); names.push(n); adj.push([]); }
    return index.get(n);
  };
  csv.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(",");
    if (parts.length !== 3) throw new Error(`Line ${i + 1}: expected town_a,town_b,km`);
    const [a, b, w] = parts;
    if (!/^-?\d+$/.test(w.trim())) throw new Error(`Line ${i + 1}: bad distance '${w}'`);
    const km = Number(w);
    if (km < 0) throw new Error(`Negative distance on road ${a} - ${b}: Dijkstra needs non-negative weights`);
    if (a === b) throw new Error(`Self loop on ${a} is not allowed`);
    const u = node(a), v = node(b);
    adj[u].push([v, km]); adj[v].push([u, km]);
    edges.push({ u, v, w: km });
  });
  return { names, index, adj, edges };
}

// Small binary min-heap of [key, ...payload] arrays.
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  less(i, j) {
    const x = this.a[i], y = this.a[j];
    for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k];
    return false;
  }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(i, p)) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}

// Dijkstra with a binary heap. Records each settle step for the dry run.
function dijkstra(g, source) {
  const n = g.names.length;
  const dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), done = Array(n).fill(false);
  const steps = [];
  const pq = new MinHeap();
  dist[source] = 0; pq.push([0, source]);
  while (pq.size) {
    const [d, u] = pq.pop();
    if (done[u]) continue;
    done[u] = true;
    const relaxed = [];
    for (const [v, w] of g.adj[u]) {
      if (done[v]) continue;
      if (d + w < dist[v]) { relaxed.push([v, dist[v], d + w]); dist[v] = d + w; prev[v] = u; pq.push([dist[v], v]); }
    }
    const frontier = [];
    for (let v = 0; v < n; v++) if (!done[v] && dist[v] < Infinity) frontier.push([dist[v], v]);
    frontier.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    steps.push({ settled: u, d, relaxed, frontier });
  }
  return { dist, prev, steps };
}

function buildPath(r, t) {
  if (r.dist[t] === Infinity) return [];
  const p = [];
  for (let v = t; v !== -1; v = r.prev[v]) p.push(v);
  return p.reverse();
}

function kruskal(g) {
  const parent = g.names.map((_, i) => i), rank = g.names.map(() => 0);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const order = g.edges.map((e, i) => ({ ...e, i })).sort((a, b) => a.w - b.w || a.i - b.i);
  const tree = [], log = [];
  for (const e of order) {
    let a = find(e.u), b = find(e.v);
    if (a === b) { log.push({ e, taken: false }); continue; }
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a; if (rank[a] === rank[b]) rank[a]++;
    tree.push(e); log.push({ e, taken: true });
  }
  return { edges: tree, total: tree.reduce((s, e) => s + e.w, 0), log, spanning: tree.length === g.names.length - 1 };
}

function prim(g, start = 0) {
  const n = g.names.length, inTree = Array(n).fill(false), tree = [];
  const pq = new MinHeap(); pq.push([0, -1, start]);
  while (pq.size) {
    const [w, from, to] = pq.pop();
    if (inTree[to]) continue;
    inTree[to] = true;
    if (from !== -1) tree.push({ u: from, v: to, w });
    for (const [v, wv] of g.adj[to]) if (!inTree[v]) pq.push([wv, to, v]);
  }
  return { edges: tree, total: tree.reduce((s, e) => s + e.w, 0), spanning: tree.length === n - 1 };
}

// Draw the network as an SVG string.
// opts: { path: [ids], mst: [edges], scale, showWeights, cls: extra class }
function drawMap(g, opts = {}) {
  const X = (x) => x + 70, Y = (y) => y + 10;
  const W = 790, H = 1260;
  const pos = (id) => { const t = TOWNS[g.names[id]]; return [X(t[0]), Y(t[1])]; };
  const key = (u, v) => (u < v ? `${u}-${v}` : `${v}-${u}`);
  const onPath = new Set();
  (opts.path || []).forEach((v, i, p) => { if (i) onPath.add(key(p[i - 1], v)); });
  const onMst = new Set((opts.mst || []).map((e) => key(e.u, e.v)));
  const pathNodes = new Set(opts.path || []);
  let s = `<svg class="map ${opts.cls || ""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of the Malawi road network graph">`;
  s += `<path class="lake" d="M${LAKE.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join("L")}Z"/>`;
  s += `<text class="lake-label" x="${X(505)}" y="${Y(380)}" transform="rotate(88 ${X(505)} ${Y(380)})">Lake Malawi</text>`;
  for (const e of g.edges) {
    const [x1, y1] = pos(e.u), [x2, y2] = pos(e.v);
    const kk = key(e.u, e.v);
    const c = onPath.has(kk) ? "road on-path" : onMst.has(kk) ? "road on-mst" : opts.mst ? "road off-mst" : "road";
    s += `<line class="${c}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  if (opts.showWeights !== false) {
    for (const e of g.edges) {
      const [x1, y1] = pos(e.u), [x2, y2] = pos(e.v);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const kk = key(e.u, e.v);
      const hot = onPath.has(kk) || onMst.has(kk) ? " hot" : "";
      s += `<g class="wt${hot}"><rect x="${(mx - 17).toFixed(1)}" y="${(my - 9).toFixed(1)}" width="34" height="18" rx="4"/>` +
           `<text x="${mx.toFixed(1)}" y="${(my + 4.5).toFixed(1)}">${e.w}</text></g>`;
    }
  }
  g.names.forEach((name, id) => {
    const [x, y] = pos(id), side = TOWNS[name][2];
    const lx = side === "w" ? x - 12 : side === "e" ? x + 12 : x;
    const ly = side === "s" ? y + 26 : side === "n" ? y - 14 : y + 4.5;
    const anchor = side === "w" ? "end" : side === "e" ? "start" : "middle";
    const cls = opts.path && pathNodes.has(id) ? "town on-path" : "town";
    s += `<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/>`;
    s += `<text class="town-label${pathNodes.has(id) ? " on-path" : ""}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${name}</text>`;
  });
  return s + "</svg>";
}

if (typeof module !== "undefined") module.exports = { TOWNS, ROADS_CSV, parseGraph, dijkstra, buildPath, kruskal, prim, drawMap };
