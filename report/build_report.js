// build_report.js - builds report/report.html from the graph data, the C++ test
// output and the source code, then prints it to report/DSA_Report.pdf.
// Run from the project root:  make && node report/build_report.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const M = require("../docs/graph.js");

// ---- Edit these before submitting ----------------------------------------
const MEMBERS = [
  ["[Member 1 full name]", "[Registration number]"],
  ["[Member 2 full name]", "[Registration number]"],
  ["[Member 3 full name]", "[Registration number]"],
];
const GITHUB_URL = "https://github.com/mse23-mkapolo-cpu/DSA";
const DEMO_URL = "https://mse23-mkapolo-cpu.github.io/DSA/";
const COURSE = "Data Structures and Algorithms";
const DATE = "November 2026";
// ---------------------------------------------------------------------------

const ROOT = path.join(__dirname, "..");
const G = M.parseGraph(M.ROADS_CSV);
const N = (i) => G.names[i];
const km = M.km; // metres -> "1.5"
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const V = G.names.length, E = G.edges.length;
const totalM = G.edges.reduce((s, e) => s + e.w, 0);
const deg = G.names.map((_, i) => G.adj[i].length);
const AREA = {
  "Blantyre CBD": "Blantyre town", Mandala: "Blantyre town", Chilomoni: "Blantyre west", Kameza: "Blantyre west",
  Manja: "Blantyre west", Zingwangwa: "Blantyre west", Nyambadwe: "Blantyre north", Sunnyside: "Blantyre town",
  Namiwawa: "Blantyre north", QECH: "Blantyre town", Soche: "Blantyre south", Naperi: "Blantyre south",
  Chitawira: "Middle", Chichiri: "Middle", "Ginnery Corner": "Middle", Makata: "Middle", Ndirande: "Middle",
  Kanjedza: "Limbe side", Chinyonga: "Limbe side", Mpingwe: "Limbe side", Limbe: "Limbe side",
  Bangwe: "Limbe side", Machinjiri: "Limbe side",
};
const NOTE = {
  "Blantyre CBD": "City centre (Victoria Avenue, Haile Selassie Road)", QECH: "Queen Elizabeth Central Hospital",
  Chichiri: "Chichiri Shopping Mall, Kamuzu Stadium", "Ginnery Corner": "Major junction on Masauko Chipembere Highway",
  Makata: "Industrial area", Limbe: "Limbe town centre and market", Mandala: "Mandala House area",
};

// ---------- Q1 tables
const nodeRows = G.names.map((n, i) => `<tr><td class="num">${i}</td><td>${n}${NOTE[n] ? `<br><span class="small">${NOTE[n]}</span>` : ""}</td><td>${AREA[n]}</td><td class="num">${deg[i]}</td>
  <td>${G.adj[i].map(([v, w]) => `${N(v)} (${km(w)})`).join(", ")}</td></tr>`).join("");
const edgeRows = G.edges.map((e, i) => `<tr><td class="num">e${i + 1}</td><td>${N(e.u)}</td><td>${N(e.v)}</td><td class="num">${km(e.w)}</td></tr>`);
const half = Math.ceil(edgeRows.length / 2);
const edgeTable = (rows) => `<table class="compact"><thead><tr><th>Edge</th><th>Place A</th><th>Place B</th><th>km</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
const maxDeg = Math.max(...deg);
const deg2 = G.names.filter((_, i) => deg[i] === 2);
const longest = G.edges.reduce((a, e) => (e.w > a.w ? e : a));
const shortest = G.edges.reduce((a, e) => (e.w < a.w ? e : a));

// ---------- Q3 full Dijkstra from Blantyre CBD
const SRC = G.index.get("Blantyre CBD"), LIMBE = G.index.get("Limbe");
const full = M.dijkstra(G, SRC);
const stepRows = full.steps.map((st, i) => {
  const upd = st.relaxed.length ? st.relaxed.map(([v, o, n]) => `${N(v)}: ${km(o)} → <b>${km(n)}</b>`).join("<br>") : "none (no shorter road found)";
  const q = st.frontier.map(([d, v]) => `${N(v)} ${km(d)}`).join(", ");
  return `<tr><td class="num">${i + 1}</td><td><b>${N(st.settled)}</b></td><td class="num">${km(st.d)}</td><td>${upd}</td><td class="small">${q || "(empty)"}</td></tr>`;
}).join("");
const finalRows = [...G.names.keys()].sort((a, b) => full.dist[a] - full.dist[b]).map((v) =>
  `<tr><td>${N(v)}</td><td class="num">${km(full.dist[v])}</td><td>${full.prev[v] < 0 ? "–" : N(full.prev[v])}</td>
   <td>${M.buildPath(full, v).map(N).join(" → ")}</td></tr>`).join("");
const sptEdges = G.names.map((_, v) => v).filter((v) => full.prev[v] >= 0).map((v) => ({ u: full.prev[v], v, w: 0 }));

// ---------- Q5 dry run: Soche -> Chichiri, showing the raw priority queue (with stale entries)
function dryRun(src, dst) {
  const n = G.names.length, dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), done = Array(n).fill(false);
  const pqStr = (q) => [...q].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([d, v]) => `(${N(v)}, ${km(d)})`).join(" ") || "(empty)";
  let pq = [[0, src]];
  dist[src] = 0;
  const rows = [`<tr><td class="num">init</td><td>–</td><td>dist[${N(src)}] = 0, all others ∞</td><td class="small">${pqStr(pq)}</td></tr>`];
  let iter = 0;
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [d, u] = pq.shift();
    iter++;
    if (done[u]) {
      rows.push(`<tr class="stale"><td class="num">${iter}</td><td>pop (${N(u)}, ${km(d)})</td><td>${N(u)} is already settled: stale entry, skip</td><td class="small">${pqStr(pq)}</td></tr>`);
      continue;
    }
    done[u] = true;
    const notes = [];
    for (const [v, w] of G.adj[u]) {
      if (done[v]) { notes.push(`${N(v)}: settled, skip`); continue; }
      if (d + w < dist[v]) {
        notes.push(`${N(v)}: ${km(d)} + ${km(w)} = ${km(d + w)} &lt; ${km(dist[v])} → update, prev = ${N(u)}`);
        dist[v] = d + w; prev[v] = u; pq.push([dist[v], v]);
      } else notes.push(`${N(v)}: ${km(d)} + ${km(w)} = ${km(d + w)} ≥ ${km(dist[v])} → no change`);
    }
    rows.push(`<tr class="${u === dst ? "target" : ""}"><td class="num">${iter}</td><td>pop (${N(u)}, ${km(d)})<br>settle ${N(u)}</td><td>${notes.join("<br>")}${u === dst ? "<br><b>Target settled: stop.</b>" : ""}</td><td class="small">${pqStr(pq)}</td></tr>`);
    if (u === dst) break;
  }
  const p = [];
  for (let v = dst; v !== -1; v = prev[v]) p.push(N(v));
  return { rows: rows.join(""), dist: dist[dst], path: p.reverse() };
}
const DR = dryRun(G.index.get("Soche"), G.index.get("Chichiri"));

// ---------- Q5 test results from the C++ program
let testOut;
try { testOut = execSync("./run_tests", { cwd: ROOT }).toString(); } catch (e) { testOut = e.stdout.toString(); }
const tests = [];
const re = /\[(PASS|FAIL)\] (T\d+) (.*)\n\s+input:\s+(.*)\n\s+expected: (.*)\n\s+actual:\s+(.*)/g;
let mm;
while ((mm = re.exec(testOut))) tests.push(mm.slice(1));
const summary = (testOut.match(/Summary: .*/) || ["?"])[0];
const testRows = tests.map(([res, id, name, input, exp, act]) => `<tr><td class="num">${id}</td><td>${esc(name)}</td><td class="small">${esc(input)}</td>
  <td class="small mono">${esc(exp)}</td><td class="small mono">${esc(act)}</td><td><span class="pill ${res.toLowerCase()}">${res}</span></td></tr>`).join("");
const run = (cmd) => execSync(cmd, { cwd: ROOT }).toString();
const traceOut = run('./roads trace Mandala Chichiri');
const mstOut = run('./roads mst kruskal');
const errOut = (cmd) => { try { return run(cmd); } catch (e) { return e.stderr.toString(); } };

// ---------- Q6/Q7 MST
const K = M.kruskal(G), P = M.prim(G, SRC);
const kRows = K.log.map(({ e, taken }, i) => `<tr class="${taken ? "" : "muted"}"><td class="num">${i + 1}</td><td>${N(e.u)} – ${N(e.v)}</td><td class="num">${km(e.w)}</td>
  <td>${taken ? "add" : `skip: ${N(e.u)} and ${N(e.v)} already connected (cycle)`}</td></tr>`).join("");
const pRows = P.edges.map((e, i) => `<tr><td class="num">${i + 1}</td><td>${N(e.u)} → ${N(e.v)}</td><td class="num">${km(e.w)}</td></tr>`).join("");
const lastAdded = K.edges[K.edges.length - 1];
const mstPath = (() => {
  const T = G.names.map(() => []);
  K.edges.forEach((e) => { T[e.u].push([e.v, e.w]); T[e.v].push([e.u, e.w]); });
  const st = [[SRC, -1, 0, [SRC]]];
  while (st.length) {
    const [u, p, d, path] = st.pop();
    if (u === LIMBE) return { d, path: path.map(N).join(" → ") };
    for (const [v, w] of T[u]) if (v !== p) st.push([v, u, d + w, [...path, v]]);
  }
})();

const src = (f) => esc(fs.readFileSync(path.join(ROOT, f), "utf8"));
const dijkstraCode = esc(fs.readFileSync(path.join(ROOT, "src/graph.hpp"), "utf8").split("// ---------------------------------------------------------------- Dijkstra")[1].split("// ---------------------------------------------------------------- MST")[0].trim());
const log2 = (x) => Math.round(E * Math.log2(x));

const css = fs.readFileSync(path.join(__dirname, "report.css"), "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Blantyre City Road Network – DSA Assignment</title>
<style>${css}</style></head><body>

<section class="cover">
  <p class="eyebrow">${COURSE} · 2026 Assignment</p>
  <h1>Shortest Routes and Minimum Spanning Tree on the Blantyre City Road Network, from Limbe to Blantyre Town</h1>
  <p class="lede">A weighted graph of ${V} places and ${E} roads in Blantyre city, solved with Dijkstra's algorithm, Kruskal's algorithm and Prim's algorithm, implemented in C++ and deployed as a web application.</p>
  <h3>Group members</h3>
  <table class="members"><thead><tr><th>#</th><th>Name</th><th>Registration number</th></tr></thead><tbody>
  ${MEMBERS.map(([n, r], i) => `<tr><td>${i + 1}</td><td>${esc(n)}</td><td>${esc(r)}</td></tr>`).join("")}</tbody></table>
  <table class="links"><tr><th>Source code</th><td>${esc(GITHUB_URL)}</td></tr>
  <tr><th>Live demo</th><td>${esc(DEMO_URL)}</td></tr><tr><th>Date</th><td>${DATE}</td></tr></table>
  <h3>Contents</h3>
  <ol class="toc">
    <li>The graph: Blantyre city road network (Q1)</li><li>Drawing and description of the graph (Q2)</li>
    <li>How Dijkstra's algorithm works on the graph (Q3)</li><li>Implementation (Q4)</li>
    <li>Testing and dry run (Q5)</li><li>Does the graph have an MST? (Q6)</li>
    <li>Which MST algorithm and why (Q7)</li><li>Deployment (Q8)</li><li>Appendix: source code</li>
  </ol>
</section>

<section>
<h2>1. The graph: Blantyre city road network <span class="q">Q1 · 15 marks</span></h2>
<p><b>Scenario.</b> The graph models the roads of Blantyre city, from Blantyre town (the city centre) in the west to Limbe in the east. Each <b>vertex</b> is a place in the city: a neighbourhood (for example Ndirande, Chilomoni, Soche, Chinyonga), a landmark (Queen Elizabeth Central Hospital, Chichiri) or a major junction (Ginnery Corner). Each <b>edge</b> is a road that links two places directly, without passing through another place in the graph. The <b>weight</b> of an edge is the road distance between the two places.</p>
<p>Blantyre and Limbe are joined by two main roads, and both appear in the graph. Masauko Chipembere Highway runs from the city centre past Ginnery Corner and Kanjedza to Limbe. Kamuzu Highway runs past Chichiri and Chinyonga. Smaller roads connect the residential areas around them.</p>
<p>The graph is <b>undirected</b> because the roads carry traffic in both directions, so the distance from A to B equals the distance from B to A. It is <b>weighted</b> because the roads have different lengths, and it is <b>simple</b> (no self loops, at most one road between two places).</p>
<p>Distances are approximate road distances, rounded to the nearest 100 m. They are stored in the data file as whole metres (for example 1500), and the program shows them in kilometres with one decimal (1.5 km). Whole numbers avoid rounding errors when distances are added.</p>
<div class="stats">
  <div><b>${V}</b><span>vertices (places)</span></div><div><b>${E}</b><span>edges (roads)</span></div>
  <div><b>${km(totalM)}</b><span>km of road in total</span></div><div><b>${km(full.dist[LIMBE])}</b><span>km, shortest route Blantyre CBD to Limbe</span></div>
</div>
<p>Formally <i>G = (V, E, w)</i> with |V| = ${V}, |E| = ${E} and w : E → ℕ (metres). The full data is in <code>data/blantyre_roads.csv</code> in the repository, one road per line as <code>place_a,place_b,metres</code>.</p>
<h3>Vertices and adjacency list</h3>
<table><thead><tr><th>ID</th><th>Place</th><th>Area</th><th>Degree</th><th>Neighbours (distance in km)</th></tr></thead><tbody>${nodeRows}</tbody></table>
<h3>Edges (weights in km)</h3>
<div class="two">${edgeTable(edgeRows.slice(0, half))}${edgeTable(edgeRows.slice(half))}</div>
</section>

<section>
<h2>2. Drawing and description of the graph <span class="q">Q2 · 10 marks</span></h2>
<p><b>Conventions used.</b> Each place is drawn as a circle (vertex) labelled with its name. Each road is a straight line (edge) between two circles. Because the graph is undirected, the lines have no arrowheads. The number in the box on each line is the weight, the distance in km. Places are laid out roughly as they are on a map of Blantyre, with Blantyre town on the left (west), Limbe on the right (east) and north at the top.</p>
<figure class="map-fig wide">${M.drawMap(G, {})}<figcaption>Figure 1. The Blantyre city road network graph, G = (V, E), |V| = ${V}, |E| = ${E}. Weights in km.</figcaption></figure>
<h3>Description</h3>
<ul>
<li><b>Connected:</b> there is a path between every pair of places, so G has a single component. Test T10 confirms this: all ${V * V} source–target pairs have a finite distance.</li>
<li><b>Sparse:</b> a simple graph on ${V} vertices can have at most ${V} × ${V - 1} / 2 = ${(V * (V - 1)) / 2} edges. G has ${E}, a density of ${E} / ${(V * (V - 1)) / 2} ≈ ${(E / ((V * (V - 1)) / 2)).toFixed(2)}. This is typical of road networks and is why an adjacency list is the right representation.</li>
<li><b>Degrees:</b> the sum of degrees is 2|E| = ${2 * E} (handshake lemma), so the average degree is ${(2 * E / V).toFixed(2)}. Blantyre CBD has the highest degree (${maxDeg}), as the city centre where many roads meet. Ginnery Corner, the busy junction between Blantyre and Limbe, has degree ${deg[G.index.get("Ginnery Corner")]}. ${deg2.length} places have degree 2: ${deg2.join(", ")}. These are at the edge of the city.</li>
<li><b>Cycles:</b> G contains many cycles, for example Blantyre CBD–Mandala–QECH–Blantyre CBD (1.5 + 1.0 + 2.2 = 4.7 km) and the two highway corridors Ginnery Corner–Kanjedza–Chinyonga–Chichiri–Ginnery Corner. The cyclomatic number |E| − |V| + 1 = ${E - V + 1} is the number of independent cycles, and also the number of roads that can be removed while keeping all places connected (see the MST in section 6).</li>
<li><b>No bridges:</b> removing any single road leaves the graph connected, because every road lies on a cycle. In practice, if one road is closed (for example for repairs) every place can still be reached by another route.</li>
<li><b>Longest and shortest roads:</b> ${N(longest.u)}–${N(longest.v)} (${km(longest.w)} km) is the longest. ${N(shortest.u)}–${N(shortest.v)} (${km(shortest.w)} km) is the shortest.</li>
</ul>
<p class="note">The assignment asks for the graph to be drawn on paper. Figure 1 is the typed version; the hand-drawn version follows the same layout and conventions.</p>
</section>

<section>
<h2>3. How Dijkstra's algorithm works on the graph <span class="q">Q3 · 15 marks</span></h2>
<p>Dijkstra's algorithm finds the shortest distance from one <b>source</b> vertex to every other vertex in a graph with non-negative weights. It keeps a tentative distance <i>d[v]</i> for every place, starting at 0 for the source and ∞ for the rest. At each step it <b>settles</b> the unsettled place with the smallest tentative distance; that distance is now final, because every other route would have to leave through a place that is already at least as far away and the weights are never negative. It then <b>relaxes</b> each road (u, v) out of the settled place: if d[u] + w(u, v) &lt; d[v], it lowers d[v] and records u as the previous place on v's route.</p>
<pre class="code">DIJKSTRA(G, s)
  for each vertex v:  d[v] ← ∞,  prev[v] ← NIL
  d[s] ← 0;  Q ← min-priority queue containing (0, s)
  while Q is not empty:
      (du, u) ← EXTRACT-MIN(Q)
      if u is already settled: continue          // stale entry
      mark u settled
      for each edge (u, v, w):
          if v not settled and du + w &lt; d[v]:
              d[v] ← du + w;  prev[v] ← u;  INSERT(Q, (d[v], v))</pre>
<h3>Worked example: all shortest routes from Blantyre CBD</h3>
<p>We run the algorithm with Blantyre CBD as the source. The table shows, for each of the ${V} steps, which place is settled, the roads that improved a tentative distance, and the reached-but-unsettled places afterwards (in order of distance, all in km). A place leaves the queue in exactly the order of its final distance.</p>
<table class="steps"><thead><tr><th>Step</th><th>Settle</th><th>d (km)</th><th>Relaxations (old → new)</th><th>Tentative distances after the step</th></tr></thead><tbody>${stepRows}</tbody></table>
<p>Step 5 shows the algorithm correcting itself. In step 4, Nyambadwe sets Ndirande to 1.8 + 2.5 = 4.3 km. In step 5, Namiwawa (2.0 km) finds a shorter road, 2.0 + 2.2 = 4.2 km, so Ndirande is updated to 4.2 and its previous place changes to Namiwawa. Some steps, such as Naperi and Kameza, change nothing because every neighbour already has a shorter distance.</p>
<h3>Result: shortest distances and routes from Blantyre CBD</h3>
<table><thead><tr><th>Place</th><th>Distance (km)</th><th>Previous place</th><th>Shortest route</th></tr></thead><tbody>${finalRows}</tbody></table>
<p>The previous-place pointers form the <b>shortest-path tree</b> rooted at Blantyre CBD (Figure 2). Reading the route to any place means following the pointers back from that place to Blantyre CBD. For example, Limbe ← Kanjedza ← Ginnery Corner ← Namiwawa ← Blantyre CBD gives Blantyre CBD → Namiwawa → Ginnery Corner → Kanjedza → Limbe, 2.0 + 1.6 + 3.0 + 2.5 = <b>9.1 km</b>, along Masauko Chipembere Highway. This is shorter than the Kamuzu Highway route through QECH, Chichiri, Chinyonga and Mpingwe (2.2 + 1.2 + 3.2 + 1.8 + 1.2 = 9.6 km) and the route through Makata (2.0 + 1.6 + 1.4 + 2.8 + 2.5 = 10.3 km).</p>
<figure class="map-fig wide">${M.drawMap(G, { mst: sptEdges })}<figcaption>Figure 2. Shortest-path tree from Blantyre CBD (blue). Dashed roads are not used by any shortest route from Blantyre CBD.</figcaption></figure>
</section>

<section>
<h2>4. Implementation <span class="q">Q4 · 10 marks</span></h2>
<p>The algorithm is implemented in <b>C++17</b> with only the standard library. The repository is organised as follows:</p>
<table><thead><tr><th>File</th><th>Purpose</th></tr></thead><tbody>
<tr><td><code>data/blantyre_roads.csv</code></td><td>The graph: one road per line, <code>place_a,place_b,metres</code>.</td></tr>
<tr><td><code>src/graph.hpp</code></td><td>Graph class (adjacency list), Dijkstra, path reconstruction, Kruskal (with union–find) and Prim.</td></tr>
<tr><td><code>src/main.cpp</code></td><td>Command line program: shortest route, step-by-step trace, distances from a place, MST, and an interactive menu.</td></tr>
<tr><td><code>tests/tests.cpp</code></td><td>25 automated tests (section 5).</td></tr>
<tr><td><code>docs/</code></td><td>Web version of the same algorithms in JavaScript, published with GitHub Pages (section 8).</td></tr>
<tr><td><code>Makefile</code></td><td><code>make</code> builds everything, <code>make test</code> runs the tests.</td></tr>
</tbody></table>
<h3>Design decisions</h3>
<ul>
<li><b>Adjacency list</b> (<code>vector&lt;vector&lt;pair&lt;int, long long&gt;&gt;&gt;</code>): uses O(V + E) memory and lets Dijkstra visit only the real neighbours of a place. An adjacency matrix would need ${V} × ${V} = ${V * V} cells for ${E} roads.</li>
<li><b>Place names are mapped to integer IDs</b> with a <code>std::map</code>, so the algorithms work on fast array indices while the user types names.</li>
<li><b>Distances in whole metres.</b> Storing 1.5 km as 1500 m keeps all arithmetic in integers, so sums are exact and comparisons such as d[u] + w &lt; d[v] never suffer from floating-point rounding. Output is converted to km.</li>
<li><b>Binary heap priority queue</b> (<code>std::priority_queue</code> with <code>std::greater</code>) holding (distance, place) pairs. Instead of a decrease-key operation, a place is pushed again when its distance improves, and outdated entries are skipped when popped (“lazy deletion”). This keeps the code short and gives <b>O((V + E) log V)</b> time.</li>
<li><b>Path reconstruction</b> uses the <code>prev[]</code> array, following pointers back from the target and reversing.</li>
<li><b>Input validation:</b> negative weights are rejected (Dijkstra is incorrect with them), as are self loops, malformed lines, non-numeric distances, missing files and unknown place names. Unreachable places are reported as “No route”.</li>
</ul>
<h3>Core code: Dijkstra</h3>
<pre class="code">${dijkstraCode}</pre>
<h3>Building and running</h3>
<pre class="code">$ make                       # builds ./roads and ./run_tests
$ ./roads path "Blantyre CBD" Limbe
${esc(run('./roads path "Blantyre CBD" Limbe'))}$ ./roads trace Mandala Chichiri    # step-by-step dry run
$ ./roads all Limbe                 # distances from Limbe to every place
$ ./roads mst kruskal               # minimum spanning tree
$ ./roads                           # interactive menu
$ make test                         # run the 25 tests</pre>
</section>

<section>
<h2>5. Testing and dry run <span class="q">Q5 · 20 marks</span></h2>
<h3>Test strategy</h3>
<p>The tests in <code>tests/tests.cpp</code> cover four groups: (a) loading the graph, (b) known shortest routes worked out by hand, (c) an independent cross-check of every pair of places against a different algorithm (Floyd–Warshall), and (d) error handling and edge cases. Each test prints its input, the expected output and the actual output. The table below was produced by running <code>make test</code>.</p>
<p class="result-line">${esc(summary)}</p>
<table class="tests"><thead><tr><th>ID</th><th>Test</th><th>Input</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>${testRows}</tbody></table>
<h3>How the expected values were checked</h3>
<p>Each expected route in T03–T09 was worked out by hand and compared against the other possible routes. For T04 (Blantyre CBD → Limbe) we compared three corridors: Masauko Chipembere Highway via Ginnery Corner and Kanjedza (9.1 km), Kamuzu Highway via Chichiri and Chinyonga (9.6 km), and the northern route via Makata (10.3 km). Test T10 then checks every one of the ${V * V} pairs against Floyd–Warshall, a completely different algorithm, and checks that every route the program prints adds up to the distance it reports. This guards against mistakes in the hand calculations as well as in the code.</p>
<h3>Errors</h3>
<p>Tests T11–T16 check that bad input produces a clear error message instead of a crash or a wrong answer. The same errors appear in the command line program:</p>
<pre class="code">$ ./roads path "Blantyre CBD" Lilongwe
${esc(errOut('./roads path "Blantyre CBD" Lilongwe'))}$ ./roads path limbe Mandala
${esc(errOut('./roads path limbe Mandala'))}$ ./roads --data no_such_file.csv path Limbe Bangwe
${esc(errOut('./roads --data no_such_file.csv path Limbe Bangwe'))}</pre>
<p>Edge cases (T17–T20) use small separate graphs: a place with no road link to the rest (Chileka, joined only to Lunzu) is reported as unreachable, a zero-length road is allowed, and when two roads join the same places the shorter one is used. No test failed in the final run, and no crashes or incorrect results were found.</p>

<h3>Dry run 1: Soche → Chichiri, tracing the priority queue</h3>
<p>This dry run follows the code line by line, showing the real contents of the priority queue, including stale entries left behind by lazy deletion. Entries are written (place, distance in km) and the queue is shown sorted, smallest first.</p>
<table class="steps"><thead><tr><th>Iter.</th><th>Action</th><th>Relaxing each road of the settled place</th><th>Priority queue after</th></tr></thead><tbody>${DR.rows}</tbody></table>
<p><b>Result:</b> following prev[] back from Chichiri gives ${DR.path.join(" → ")}, a distance of <b>${km(DR.dist)} km</b>. The program prints the same:</p>
<pre class="code">$ ./roads path Soche Chichiri
${esc(run("./roads path Soche Chichiri"))}</pre>

<h3>Dry run 2: program trace for Mandala → Chichiri</h3>
<p>The <code>trace</code> command prints each step the algorithm takes and stops once the destination is settled.</p>
<pre class="code">$ ./roads trace Mandala Chichiri
${esc(traceOut)}</pre>
</section>

<section>
<h2>6. Does the graph have a minimum spanning tree? <span class="q">Q6 · 10 marks</span></h2>
<p><b>Yes.</b> A spanning tree is a subset of the edges that connects all the vertices with no cycles; it has exactly |V| − 1 edges. A minimum spanning tree (MST) is a spanning tree with the smallest possible total weight. An undirected graph has a spanning tree if and only if it is <b>connected</b>, and then it also has a minimum one, because there are finitely many spanning trees and one of them must have the smallest total. Our graph is undirected, weighted and connected (section 2), so it has an MST.</p>
<p>The MST of our graph has <b>${K.edges.length} edges</b> and a total length of <b>${km(K.total)} km</b>, compared with ${km(totalM)} km for all ${E} roads. The other ${E - K.edges.length} roads (the cyclomatic number from section 2) each close a cycle and are not needed for connectivity.</p>
<figure class="map-fig wide">${M.drawMap(G, { mst: K.edges })}<figcaption>Figure 3. Minimum spanning tree (blue, ${km(K.total)} km). Dashed roads are not in the MST.</figcaption></figure>
<p><b>The MST is unique.</b> Some roads have equal lengths (for example several roads of 1.5 km and of 2.5 km), which can sometimes allow more than one MST. We checked every road that is not in the tree: in each case it is strictly longer than every road on the tree path between its two places, so no swap gives an equal total. The MST is therefore the only one.</p>
<h3>What the MST represents</h3>
<p>The MST is the <b>shortest total length of road that still connects every place</b> to every other place. In Blantyre this answers questions such as:</p>
<ul>
<li><b>Laying pipes or cables along the roads.</b> Blantyre Water Board pipes, ESCOM power lines and fibre-optic cables are usually laid along road reserves. Connecting all ${V} places along the MST needs ${km(K.total)} km of pipe or cable instead of ${km(totalM)} km.</li>
<li><b>Road maintenance on a limited budget.</b> If Blantyre City Council could only resurface ${K.edges.length} roads, the MST keeps every area from Limbe to Blantyre town reachable for the least total length of road to maintain.</li>
<li><b>Emergency access.</b> During heavy rains, when some roads flood or wash away, the MST shows a minimal backbone that must stay open so that every area, including QECH, can still be reached.</li>
</ul>
<p><b>What the MST does not represent:</b> it is not a set of shortest routes. In the MST the only route from Blantyre CBD to Limbe is ${mstPath.path}, which is <b>${km(mstPath.d)} km</b>, compared with the ${km(full.dist[LIMBE])} km found by Dijkstra. The MST minimises the total length of the whole network; Dijkstra minimises the length of one journey.</p>
</section>

<section>
<h2>7. Which MST algorithm we would use, and why <span class="q">Q7 · 10 marks</span></h2>
<table><thead><tr><th></th><th>Kruskal</th><th>Prim</th></tr></thead><tbody>
<tr><td>Idea</td><td>Sort all roads by length. Add each road unless it joins two places that are already connected (it would make a cycle).</td><td>Start from one place. Repeatedly add the shortest road from the tree to a place not yet in the tree.</td></tr>
<tr><td>Data structure</td><td>Sorted edge list + union–find (disjoint sets)</td><td>Priority queue + adjacency list</td></tr>
<tr><td>Time</td><td>O(E log E)</td><td>O(E log V) with a binary heap; O(V²) with an array</td></tr>
<tr><td>Best for</td><td>Sparse graphs, data given as an edge list</td><td>Dense graphs, data given as an adjacency matrix</td></tr>
<tr><td>On our graph</td><td>${E} × log₂${E} ≈ ${log2(E)} basic steps</td><td>${E} × log₂${V} ≈ ${log2(V)} basic steps</td></tr>
</tbody></table>
<p><b>We would use Kruskal's algorithm</b>, for these reasons:</p>
<ol>
<li><b>The graph is sparse</b> (${E} edges, density ${(E / ((V * (V - 1)) / 2)).toFixed(2)}). Kruskal's cost depends on sorting the edges, which is cheap when there are few of them. The O(V²) array version of Prim, which suits dense graphs, would waste work here. For a graph this small the binary-heap versions of both algorithms are practically equal in speed, so the decision comes down to the next points.</li>
<li><b>Our data is already an edge list.</b> The file <code>blantyre_roads.csv</code> is a list of roads with lengths, which is exactly Kruskal's input. No adjacency structure is needed.</li>
<li><b>It is easy to explain and check by hand.</b> Kruskal processes roads from shortest to longest and makes one yes/no decision for each, as in the trace below. This matches how a planner would think: “lay the cheapest links first, unless the two places are already connected”.</li>
<li><b>It handles a disconnected network gracefully.</b> If floods cut the network into pieces (test T18), Kruskal returns a minimum spanning forest, one tree per piece, without any change. Prim only builds the tree of the piece containing its start place.</li>
</ol>
<p>We implemented <b>both</b> algorithms to confirm the answer. Prim gives the same ${km(P.total)} km total from every one of the ${V} possible start places (test T24).</p>
<h3>Kruskal trace on our graph</h3>
<table class="compact"><thead><tr><th>#</th><th>Road (sorted by length)</th><th>km</th><th>Decision</th></tr></thead><tbody>${kRows}</tbody></table>
<p>The tree is complete after ${K.edges.length} additions (the last is ${N(lastAdded.u)}–${N(lastAdded.v)}, ${km(lastAdded.w)} km). The algorithm still scans the remaining longer roads but none can be added. Total: <b>${km(K.total)} km</b>.</p>
<h3>Prim's trace from Blantyre CBD (for comparison)</h3>
<table class="compact"><thead><tr><th>#</th><th>Shortest road leaving the tree</th><th>km</th></tr></thead><tbody>${pRows}</tbody></table>
<p>Total: <b>${km(P.total)} km</b>, the same tree as Kruskal, built in a different order.</p>
</section>

<section>
<h2>8. Deployment <span class="q">Q8 · 10 marks</span></h2>
<p>The work is deployed in two ways, so it can be tested with nothing to install.</p>
<h3>Web application (no installation)</h3>
<p>The same Dijkstra, Kruskal and Prim algorithms are written in JavaScript in <code>docs/graph.js</code> and run in the browser. The page is hosted free on GitHub Pages:</p>
<p class="result-line">${esc(DEMO_URL)}</p>
<ul>
<li><b>Shortest route:</b> choose any two places. The page shows the distance, the route highlighted on the map, and the full step-by-step table of the algorithm with the queue after each step.</li>
<li><b>Spanning tree:</b> shows the MST on the map with the Kruskal decision table, or Prim's order.</li>
<li><b>Tests:</b> runs the same test cases as the C++ suite in the browser and shows pass or fail for each.</li>
</ul>
<h3>C++ program</h3>
<p>The C++ source is on GitHub at ${esc(GITHUB_URL)}. It can be run without installing anything by opening the repository in GitHub Codespaces (Code → Codespaces → Create), then running <code>make &amp;&amp; ./roads</code> in the terminal. Alternatively, <code>src/graph.hpp</code> and <code>src/main.cpp</code> can be pasted into an online C++ compiler such as OnlineGDB. On a machine with g++ the steps are:</p>
<pre class="code">git clone ${esc(GITHUB_URL)}.git
cd DSA
make &amp;&amp; make test
./roads path "Blantyre CBD" Limbe</pre>
</section>

<section class="appendix">
<h2>Appendix A: src/graph.hpp</h2><pre class="code small">${src("src/graph.hpp")}</pre>
<h2>Appendix B: src/main.cpp</h2><pre class="code small">${src("src/main.cpp")}</pre>
<h2>Appendix C: MST program output</h2><pre class="code small">$ ./roads mst kruskal
${esc(mstOut)}</pre>
</section>
</body></html>`;

fs.writeFileSync(path.join(__dirname, "report.html"), html);
console.log("wrote report/report.html");

(async () => {
  let pw;
  try { pw = require("playwright"); } catch { pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.join(__dirname, "report.html"));
  await page.pdf({
    path: path.join(__dirname, "DSA_Report.pdf"), format: "A4", printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777">Blantyre city road network · DSA 2026 · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });
  await browser.close();
  console.log("wrote report/DSA_Report.pdf");
})();
