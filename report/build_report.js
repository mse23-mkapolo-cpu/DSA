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
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (d) => (d === Infinity ? "∞" : d);
const totalKm = G.edges.reduce((s, e) => s + e.w, 0);
const deg = G.names.map((_, i) => G.adj[i].length);
const REGION = {
  Chitipa: "North", Karonga: "North", Rumphi: "North", Mzuzu: "North", "Nkhata Bay": "North", Mzimba: "North",
  Kasungu: "Central", Nkhotakota: "Central", Ntchisi: "Central", Dowa: "Central", Salima: "Central", Lilongwe: "Central",
  Mchinji: "Central", Dedza: "Central", Ntcheu: "Central",
  Mangochi: "South", Balaka: "South", Liwonde: "South", Zomba: "South", Blantyre: "South", Mwanza: "South",
  Thyolo: "South", Mulanje: "South", Chikwawa: "South", Nsanje: "South",
};

// ---------- Q1 tables
const nodeRows = G.names.map((n, i) => `<tr><td class="num">${i}</td><td>${n}</td><td>${REGION[n]}</td><td class="num">${deg[i]}</td>
  <td>${G.adj[i].map(([v, w]) => `${N(v)} (${w})`).join(", ")}</td></tr>`).join("");
const edgeRows = G.edges.map((e, i) => `<tr><td class="num">e${i + 1}</td><td>${N(e.u)}</td><td>${N(e.v)}</td><td class="num">${e.w}</td></tr>`);
const half = Math.ceil(edgeRows.length / 2);
const edgeTable = (rows) => `<table class="compact"><thead><tr><th>Edge</th><th>Town A</th><th>Town B</th><th>km</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;

// ---------- Q3 full Dijkstra from Lilongwe
const SRC = G.index.get("Lilongwe");
const full = M.dijkstra(G, SRC);
const stepRows = full.steps.map((st, i) => {
  const upd = st.relaxed.length ? st.relaxed.map(([v, o, n]) => `${N(v)}: ${fmt(o)} → <b>${n}</b>`).join("<br>") : "none (all neighbours settled or no shorter)";
  const q = st.frontier.map(([d, v]) => `${N(v)} ${d}`).join(", ");
  return `<tr><td class="num">${i + 1}</td><td><b>${N(st.settled)}</b></td><td class="num">${st.d}</td><td>${upd}</td><td class="small">${q || "(empty)"}</td></tr>`;
}).join("");
const finalRows = [...G.names.keys()].sort((a, b) => full.dist[a] - full.dist[b]).map((v) =>
  `<tr><td>${N(v)}</td><td class="num">${full.dist[v]}</td><td>${full.prev[v] < 0 ? "–" : N(full.prev[v])}</td>
   <td>${M.buildPath(full, v).map(N).join(" → ")}</td></tr>`).join("");
const sptEdges = G.names.map((_, v) => v).filter((v) => full.prev[v] >= 0).map((v) => ({ u: full.prev[v], v, w: 0 }));

// ---------- Q5 dry run: Dedza -> Zomba, showing the raw priority queue (with stale entries)
function dryRun(src, dst) {
  const n = G.names.length, dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), done = Array(n).fill(false);
  let pq = [[0, src]];
  dist[src] = 0;
  const rows = [];
  let iter = 0;
  rows.push(`<tr><td class="num">init</td><td>–</td><td>dist[${N(src)}] = 0, all others ∞</td><td class="small">${pqStr(pq)}</td></tr>`);
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [d, u] = pq.shift();
    iter++;
    if (done[u]) {
      rows.push(`<tr class="stale"><td class="num">${iter}</td><td>pop (${N(u)}, ${d})</td><td>${N(u)} is already settled: stale entry, skip</td><td class="small">${pqStr(pq)}</td></tr>`);
      continue;
    }
    done[u] = true;
    const notes = [];
    for (const [v, w] of G.adj[u]) {
      if (done[v]) { notes.push(`${N(v)}: settled, skip`); continue; }
      if (d + w < dist[v]) {
        notes.push(`${N(v)}: ${d} + ${w} = ${d + w} &lt; ${fmt(dist[v])} → update, prev = ${N(u)}`);
        dist[v] = d + w; prev[v] = u; pq.push([dist[v], v]);
      } else notes.push(`${N(v)}: ${d} + ${w} = ${d + w} ≥ ${dist[v]} → no change`);
    }
    rows.push(`<tr class="${u === dst ? "target" : ""}"><td class="num">${iter}</td><td>pop (${N(u)}, ${d})<br>settle ${N(u)}</td><td>${notes.join("<br>")}${u === dst ? "<br><b>Target settled: stop.</b>" : ""}</td><td class="small">${pqStr(pq)}</td></tr>`);
    if (u === dst) break;
  }
  const p = [];
  for (let v = dst; v !== -1; v = prev[v]) p.push(N(v));
  return { rows: rows.join(""), dist: dist[dst], path: p.reverse(), prevChain: p };
  function pqStr(q) { return [...q].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([d, v]) => `(${N(v)}, ${d})`).join(" ") || "(empty)"; }
}
const DR = dryRun(G.index.get("Dedza"), G.index.get("Zomba"));

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
const traceOut = execSync('./roads trace Lilongwe Blantyre', { cwd: ROOT }).toString();
const mstOut = execSync('./roads mst kruskal', { cwd: ROOT }).toString();

// ---------- Q6/Q7 MST
const K = M.kruskal(G), P = M.prim(G, SRC);
const kRows = K.log.map(({ e, taken }, i) => `<tr class="${taken ? "" : "muted"}"><td class="num">${i + 1}</td><td>${N(e.u)} – ${N(e.v)}</td><td class="num">${e.w}</td>
  <td>${taken ? "add" : `skip: ${N(e.u)} and ${N(e.v)} already connected (cycle)`}</td></tr>`).join("");
const pRows = P.edges.map((e, i) => `<tr><td class="num">${i + 1}</td><td>${N(e.u)} → ${N(e.v)}</td><td class="num">${e.w}</td></tr>`).join("");
const mstPathLB = (() => {
  const T = G.names.map(() => []);
  K.edges.forEach((e) => { T[e.u].push([e.v, e.w]); T[e.v].push([e.u, e.w]); });
  const a = G.index.get("Lilongwe"), b = G.index.get("Blantyre");
  const st = [[a, -1, 0, [a]]];
  while (st.length) {
    const [u, p, d, path] = st.pop();
    if (u === b) return { d, path: path.map(N).join(" → ") };
    for (const [v, w] of T[u]) if (v !== p) st.push([v, u, d + w, [...path, v]]);
  }
})();

const src = (f) => esc(fs.readFileSync(path.join(ROOT, f), "utf8"));
const dijkstraCode = esc(fs.readFileSync(path.join(ROOT, "src/graph.hpp"), "utf8").split("// ---------------------------------------------------------------- Dijkstra")[1].split("// ---------------------------------------------------------------- MST")[0].trim());

const css = fs.readFileSync(path.join(__dirname, "report.css"), "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Malawi Road Network – DSA Assignment</title>
<style>${css}</style></head><body>

<section class="cover">
  <p class="eyebrow">${COURSE} · 2026 Assignment</p>
  <h1>Shortest Routes and Minimum Spanning Tree on the Malawi Road Network</h1>
  <p class="lede">A weighted graph of 25 Malawian towns and 38 roads, solved with Dijkstra's algorithm, Kruskal's algorithm and Prim's algorithm, implemented in C++ and deployed as a web application.</p>
  <h3>Group members</h3>
  <table class="members"><thead><tr><th>#</th><th>Name</th><th>Registration number</th></tr></thead><tbody>
  ${MEMBERS.map(([n, r], i) => `<tr><td>${i + 1}</td><td>${esc(n)}</td><td>${esc(r)}</td></tr>`).join("")}</tbody></table>
  <table class="links"><tr><th>Source code</th><td>${esc(GITHUB_URL)}</td></tr>
  <tr><th>Live demo</th><td>${esc(DEMO_URL)}</td></tr><tr><th>Date</th><td>${DATE}</td></tr></table>
  <h3>Contents</h3>
  <ol class="toc">
    <li>The graph: Malawi road network (Q1)</li><li>Drawing and description of the graph (Q2)</li>
    <li>How Dijkstra's algorithm works on the graph (Q3)</li><li>Implementation (Q4)</li>
    <li>Testing and dry run (Q5)</li><li>Does the graph have an MST? (Q6)</li>
    <li>Which MST algorithm and why (Q7)</li><li>Deployment (Q8)</li><li>Appendix: source code</li>
  </ol>
</section>

<section>
<h2>1. The graph: Malawi road network <span class="q">Q1 · 15 marks</span></h2>
<p><b>Scenario.</b> The graph models the main road network that links district centres and major towns in all three regions of Malawi. Each <b>vertex</b> is a town and each <b>edge</b> is a road that connects two towns directly, without passing through another town in the graph. The <b>weight</b> of an edge is the road distance in kilometres.</p>
<p>The graph is <b>undirected</b> because Malawian trunk roads such as the M1, M5 (lakeshore road) and M3 carry traffic both ways, so the distance from A to B equals the distance from B to A. It is <b>weighted</b> because the roads have different lengths, and it is <b>simple</b> (no self loops, at most one road between two towns).</p>
<p>Distances are approximate, rounded to the nearest 5 km where possible, based on the main routes (for example M1 Lilongwe–Dedza–Ntcheu–Blantyre, M5 Nkhata Bay–Nkhotakota–Salima, M3 Liwonde–Mangochi). They are realistic enough for the algorithms to make the same kind of trade-offs a real traveller would make, which is the purpose of the exercise.</p>
<div class="stats">
  <div><b>25</b><span>vertices (towns)</span></div><div><b>38</b><span>edges (roads)</span></div>
  <div><b>${totalKm.toLocaleString()}</b><span>km of road in total</span></div><div><b>3</b><span>regions covered</span></div>
</div>
<p>Formally <i>G = (V, E, w)</i> with |V| = 25, |E| = 38 and w : E → ℕ (km). The full data is in <code>data/malawi_roads.csv</code> in the repository, one road per line as <code>town_a,town_b,km</code>.</p>
<h3>Vertices and adjacency list</h3>
<table><thead><tr><th>ID</th><th>Town</th><th>Region</th><th>Degree</th><th>Neighbours (distance in km)</th></tr></thead><tbody>${nodeRows}</tbody></table>
<h3>Edges (weights in km)</h3>
<div class="two">${edgeTable(edgeRows.slice(0, half))}${edgeTable(edgeRows.slice(half))}</div>
</section>

<section>
<h2>2. Drawing and description of the graph <span class="q">Q2 · 10 marks</span></h2>
<p><b>Conventions used.</b> Each town is drawn as a circle (vertex) labelled with its name. Each road is a straight line (edge) between two circles. Because the graph is undirected, the lines have no arrowheads. The number in the box on each line is the weight, the distance in km. Towns are placed roughly where they are on the map of Malawi (north at the top), with Lake Malawi shown for orientation only; it is not part of the graph.</p>
<figure class="map-fig">${M.drawMap(G, {})}<figcaption>Figure 1. The Malawi road network graph, G = (V, E), |V| = 25, |E| = 38.</figcaption></figure>
<h3>Description</h3>
<ul>
<li><b>Connected:</b> there is a path between every pair of towns, so G has a single component. Test T10 confirms this: all 625 source–target pairs have a finite distance.</li>
<li><b>Sparse:</b> a simple graph on 25 vertices can have at most 25 × 24 / 2 = 300 edges. G has 38, a density of 38 / 300 ≈ 0.13. This is typical of road networks and is why an adjacency list is the right representation.</li>
<li><b>Degrees:</b> the sum of degrees is 2|E| = 76 (handshake lemma), so the average degree is 3.04. Blantyre has the highest degree (7), as the commercial hub of the south. Kasungu, Lilongwe and Salima have degree 5. Mwanza has degree 1 (a pendant vertex on the Mozambique border road), so every route to Mwanza must pass through Blantyre.</li>
<li><b>Cycles:</b> G contains many cycles, for example Blantyre–Thyolo–Mulanje–Blantyre (45 + 45 + 70 = 160 km) and Lilongwe–Dowa–Salima–Lilongwe. The cyclomatic number |E| − |V| + 1 = 14 is the number of independent cycles, and also the number of roads that can be removed while keeping all towns connected (see the MST in section 6).</li>
<li><b>Bridges:</b> Blantyre–Mwanza is a bridge (removing it disconnects Mwanza). The northern towns join the rest of the country through two corridors: the M1 through Mzimba and Kasungu, and the M5 lakeshore road through Nkhata Bay and Nkhotakota.</li>
<li><b>Longest and shortest roads:</b> Chitipa–Rumphi and Nkhata Bay–Nkhotakota (230 km) are the longest. Balaka–Liwonde (30 km) is the shortest.</li>
</ul>
<p class="note">The assignment asks for the graph to be drawn on paper. Figure 1 is the typed version; the hand-drawn version follows the same layout and conventions.</p>
</section>

<section>
<h2>3. How Dijkstra's algorithm works on the graph <span class="q">Q3 · 15 marks</span></h2>
<p>Dijkstra's algorithm finds the shortest distance from one <b>source</b> vertex to every other vertex in a graph with non-negative weights. It keeps a tentative distance <i>d[v]</i> for every town, starting at 0 for the source and ∞ for the rest. At each step it <b>settles</b> the unsettled town with the smallest tentative distance; that distance is now final, because every other route would have to leave through a town that is already at least as far away and the weights are never negative. It then <b>relaxes</b> each road (u, v) out of the settled town: if d[u] + w(u, v) &lt; d[v], it lowers d[v] and records u as the previous town on v's route.</p>
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
<h3>Worked example: all shortest routes from Lilongwe</h3>
<p>We run the algorithm with Lilongwe as the source. The table shows, for each of the 25 steps, which town is settled, the roads that improved a tentative distance, and the queue of reached-but-unsettled towns afterwards (in order of distance). A town leaves the queue in exactly the order of its final distance.</p>
<table class="steps"><thead><tr><th>Step</th><th>Settle</th><th>d</th><th>Relaxations (old → new)</th><th>Tentative distances after the step</th></tr></thead><tbody>${stepRows}</tbody></table>
<p>Some steps show the algorithm correcting itself. In step 4, Salima sets Nkhotakota to 103 + 110 = 213 km. In step 5, Ntchisi (105 km) finds a shorter road, 105 + 70 = 175 km, so Nkhotakota is updated to 175 and its previous town changes to Ntchisi. In step 14, Zomba sets Mulanje to 405 km, and in step 15 Blantyre improves it to 320 + 70 = 390 km.</p>
<h3>Result: shortest distances and routes from Lilongwe</h3>
<table><thead><tr><th>Town</th><th>Distance (km)</th><th>Previous town</th><th>Shortest route</th></tr></thead><tbody>${finalRows}</tbody></table>
<p>The previous-town pointers form the <b>shortest-path tree</b> rooted at Lilongwe (Figure 2). Reading the route to any town means following the pointers back from that town to Lilongwe. For example, Blantyre ← Ntcheu ← Dedza ← Lilongwe gives Lilongwe → Dedza → Ntcheu → Blantyre, 85 + 75 + 160 = 320 km. Note that this is shorter than going via Balaka (85 + 75 + 60 + 110 = 330 km) or via Salima, Mangochi and Liwonde.</p>
<figure class="map-fig small-map">${M.drawMap(G, { mst: sptEdges, showWeights: true })}<figcaption>Figure 2. Shortest-path tree from Lilongwe (blue). Dashed roads are not used by any shortest route from Lilongwe.</figcaption></figure>
</section>

<section>
<h2>4. Implementation <span class="q">Q4 · 10 marks</span></h2>
<p>The algorithm is implemented in <b>C++17</b> with only the standard library. The repository is organised as follows:</p>
<table><thead><tr><th>File</th><th>Purpose</th></tr></thead><tbody>
<tr><td><code>data/malawi_roads.csv</code></td><td>The graph: one road per line, <code>town_a,town_b,km</code>.</td></tr>
<tr><td><code>src/graph.hpp</code></td><td>Graph class (adjacency list), Dijkstra, path reconstruction, Kruskal (with union–find) and Prim.</td></tr>
<tr><td><code>src/main.cpp</code></td><td>Command line program: shortest route, step-by-step trace, distances from a town, MST, and an interactive menu.</td></tr>
<tr><td><code>tests/tests.cpp</code></td><td>25 automated tests (section 5).</td></tr>
<tr><td><code>docs/</code></td><td>Web version of the same algorithms in JavaScript, published with GitHub Pages (section 8).</td></tr>
<tr><td><code>Makefile</code></td><td><code>make</code> builds everything, <code>make test</code> runs the tests.</td></tr>
</tbody></table>
<h3>Design decisions</h3>
<ul>
<li><b>Adjacency list</b> (<code>vector&lt;vector&lt;pair&lt;int, long long&gt;&gt;&gt;</code>): uses O(V + E) memory and lets Dijkstra visit only the real neighbours of a town. An adjacency matrix would need 25 × 25 = 625 cells for 38 roads.</li>
<li><b>Town names are mapped to integer IDs</b> with a <code>std::map</code>, so the algorithms work on fast array indices while the user types names.</li>
<li><b>Binary heap priority queue</b> (<code>std::priority_queue</code> with <code>std::greater</code>) holding (distance, town) pairs. Instead of a decrease-key operation, a town is pushed again when its distance improves, and outdated entries are skipped when popped (“lazy deletion”). This keeps the code short and gives <b>O((V + E) log V)</b> time.</li>
<li><b>Path reconstruction</b> uses the <code>prev[]</code> array, following pointers back from the target and reversing.</li>
<li><b>Input validation:</b> negative weights are rejected (Dijkstra is incorrect with them), as are self loops, malformed lines, non-numeric distances, missing files and unknown town names. Unreachable towns are reported as “No route”.</li>
</ul>
<h3>Core code: Dijkstra</h3>
<pre class="code">${dijkstraCode}</pre>
<h3>Building and running</h3>
<pre class="code">$ make                       # builds ./roads and ./run_tests
$ ./roads path Lilongwe Blantyre
Shortest route Lilongwe -> Blantyre: 320 km
  Lilongwe -> Dedza -> Ntcheu -> Blantyre
$ ./roads trace Mzuzu Salima     # step-by-step dry run
$ ./roads all Zomba              # distances from Zomba to every town
$ ./roads mst kruskal            # minimum spanning tree
$ ./roads                        # interactive menu
$ make test                      # run the 25 tests</pre>
</section>

<section>
<h2>5. Testing and dry run <span class="q">Q5 · 20 marks</span></h2>
<h3>Test strategy</h3>
<p>The tests in <code>tests/tests.cpp</code> cover four groups: (a) loading the graph, (b) known shortest routes worked out by hand, (c) an independent cross-check of every pair of towns against a different algorithm (Floyd–Warshall), and (d) error handling and edge cases. Each test prints its input, the expected output and the actual output. The table below was produced by running <code>make test</code>.</p>
<p class="result-line">${esc(summary)}</p>
<table class="tests"><thead><tr><th>ID</th><th>Test</th><th>Input</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>${testRows}</tbody></table>
<h3>Errors found during testing</h3>
<p>When the tests were first run, <b>5 of 25 failed</b> (T04, T06, T07, T09, T22). In every case the program was right and our hand calculation was wrong:</p>
<ul>
<li><b>T04 Lilongwe → Blantyre.</b> We expected the route through Balaka (330 km, which we had also mis-added as 305). The program found the direct Ntcheu–Blantyre road: 85 + 75 + 160 = 320 km.</li>
<li><b>T06/T07 Chitipa → Nsanje.</b> We expected the route to start Chitipa → Karonga → Rumphi (100 + 165 = 265 km) and missed the direct Chitipa–Rumphi road (230 km), which is 35 km shorter. The correct total is 1169 km.</li>
<li><b>T09 Mzuzu → Mangochi.</b> The route was right but we added the distances wrongly: 47 + 230 + 110 + 190 = 577 km, not 600.</li>
<li><b>T22 MST total.</b> We guessed the total before doing the Kruskal trace. The trace in section 7 gives 1889 km, and Prim gives the same.</li>
</ul>
<p>We trusted the program over our arithmetic only after test T10 showed that Dijkstra agrees with Floyd–Warshall for all 625 pairs and that every reconstructed path adds up to its reported distance. We then re-did the hand calculations and corrected the expected values. This shows why it is useful to test against an independent method rather than only against hand-worked examples.</p>
<p>Error cases (T11–T16) check that the program fails with a clear message instead of crashing: an unknown town (“Kampala”), wrong capitalisation, a negative distance, a non-numeric distance, the wrong separator and a missing data file. Edge cases (T17–T20) use small separate graphs: an island town with no road (Likoma) is reported as unreachable, a zero-length road is allowed, and when two roads join the same towns the shorter one is used.</p>

<h3>Dry run 1: Dedza → Zomba, tracing the priority queue</h3>
<p>This dry run follows the code line by line, showing the real contents of the priority queue, including the stale entries left behind by lazy deletion. Entries are written (town, distance) and the queue is shown sorted, smallest first.</p>
<table class="steps"><thead><tr><th>Iter.</th><th>Action</th><th>Relaxing each road of the settled town</th><th>Priority queue after</th></tr></thead><tbody>${DR.rows}</tbody></table>
<p><b>Result:</b> following prev[] back from Zomba gives ${DR.path.join(" → ")}, a distance of <b>${DR.dist} km</b>. The program prints the same:</p>
<pre class="code">$ ./roads path Dedza Zomba
${esc(execSync("./roads path Dedza Zomba", { cwd: ROOT }).toString())}</pre>

<h3>Dry run 2: program trace for Lilongwe → Blantyre</h3>
<p>The <code>trace</code> command prints the same steps the algorithm takes. It matches steps 1–15 of the hand run in section 3.</p>
<pre class="code">$ ./roads trace Lilongwe Blantyre
${esc(traceOut)}</pre>
</section>

<section>
<h2>6. Does the graph have a minimum spanning tree? <span class="q">Q6 · 10 marks</span></h2>
<p><b>Yes.</b> A spanning tree is a subset of the edges that connects all the vertices with no cycles; it has exactly |V| − 1 edges. A minimum spanning tree (MST) is a spanning tree with the smallest possible total weight. An undirected graph has a spanning tree if and only if it is <b>connected</b>, and then it also has a minimum one, because there are finitely many spanning trees and one of them must have the smallest total. Our graph is undirected, weighted and connected (section 2), so it has an MST.</p>
<p>The MST of our graph has <b>24 edges</b> and a total length of <b>${K.total} km</b>, compared with ${totalKm.toLocaleString()} km for all 38 roads. The other 14 roads (the cyclomatic number from section 2) each close a cycle and are not needed for connectivity.</p>
<figure class="map-fig">${M.drawMap(G, { mst: K.edges })}<figcaption>Figure 3. Minimum spanning tree (blue, ${K.total} km). Dashed roads are not in the MST.</figcaption></figure>
<p><b>The MST is unique.</b> Some roads have equal lengths (for example two roads of 45 km and two of 85 km), which can sometimes allow more than one MST. We checked every road that is not in the tree: in each case it is strictly longer than every road on the tree path between its two towns, so no swap gives an equal total. The MST is therefore the only one.</p>
<h3>What the MST represents</h3>
<p>The MST is the <b>cheapest set of roads that still connects every town</b> to every other town. In the Malawi context it answers questions such as:</p>
<ul>
<li><b>Road maintenance on a limited budget.</b> If the Roads Authority could only keep 24 roads in good condition, the MST keeps all 25 district centres reachable for the least total kilometres of road to maintain.</li>
<li><b>Laying infrastructure along roads.</b> ESCOM power lines, fibre-optic cable or water pipelines are usually laid along road reserves. Connecting all 25 towns along the MST needs ${K.total} km of cable instead of ${totalKm.toLocaleString()} km.</li>
<li><b>Emergency and relief logistics.</b> During floods in the Lower Shire (Chikwawa, Nsanje), the MST shows a minimal backbone that must stay open to keep every town connected.</li>
</ul>
<p><b>What the MST does not represent:</b> it is not a set of shortest routes. In the MST the only route from Lilongwe to Blantyre is ${mstPathLB.path}, which is <b>${mstPathLB.d} km</b>, compared with the 320 km found by Dijkstra. The MST minimises the total length of the whole network; Dijkstra minimises the length of one journey.</p>
</section>

<section>
<h2>7. Which MST algorithm we would use, and why <span class="q">Q7 · 10 marks</span></h2>
<table><thead><tr><th></th><th>Kruskal</th><th>Prim</th></tr></thead><tbody>
<tr><td>Idea</td><td>Sort all roads by length. Add each road unless it joins two towns that are already connected (it would make a cycle).</td><td>Start from one town. Repeatedly add the shortest road from the tree to a town not yet in the tree.</td></tr>
<tr><td>Data structure</td><td>Sorted edge list + union–find (disjoint sets)</td><td>Priority queue + adjacency list</td></tr>
<tr><td>Time</td><td>O(E log E)</td><td>O(E log V) with a binary heap; O(V²) with an array</td></tr>
<tr><td>Best for</td><td>Sparse graphs, data given as an edge list</td><td>Dense graphs, data given as an adjacency matrix</td></tr>
<tr><td>On our graph</td><td>38 × log₂38 ≈ 200 basic steps</td><td>38 × log₂25 ≈ 176 basic steps</td></tr>
</tbody></table>
<p><b>We would use Kruskal's algorithm</b>, for these reasons:</p>
<ol>
<li><b>The graph is sparse</b> (38 edges, density 0.13). Kruskal's cost depends on sorting the edges, which is cheap when there are few of them. The O(V²) array version of Prim, which suits dense graphs, would waste work here. For a graph this small the binary-heap versions of both algorithms are practically equal in speed, so the decision comes down to the next points.</li>
<li><b>Our data is already an edge list.</b> The file <code>malawi_roads.csv</code> is a list of roads with lengths, which is exactly Kruskal's input. No adjacency structure is needed.</li>
<li><b>It is easy to explain and check by hand.</b> Kruskal processes roads from shortest to longest and makes one yes/no decision for each, as in the trace below. This makes it easy to verify, and it matches how a planner would think: “build the cheapest links first, unless the towns are already connected”.</li>
<li><b>It handles a disconnected network gracefully.</b> If floods cut the network into pieces (test T18), Kruskal returns a minimum spanning forest, one tree per piece, without any change. Prim only builds the tree of the piece containing its start town.</li>
</ol>
<p>We implemented <b>both</b> algorithms to confirm the answer. Prim gives the same ${P.total} km total from every one of the 25 possible start towns (test T24).</p>
<h3>Kruskal trace on our graph</h3>
<table class="compact"><thead><tr><th>#</th><th>Road (sorted by length)</th><th>km</th><th>Decision</th></tr></thead><tbody>${kRows}</tbody></table>
<p>The tree is complete after 24 additions (the last is Karonga–Rumphi, 165 km). The algorithm still scans the remaining longer roads but none can be added. Total: <b>${K.total} km</b>.</p>
<h3>Prim's trace from Lilongwe (for comparison)</h3>
<table class="compact"><thead><tr><th>#</th><th>Cheapest road leaving the tree</th><th>km</th></tr></thead><tbody>${pRows}</tbody></table>
<p>Total: <b>${P.total} km</b>, the same tree as Kruskal, built in a different order.</p>
</section>

<section>
<h2>8. Deployment <span class="q">Q8 · 10 marks</span></h2>
<p>The work is deployed in two ways, so it can be tested with nothing to install.</p>
<h3>Web application (no installation)</h3>
<p>The same Dijkstra, Kruskal and Prim algorithms are written in JavaScript in <code>docs/graph.js</code> and run in the browser. The page is hosted free on GitHub Pages:</p>
<p class="result-line">${esc(DEMO_URL)}</p>
<ul>
<li><b>Shortest route:</b> choose any two towns. The page shows the distance, the route highlighted on the map, and the full step-by-step table of the algorithm with the queue after each step.</li>
<li><b>Spanning tree:</b> shows the MST on the map with the Kruskal decision table, or Prim's order.</li>
<li><b>Tests:</b> runs the same test cases as the C++ suite in the browser and shows pass or fail for each.</li>
</ul>
<h3>C++ program</h3>
<p>The C++ source is on GitHub at ${esc(GITHUB_URL)}. It can be run without installing anything by opening the repository in GitHub Codespaces (Code → Codespaces → Create), then running <code>make &amp;&amp; ./roads</code> in the terminal. Alternatively, <code>src/graph.hpp</code> and <code>src/main.cpp</code> can be pasted into an online C++ compiler such as OnlineGDB. On a machine with g++ the steps are:</p>
<pre class="code">git clone ${esc(GITHUB_URL)}.git
cd DSA
make && make test
./roads path Lilongwe Blantyre</pre>
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
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777">Malawi road network · DSA 2026 · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });
  await browser.close();
  console.log("wrote report/DSA_Report.pdf");
})();
