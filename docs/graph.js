// graph.js - Blantyre city road network data, algorithms and map drawing.
// Shared by the web demo (index.html) and the PDF report.
// Mirrors src/graph.hpp and data/malawi_roads.csv.

// Positions [x, y] of the places, copied from the group's hand-drawn graph
// (Limbe Market on the left, Blantyre Market on the right), and the label side.
const TOWNS = {
  "Limbe Market": [52, 178, "w"],
  "Limbe Health Centre": [204, 83, "n"],
  "Liquid Lounge Roundabout": [165, 178, "s"],
  "MASM": [192, 260, "e"],
  "Yanakis Roundabout": [155, 348, "w"],
  "Reunion Insurance Roundabout": [265, 482, "s"],
  "Independence Arch": [433, 456, "s"],
  "Puma Energy Kanjedza": [298, 176, "s"],
  "Automotive Products Limited": [395, 176, "n"],
  "Chichiri Shopping Mall": [548, 444, "n"],
  "St Columba": [534, 10, "n"],
  "Kamba Pork Market": [580, 180, "n"],
  "Stereo Night Club": [720, 178, "n"],
  "Rosewood Mall": [830, 288, "s"],
  "Red Cross Malawi": [690, 424, "s"],
  "Castel": [630, 514, "s"],
  "HHI": [738, 554, "s"],
  "Blantyre Clock Tower": [832, 494, "e"],
  "Mandala": [806, 365, "s"],
  "PA Nandos": [919, 414, "e"],
  "CI Primary School": [901, 234, "n"],
  "Blantyre Market": [968, 320, "e"],
};

// Road distances in metres (same as data/blantyre_roads.csv).
const ROADS_CSV = `Limbe Market,Limbe Health Centre,450
Limbe Market,Liquid Lounge Roundabout,700
Limbe Market,Yanakis Roundabout,1200
Limbe Health Centre,Liquid Lounge Roundabout,350
Limbe Health Centre,St Columba,3200
Liquid Lounge Roundabout,MASM,550
Liquid Lounge Roundabout,Puma Energy Kanjedza,1000
MASM,Yanakis Roundabout,1000
Yanakis Roundabout,Reunion Insurance Roundabout,1100
Reunion Insurance Roundabout,Independence Arch,1000
Puma Energy Kanjedza,Automotive Products Limited,1600
Puma Energy Kanjedza,Independence Arch,2900
Automotive Products Limited,St Columba,850
Automotive Products Limited,Kamba Pork Market,2500
Automotive Products Limited,Chichiri Shopping Mall,1500
Independence Arch,Chichiri Shopping Mall,2900
St Columba,Stereo Night Club,3100
Kamba Pork Market,Stereo Night Club,300
Kamba Pork Market,Red Cross Malawi,1200
Stereo Night Club,Rosewood Mall,700
Rosewood Mall,Red Cross Malawi,1400
Rosewood Mall,CI Primary School,1600
CI Primary School,Blantyre Market,300
Chichiri Shopping Mall,Red Cross Malawi,2300
Chichiri Shopping Mall,Castel,1900
Castel,HHI,1400
HHI,Blantyre Clock Tower,2500
Red Cross Malawi,Mandala,550
Red Cross Malawi,Blantyre Clock Tower,3400
Mandala,Blantyre Market,210
Blantyre Clock Tower,PA Nandos,1200
PA Nandos,Blantyre Market,1200`;

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
    if (parts.length !== 3) throw new Error(`Line ${i + 1}: expected place_a,place_b,metres`);
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
// Metres to a km string, e.g. 1500 -> "1.5".
// Shows two decimals only when needed: 1000 -> "1.0", 450 -> "0.45".
function km(m) {
  if (m === Infinity) return "∞";
  const s = (m / 1000).toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

function drawMap(g, opts = {}) {
  const X = (x) => x + 150, Y = (y) => y + 40;
  const W = 1260, H = 640;
  const pos = (id) => { const t = TOWNS[g.names[id]]; return [X(t[0]), Y(t[1])]; };
  const key = (u, v) => (u < v ? `${u}-${v}` : `${v}-${u}`);
  const onPath = new Set();
  (opts.path || []).forEach((v, i, p) => { if (i) onPath.add(key(p[i - 1], v)); });
  const onMst = new Set((opts.mst || []).map((e) => key(e.u, e.v)));
  const pathNodes = new Set(opts.path || []);
  let s = `<svg class="map ${opts.cls || ""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graph of the Blantyre city road network">`;
  s += `<text class="lake-label" x="${X(20)}" y="${Y(580)}">Limbe side</text>`;
  s += `<text class="lake-label" x="${X(820)}" y="${Y(580)}">Blantyre side</text>`;
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
           `<text x="${mx.toFixed(1)}" y="${(my + 4.5).toFixed(1)}">${km(e.w)}</text></g>`;
    }
  }
  g.names.forEach((name, id) => {
    const [x, y] = pos(id), side = TOWNS[name][2];
    const lx = side === "w" ? x - 12 : side === "e" ? x + 12 : x;
    const ly = side === "s" ? y + 26 : side === "n" ? y - 14 : y + 4.5;
    const anchor = side === "w" ? "end" : side === "e" ? "start" : "middle";
    const cls = opts.path && pathNodes.has(id) ? "town on-path" : "town";
    s += `<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/>`;
    // Long names go on two lines, split at the space nearest the middle.
    let lines = [name];
    if (name.length > 12 && name.includes(" ")) {
      const mid = name.length / 2;
      let best = -1;
      for (let i = 0; i < name.length; i++) if (name[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
      lines = [name.slice(0, best), name.slice(best + 1)];
    }
    const lh = 19, y0 = side === "n" ? ly - lh * (lines.length - 1) : side === "s" ? ly : ly - (lh * (lines.length - 1)) / 2;
    s += `<text class="town-label${pathNodes.has(id) ? " on-path" : ""}" x="${lx.toFixed(1)}" y="${y0.toFixed(1)}" text-anchor="${anchor}">` +
         lines.map((t, i) => `<tspan x="${lx.toFixed(1)}" dy="${i ? lh : 0}">${t}</tspan>`).join("") + `</text>`;
  });
  return s + "</svg>";
}

if (typeof module !== "undefined") module.exports = { km, TOWNS, ROADS_CSV, parseGraph, dijkstra, buildPath, kruskal, prim, drawMap };
