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
// Node numbers and areas as on the group's hand-drawn graph.
const NUM = {
  "Limbe Market": 1, "Limbe Health Centre": 2, "Liquid Lounge Roundabout": 3, MASM: 4, "Yanakis Roundabout": 5,
  "Reunion Insurance Roundabout": 6, "Independence Arch": 7, "Puma Energy Kanjedza": 8, "Automotive Products Limited": 9,
  "Chichiri Shopping Mall": 10, "St Columba": 11, "Kamba Pork Market": 12, "Stereo Night Club": 13, "Rosewood Mall": 14,
  "Red Cross Malawi": 15, Castel: 16, HHI: 17, "Blantyre Clock Tower": 18, Mandala: 19, "PA Nandos": 20,
  "CI Primary School": 21, "Blantyre Market": 22,
};
const AREA = (n) => (NUM[n] <= 8 && n !== "Independence Arch" ? "Limbe side" : NUM[n] <= 13 ? "Middle (Kanjedza to Chichiri)" : "Blantyre side");

// ---------- Q1 tables
const nodeRows = [...G.names.keys()].sort((a, b) => NUM[N(a)] - NUM[N(b)]).map((i) => `<tr><td class="num">${NUM[N(i)]}</td><td>${N(i)}</td><td>${AREA(N(i))}</td><td class="num">${deg[i]}</td>
  <td>${G.adj[i].map(([v, w]) => `${N(v)} (${km(w)} km)`).join(", ")}</td></tr>`).join("");
const edgeRows = G.edges.map((e, i) => `<tr><td class="num">E${i + 1}</td><td>${NUM[N(e.u)]} ${N(e.u)}</td><td>${NUM[N(e.v)]} ${N(e.v)}</td><td class="num">${km(e.w)}</td></tr>`);
const half = Math.ceil(edgeRows.length / 2);
const edgeTable = (rows) => `<table class="compact"><thead><tr><th>Edge</th><th>Place A</th><th>Place B</th><th>km</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
const maxDeg = Math.max(...deg);
const deg2 = G.names.filter((_, i) => deg[i] === 2);
const longest = G.edges.reduce((a, e) => (e.w > a.w ? e : a));
const shortest = G.edges.reduce((a, e) => (e.w < a.w ? e : a));

// ---------- Q3 full Dijkstra from Limbe Market
const SRC = G.index.get("Limbe Market"), LIMBE = G.index.get("Blantyre Market");
const full = M.dijkstra(G, SRC);
const stepRows = full.steps.map((st, i) => {
  const upd = st.relaxed.length ? st.relaxed.map(([v, o, n]) => `${N(v)}: ${km(o)} → <b>${km(n)}</b>`).join("<br>") : "no change";
  const q = st.frontier.map(([d, v]) => `${N(v)} ${km(d)}`).join(", ");
  return `<tr><td class="num">${i + 1}</td><td><b>${N(st.settled)}</b></td><td class="num">${km(st.d)}</td><td>${upd}</td><td class="small">${q || "(empty)"}</td></tr>`;
}).join("");
const finalRows = [...G.names.keys()].sort((a, b) => full.dist[a] - full.dist[b]).map((v) =>
  `<tr><td>${N(v)}</td><td class="num">${km(full.dist[v])}</td><td>${full.prev[v] < 0 ? "–" : N(full.prev[v])}</td>
   <td>${M.buildPath(full, v).map(N).join(" → ")}</td></tr>`).join("");
const sptEdges = G.names.map((_, v) => v).filter((v) => full.prev[v] >= 0).map((v) => ({ u: full.prev[v], v, w: 0 }));

// ---------- Q5 dry run: Red Cross Malawi -> Blantyre Clock Tower, showing the raw priority queue (with stale entries)
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
const DR = dryRun(G.index.get("Red Cross Malawi"), G.index.get("Blantyre Clock Tower"));

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
const traceOut = run('./roads trace "Limbe Market" "Blantyre Market"');
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


// ---------- figures: inline SVG for the PDF, PNG for the Word file
const FIGS = [];
function fig(id, svg, caption, cls = "wide") {
  FIGS.push({ id, svg });
  return `<figure class="map-fig ${cls}" data-fig="${id}">${svg}<figcaption>${caption}</figcaption></figure>`;
}
const iterOf = (() => {
  // which dry-run row first lowers the clock tower below the direct road
  const m = DR.rows.match(/<td class="num">(\d+)<\/td><td>pop \(PA Nandos/);
  return m ? m[1] : "?";
})();

const css = fs.readFileSync(path.join(__dirname, "report.css"), "utf8");
const body = `
<section class="cover">
  <p class="eyebrow">${COURSE} · 2026 Assignment</p>
  <h1>Shortest Routes and Minimum Spanning Tree on the Blantyre City Road Network, from Limbe Market to Blantyre Market</h1>
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
<p><b>Scenario.</b> The graph models the roads of Blantyre city between <b>Limbe Market</b> in the east of the city and <b>Blantyre Market</b> in Blantyre town. Each <b>vertex</b> is a well-known place along these roads: markets, roundabouts, shopping malls, landmarks and institutions such as Limbe Health Centre, Independence Arch, Chichiri Shopping Mall, Red Cross Malawi and the Blantyre Clock Tower. Each <b>edge</b> is a road that links two places directly, without passing through another place in the graph. The <b>weight</b> of an edge is the road distance between the two places in kilometres.</p>
<p>The vertices are numbered 1 to 22 from Limbe Market (1) to Blantyre Market (22). There are four main ways across the city:</p>
<ul>
<li>a <b>northern route</b> through Limbe Health Centre, St Columba and Stereo Night Club;</li>
<li>a <b>central route</b> through Puma Energy Kanjedza, Automotive Products Limited and Kamba Pork Market;</li>
<li>a <b>southern route</b> through Yanakis Roundabout, Reunion Insurance Roundabout, Independence Arch and Chichiri Shopping Mall;</li>
<li>a <b>fourth route</b> through Yanakis Roundabout, Reunion Insurance Roundabout, Independence Arch, Chichiri Shopping Mall, Castel, HHI, Blantyre Clock Tower and PA Nandos to Blantyre Market.</li>
</ul>
<p>Cross roads join the routes, so a traveller has many possible paths.</p>
<p>The graph is <b>undirected</b> because the roads carry traffic in both directions, so the distance from A to B equals the distance from B to A. It is <b>weighted</b> because the roads have different lengths, and it is <b>simple</b> (no road goes from a place back to itself, and there is at most one road between two places).</p>
<p>Distances are stored in the data file as whole metres (for example 0.45 km is stored as 450), and the program shows them in kilometres. Whole numbers avoid rounding errors when distances are added.</p>
<p>The graph has a total of ${V} vertices, ${E} edges, a total distance of ${km(totalM)} km and a shortest route of ${km(full.dist[LIMBE])} km from Limbe Market to Blantyre Market.</p>
<h3>Vertices and their neighbours</h3>
<table><thead><tr><th>No.</th><th>Place</th><th>Area</th><th>Degree</th><th>Neighbours (distance in km)</th></tr></thead><tbody>${nodeRows}</tbody></table>
<p class="small">Degree = the number of roads that meet at a place.</p>
<h3>Edges (weights in km)</h3>
<div class="two">${edgeTable(edgeRows.slice(0, half))}${edgeTable(edgeRows.slice(half))}</div>
</section>

<section>
<h2>2. Drawing and description of the graph <span class="q">Q2 · 10 marks</span></h2>
<p>Each place is drawn as a numbered circle (vertex) with its name beside it. Each road is a straight line (edge) between two circles. Because the graph is undirected, the lines have no arrowheads. The distance in km is written along each line. Limbe Market (1) is on the left and Blantyre Market (22) on the right.</p>
<figure class="photo"><img src="hand_drawn_graph.jpg" alt="Hand-drawn graph of the Blantyre city road network"><figcaption>Figure 1. Our hand-drawn graph, from Limbe Market (1) to Blantyre Market (22).</figcaption></figure>
${fig("fig2", M.drawMap(G, {}), `Figure 2. The same graph drawn by our program. Distances in km.`)}
<h3>Description</h3>
<ul>
<li><b>Connected:</b> you can get from any place to any other place, so the graph is in one piece.</li>
<li><b>Sparse (few roads):</b> with ${V} places, the most roads possible (every place joined to every other place) would be ${V} × ${V - 1} ÷ 2 = ${(V * (V - 1)) / 2}. Our graph has only ${E}, about ${Math.round((100 * E) / ((V * (V - 1)) / 2))}% of that. Road networks are usually like this. Because of this, the program stores, for each place, just a list of its neighbours (an adjacency list) instead of a big ${V} × ${V} table.</li>
<li><b>Degrees:</b> if you add up the degrees of all places you get ${2 * E}, which is twice the number of roads, because every road has two ends. On average a place has ${(2 * E / V).toFixed(2)} roads. Red Cross Malawi has the most roads (${maxDeg}): it is the hub where the central and southern routes meet before Blantyre. Liquid Lounge Roundabout, Automotive Products Limited and Chichiri Shopping Mall have 4 roads each. ${deg2.length} places have only 2 roads: ${deg2.join(", ")}.</li>
<li><b>Cycles (loops):</b> the graph has many loops, where you can leave a place and come back by a different road. For example: Limbe Market → Limbe Health Centre → Liquid Lounge Roundabout → Limbe Market (0.45 + 0.35 + 0.7 = 1.5 km), and Red Cross Malawi → Mandala → Blantyre Market → PA Nandos → Blantyre Clock Tower → Red Cross Malawi. Because there are ${E} roads and ${V} places, ${E} − ${V} + 1 = <b>${E - V + 1}</b> roads could be removed and every place would still be reachable (see the MST in section 6).</li>
<li><b>No single weak road:</b> if any one road is closed, for example for repairs, every place can still be reached by another route. This is because every road is part of a loop.</li>
<li><b>Longest and shortest roads:</b> ${N(longest.u)} to ${N(longest.v)} (${km(longest.w)} km) is the longest. ${N(shortest.u)} to ${N(shortest.v)} (${km(shortest.w)} km) is the shortest.</li>
</ul>
</section>

<section>
<h2>3. How Dijkstra's algorithm works on the graph <span class="q">Q3 · 15 marks</span></h2>
<p>Dijkstra's algorithm finds the shortest distance from one starting place to every other place. It works when no distance is negative, which is always true for roads.</p>
<p><b>The idea in plain words:</b></p>
<ol>
<li>Give the starting place a distance of 0. Give every other place a distance of ∞ (infinity), meaning “not reached yet”.</li>
<li>Pick the place with the smallest distance that is not finished yet. Mark it <b>finished</b>: its distance is now final and will never change.</li>
<li>Look at each road from that place. If going through it gives a neighbour a shorter distance than the one it has, write down the new, shorter distance and remember which place we came from.</li>
<li>Repeat steps 2 and 3 until every place is finished.</li>
</ol>
<p><b>Why a finished place never changes:</b> we always finish the closest unfinished place. Any other way to reach it would have to go through a place that is already further away, and since distances are never negative, that way cannot be shorter.</p>
<p>In the program, the unfinished places are kept in a <b>priority queue</b>, a list that always gives back the place with the smallest distance first.</p>
<pre class="code">DIJKSTRA(graph, start)
  set distance of every place to ∞ and previous place to none
  distance[start] = 0
  put (0, start) in the priority queue
  while the queue is not empty:
      take out the place u with the smallest distance
      if u is already finished: skip it (it is an old, out-of-date entry)
      mark u as finished
      for each road from u to v with length w:
          if v is not finished and distance[u] + w &lt; distance[v]:
              distance[v] = distance[u] + w
              previous[v] = u
              put (distance[v], v) in the queue</pre>
<h3>Worked example: all shortest routes from Limbe Market</h3>
<p>We start at Limbe Market. The table shows each of the ${V} steps: which place is finished, which neighbours got a shorter distance, and the distances of the places that are reached but not finished yet (smallest first, all in km).</p>
<table class="steps"><thead><tr><th>Step</th><th>Finish</th><th>Distance (km)</th><th>Shorter distances found (old → new)</th><th>Waiting places after the step</th></tr></thead><tbody>${stepRows}</tbody></table>
<p>Sometimes the algorithm finds a better way to a place it has already reached:</p>
<ul>
<li>In step 6, Puma Energy Kanjedza gives Independence Arch a distance of 1.7 + 2.9 = 4.6 km. In step 7, Reunion Insurance Roundabout finds a shorter way: 2.3 + 1.0 = 3.3 km.</li>
<li>In step 9, Automotive Products Limited lowers Chichiri Shopping Mall from 6.2 km to 3.3 + 1.5 = 4.8 km.</li>
<li>In step 12, Kamba Pork Market lowers Red Cross Malawi from 7.1 km (through Chichiri) to 5.8 + 1.2 = 7.0 km.</li>
</ul>
<p>Some steps, such as MASM in step 5, change nothing, because every neighbour already has a shorter distance.</p>
<h3>Result: shortest distances and routes from Limbe Market</h3>
<table><thead><tr><th>Place</th><th>Distance (km)</th><th>Previous place</th><th>Shortest route</th></tr></thead><tbody>${finalRows}</tbody></table>
<p>To read the route to a place, start at that place and follow the “previous place” column back to Limbe Market. For Blantyre Market: Blantyre Market ← Mandala ← Red Cross Malawi ← Kamba Pork Market ← Automotive Products Limited ← Puma Energy Kanjedza ← Liquid Lounge Roundabout ← Limbe Market. So the shortest route is:</p>
<p class="result-line">Limbe Market → Liquid Lounge Roundabout → Puma Energy Kanjedza → Automotive Products Limited → Kamba Pork Market → Red Cross Malawi → Mandala → Blantyre Market = 0.7 + 1.0 + 1.6 + 2.5 + 1.2 + 0.55 + 0.21 = ${km(full.dist[LIMBE])} km</p>
<p>Comparing with the other ways to Blantyre Market:</p>
<table><thead><tr><th>Way</th><th>Sum</th><th>Distance</th></tr></thead><tbody>
<tr><td>Central route: Limbe Market → Liquid Lounge Roundabout → Puma Energy Kanjedza → Automotive Products Limited → Kamba Pork Market → Red Cross Malawi → Mandala → Blantyre Market (shortest)</td><td>0.7 + 1.0 + 1.6 + 2.5 + 1.2 + 0.55 + 0.21</td><td class="num"><b>7.76 km</b></td></tr>
<tr><td>Same start, but through Chichiri Shopping Mall instead of Kamba Pork Market</td><td>0.7 + 1.0 + 1.6 + 1.5 + 2.3 + 0.55 + 0.21</td><td class="num">7.86 km</td></tr>
<tr><td>Northern route: Limbe Market → Limbe Health Centre → St Columba → Stereo Night Club → Rosewood Mall → Red Cross Malawi → Mandala → Blantyre Market</td><td>0.45 + 3.2 + 3.1 + 0.7 + 1.4 + 0.55 + 0.21</td><td class="num">9.61 km</td></tr>
<tr><td>Southern route: Limbe Market → Yanakis Roundabout → Reunion Insurance Roundabout → Independence Arch → Chichiri Shopping Mall → Red Cross Malawi → Mandala → Blantyre Market</td><td>1.2 + 1.1 + 1.0 + 2.9 + 2.3 + 0.55 + 0.21</td><td class="num">9.26 km</td></tr>
<tr><td>Fourth route: Limbe Market → Yanakis Roundabout → Reunion Insurance Roundabout → Independence Arch → Chichiri Shopping Mall → Castel → HHI → Blantyre Clock Tower → PA Nandos → Blantyre Market</td><td>1.2 + 1.1 + 1.0 + 2.9 + 1.9 + 1.4 + 2.5 + 1.2 + 1.2</td><td class="num">14.4 km</td></tr>
</tbody></table>
<p>The previous places together form a tree of shortest routes from Limbe Market (Figure 3).</p>
${fig("fig3", M.drawMap(G, { mst: sptEdges }), "Figure 3. Shortest routes from Limbe Market (blue). Dashed roads are not used by any shortest route from Limbe Market.")}
</section>

<section>
<h2>4. Implementation <span class="q">Q4 · 10 marks</span></h2>
<p>The program is written in <b>C++</b> (C++17) using only the standard library. The files are:</p>
<table><thead><tr><th>File</th><th>What it does</th></tr></thead><tbody>
<tr><td><code>data/blantyre_roads.csv</code></td><td>The graph: one road per line, written as <code>place_a,place_b,metres</code>.</td></tr>
<tr><td><code>src/graph.hpp</code></td><td>The graph, Dijkstra's algorithm, and the two MST algorithms (Kruskal and Prim).</td></tr>
<tr><td><code>src/main.cpp</code></td><td>The program you run: shortest route, step-by-step trace, distances from a place, MST, and a menu.</td></tr>
<tr><td><code>tests/tests.cpp</code></td><td>25 automatic tests (section 5).</td></tr>
<tr><td><code>docs/</code></td><td>The web version of the same algorithms in JavaScript (section 8).</td></tr>
<tr><td><code>Makefile</code></td><td><code>make</code> builds everything, <code>make test</code> runs the tests.</td></tr>
</tbody></table>
<h3>How it is built</h3>
<ul>
<li><b>Neighbour lists (adjacency list):</b> for each place the program keeps a list of (neighbour, distance) pairs. This uses little memory and lets Dijkstra look only at real roads. A full ${V} × ${V} table would have ${V * V} boxes for only ${E} roads.</li>
<li><b>Names to numbers:</b> each place name is given a number (0, 1, 2, …). The algorithms work with numbers because they are fast to look up, while the user types names.</li>
<li><b>Distances in whole metres:</b> 0.45 km is stored as 450 m. Adding whole numbers is always exact, so comparisons never go wrong because of rounding. Results are shown in km.</li>
<li><b>Priority queue:</b> C++'s <code>priority_queue</code> always gives back the place with the smallest distance. When a place gets a shorter distance it is simply added again; the old entry is skipped when it comes out. This keeps the code short. The running time grows roughly like (places + roads) × log(places), which is fast.</li>
<li><b>Rebuilding the route:</b> the <code>prev</code> list remembers where each place was reached from. Following it backwards from the destination and reversing gives the route.</li>
<li><b>Checking input:</b> the program rejects negative distances (Dijkstra does not work with them), roads from a place to itself, badly written lines, distances that are not whole numbers, missing files and unknown place names. If a place cannot be reached it says “No route”.</li>
</ul>
<h3>Main code: Dijkstra</h3>
<pre class="code">${dijkstraCode}</pre>
<h3>Building and running</h3>
<pre class="code">$ make                       # builds ./roads and ./run_tests
$ ./roads path "Limbe Market" "Blantyre Market"
${esc(run('./roads path "Limbe Market" "Blantyre Market"'))}$ ./roads trace "Red Cross Malawi" "Blantyre Clock Tower"   # step by step
$ ./roads all "Limbe Market"        # distances from Limbe Market to every place
$ ./roads mst kruskal               # minimum spanning tree
$ ./roads                           # menu
$ make test                         # run the 25 tests</pre>
</section>

<section>
<h2>5. Testing and dry run <span class="q">Q5 · 20 marks</span></h2>
<h3>What we tested</h3>
<p>The tests in <code>tests/tests.cpp</code> are in four groups:</p>
<ol>
<li>Loading the graph correctly.</li>
<li>Shortest routes that we worked out by hand.</li>
<li>Checking every pair of places against a different method (Floyd–Warshall), to make sure Dijkstra gives the same answer.</li>
<li>Wrong input and unusual cases.</li>
</ol>
<p>Each test shows its input, the expected output and the actual output. The table was produced by running <code>make test</code>.</p>
<p class="result-line">${esc(summary)}</p>
<table class="tests"><thead><tr><th>ID</th><th>Test</th><th>Input</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>${testRows}</tbody></table>
<h3>How we checked the expected answers</h3>
<p>For each route in tests T03 to T09 we worked out the answer by hand from the drawing and compared it with the other possible routes. For example, for T04 (Limbe Market → Blantyre Market) we compared the five ways in the table in section 3. Test T10 then checks all ${V * V} pairs of places against Floyd–Warshall, a completely different method, and checks that every route the program prints really adds up to the distance it reports. This catches mistakes in our hand working as well as in the code.</p>
<h3>Errors</h3>
<p>Tests T11 to T16 check that wrong input gives a clear message instead of a crash or a wrong answer. The program shows the same messages:</p>
<pre class="code">$ ./roads path "Limbe Market" Lilongwe
${esc(errOut('./roads path "Limbe Market" Lilongwe'))}$ ./roads path "limbe market" Mandala
${esc(errOut('./roads path "limbe market" Mandala'))}$ ./roads --data no_such_file.csv path "Limbe Market" Mandala
${esc(errOut('./roads --data no_such_file.csv path "Limbe Market" Mandala'))}</pre>
<p>Tests T17 to T20 use small separate graphs: a place with no road to the rest (Chileka, joined only to Lunzu) is reported as unreachable; a road of length 0 is allowed; and when two roads join the same two places, the shorter one is used. All tests passed, and no crashes or wrong results were found.</p>

<h3>Dry run 1: Red Cross Malawi → Blantyre Clock Tower</h3>
<p>This dry run follows the code line by line and shows exactly what is inside the priority queue after each step. Entries are written (place, distance in km), smallest first.</p>
<table class="steps"><thead><tr><th>Step</th><th>Action</th><th>Checking each road of the finished place</th><th>Priority queue after</th></tr></thead><tbody>${DR.rows.replace(/stale entry, skip/g, "old entry, skip")}</tbody></table>
<p>This example is interesting because the direct road from Red Cross Malawi to Blantyre Clock Tower (3.4 km) is <b>not</b> the shortest way. The clock tower first gets 3.4 km in step 1. In step ${iterOf}, the route through PA Nandos gives it ${km(DR.dist)} km. The old entry (Blantyre Clock Tower, 3.4) stays in the queue, but the clock tower is finished at ${km(DR.dist)} km before that old entry is ever taken out.</p>
<p><b>Result:</b> following the previous places back from Blantyre Clock Tower gives ${DR.path.join(" → ")}, a distance of <b>${km(DR.dist)} km</b>. The program prints the same:</p>
<pre class="code">$ ./roads path "Red Cross Malawi" "Blantyre Clock Tower"
${esc(run('./roads path "Red Cross Malawi" "Blantyre Clock Tower"'))}</pre>

<h3>Dry run 2: program trace for Limbe Market → Blantyre Market</h3>
<p>The <code>trace</code> command prints each step and stops once the destination is finished. It matches steps 1 to ${full.steps.findIndex((s) => s.settled === LIMBE) + 1} of the table in section 3.</p>
<pre class="code">$ ./roads trace "Limbe Market" "Blantyre Market"
${esc(traceOut)}</pre>
</section>

<section>
<h2>6. Does the graph have a minimum spanning tree? <span class="q">Q6 · 10 marks</span></h2>
<p><b>Yes.</b></p>
<p>A <b>spanning tree</b> is a set of roads that connects all the places, with no loops. With ${V} places it always has exactly ${V} − 1 = ${V - 1} roads. A <b>minimum spanning tree (MST)</b> is the spanning tree with the smallest total length.</p>
<p>A graph has a spanning tree when all its places are connected, and our graph is connected (section 2). There are only a limited number of possible spanning trees, so one of them must be the shortest. So our graph has an MST.</p>
<p>Our MST has <b>${K.edges.length} roads</b> with a total length of <b>${km(K.total)} km</b>, compared with ${km(totalM)} km for all ${E} roads. The other ${E - K.edges.length} roads each close a loop, so they are not needed to keep every place connected.</p>
${fig("fig4", M.drawMap(G, { mst: K.edges }), `Figure 4. Minimum spanning tree (blue, ${km(K.total)} km). Dashed roads are not in the MST.`)}
<p><b>There is only one MST.</b> Some roads have the same length (for example several roads of 1.0 km and of 1.2 km), and sometimes that allows two different MSTs with the same total. We checked every road that is not in the tree: each one is longer than every road on the tree path between its two ends, so swapping it in would always make the total longer.</p>
<h3>What the MST represents</h3>
<p>The MST is the <b>shortest total length of road that still connects every place</b>. For example, it does not use the direct road from Limbe Market to Liquid Lounge Roundabout (0.7 km), because the two places are already joined through Limbe Health Centre by shorter roads (0.45 + 0.35 km). In real life the MST answers questions like:</p>
<ul>
<li><b>Laying pipes or cables along the roads.</b> Water pipes, ESCOM power lines or internet cables are usually laid along roads. Connecting all ${V} places along the MST needs ${km(K.total)} km of pipe or cable instead of ${km(totalM)} km.</li>
<li><b>Road repairs on a small budget.</b> If Blantyre City Council could only maintain ${K.edges.length} roads, the MST keeps every place from Limbe Market to Blantyre Market reachable with the least road to look after.</li>
<li><b>Emergencies.</b> In heavy rain, when some roads flood, the MST is the smallest set of roads that must stay open so that every place, including Limbe Health Centre and Red Cross Malawi, can still be reached.</li>
</ul>
<p><b>What the MST is not:</b> it does not give the shortest route between two places. In the MST the only way from Limbe Market to Blantyre Market is ${mstPath.path}, which is <b>${km(mstPath.d)} km</b>, while Dijkstra found ${km(full.dist[LIMBE])} km. The MST keeps the <i>whole network</i> as short as possible; Dijkstra makes <i>one journey</i> as short as possible.</p>
</section>

<section>
<h2>7. Which MST algorithm we would use, and why <span class="q">Q7 · 10 marks</span></h2>
<table><thead><tr><th></th><th>Kruskal</th><th>Prim</th></tr></thead><tbody>
<tr><td>Idea</td><td>Sort all roads from shortest to longest. Take each road in turn, unless its two places are already connected (it would make a loop).</td><td>Start from one place. Keep adding the shortest road that leads from the tree to a new place.</td></tr>
<tr><td>What it needs</td><td>A list of roads, and a quick way to check whether two places are already connected (called union–find)</td><td>A priority queue and the neighbour lists</td></tr>
<tr><td>Speed</td><td>Mainly the time to sort the roads</td><td>Mainly the time to manage the priority queue</td></tr>
<tr><td>Best for</td><td>Graphs with few roads, stored as a list of roads</td><td>Graphs with very many roads, stored as a big table</td></tr>
</tbody></table>
<p><b>We would use Kruskal's algorithm</b>, because:</p>
<ol>
<li><b>Our graph has few roads</b> (${E} roads for ${V} places). Kruskal mostly just sorts the roads, which is quick when there are not many. For a graph this small both algorithms are fast, so the next reasons decide.</li>
<li><b>Our data is already a list of roads.</b> The file <code>blantyre_roads.csv</code> is exactly what Kruskal needs.</li>
<li><b>It is easy to do and check by hand.</b> You go through the roads from shortest to longest and answer one yes/no question for each, as in the table below. It is also how a planner would think: “build the cheapest links first, unless the two places are already connected”.</li>
<li><b>It still works if the network is broken into pieces.</b> If floods cut the city into parts (test T18), Kruskal gives a separate tree for each part. Prim only builds the tree for the part where it starts.</li>
</ol>
<p>We wrote <b>both</b> algorithms to check the answer. Prim gives the same total of ${km(P.total)} km from every one of the ${V} possible starting places (test T24).</p>
<h3>Kruskal step by step on our graph</h3>
<table class="compact"><thead><tr><th>#</th><th>Road (shortest first)</th><th>km</th><th>Decision</th></tr></thead><tbody>${kRows.replace(/skip: (.*?) and (.*?) already connected \(cycle\)/g, "skip: $1 and $2 are already connected (would make a loop)")}</tbody></table>
<p>The tree is complete after ${K.edges.length} roads are added (the last is ${N(lastAdded.u)} – ${N(lastAdded.v)}, ${km(lastAdded.w)} km). The remaining longer roads are all skipped. Total: <b>${km(K.total)} km</b>.</p>
<h3>Prim step by step from Limbe Market (for comparison)</h3>
<table class="compact"><thead><tr><th>#</th><th>Shortest road leaving the tree</th><th>km</th></tr></thead><tbody>${pRows}</tbody></table>
<p>Total: <b>${km(P.total)} km</b>, the same tree as Kruskal, built in a different order.</p>
</section>

<section>
<h2>8. Deployment <span class="q">Q8 · 10 marks</span></h2>
<p>The work can be tested in two ways, with nothing to install.</p>
<h3>Web application</h3>
<p>The same Dijkstra, Kruskal and Prim algorithms are written in JavaScript in <code>docs/graph.js</code> and run in any web browser. The page is hosted free on GitHub Pages:</p>
<p class="result-line">${esc(DEMO_URL)}</p>
<ul>
<li><b>Shortest route:</b> choose any two places. The page shows the distance, the route on the map, and the full step-by-step table of the algorithm.</li>
<li><b>Spanning tree:</b> shows the MST on the map with Kruskal's decisions, or Prim's order.</li>
<li><b>Tests:</b> runs the same tests as the C++ program and shows pass or fail for each.</li>
</ul>
<h3>C++ program</h3>
<p>The C++ code is on GitHub at ${esc(GITHUB_URL)}. To run it without installing anything, open the repository in GitHub Codespaces (Code → Codespaces → Create) and type <code>make &amp;&amp; ./roads</code> in the terminal. Or paste <code>src/graph.hpp</code> and <code>src/main.cpp</code> into an online C++ compiler such as OnlineGDB. On a computer with g++:</p>
<pre class="code">git clone ${esc(GITHUB_URL)}.git
cd DSA
make &amp;&amp; make test
./roads path "Limbe Market" "Blantyre Market"</pre>
</section>

<section class="appendix">
<h2>Appendix A: src/graph.hpp</h2><pre class="code small">${src("src/graph.hpp")}</pre>
<h2>Appendix B: src/main.cpp</h2><pre class="code small">${src("src/main.cpp")}</pre>
<h2>Appendix C: MST program output</h2><pre class="code small">$ ./roads mst kruskal
${esc(mstOut)}</pre>
</section>`;

const page = (inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Blantyre City Road Network – DSA Assignment</title>
<style>${css}</style></head><body>${inner}</body></html>`;
fs.writeFileSync(path.join(__dirname, "report.html"), page(body));
console.log("wrote report/report.html");

(async () => {
  let pw;
  try { pw = require("playwright"); } catch { pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }
  const browser = await pw.chromium.launch();
  const pg = await browser.newPage({ deviceScaleFactor: 2 });

  // PDF
  await pg.goto("file://" + path.join(__dirname, "report.html"));
  await pg.pdf({
    path: path.join(__dirname, "DSA_Report.pdf"), format: "A4", printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777">Blantyre city road network · DSA 2026 · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });
  console.log("wrote report/DSA_Report.pdf");

  // Figures as PNG for the Word version
  const figDir = path.join(__dirname, "figures");
  fs.mkdirSync(figDir, { recursive: true });
  for (const f of FIGS) {
    await pg.setViewportSize({ width: 1260, height: 640 });
    await pg.setContent(`<html><head><style>${css} body{margin:0;background:#fff} .map{width:1260px;height:auto}</style></head><body>${f.svg}</body></html>`);
    await (await pg.$("svg")).screenshot({ path: path.join(figDir, f.id + ".png") });
  }
  await browser.close();

  // Word version: same content, figures as images
  const docHtml = body.replace(/<figure class="map-fig[^"]*" data-fig="(\w+)">[\s\S]*?<\/svg>(<figcaption>[\s\S]*?<\/figcaption>)<\/figure>/g,
    (_, id, cap) => `<figure><img src="figures/${id}.png" style="width:16cm">${cap}</figure>`)
    .replace(/<span class="q">(.*?)<\/span>/g, " ($1)");
  // Column widths for the wide tables, so Word does not squeeze them
  const COLS = [
    ["<th>No.</th><th>Place</th><th>Area</th>", [6, 22, 17, 9, 46]],
    ["<th>Step</th><th>Finish</th>", [7, 18, 11, 30, 34]],
    ["<th>Place</th><th>Distance (km)</th><th>Previous place</th>", [20, 11, 18, 51]],
    ["<th>Way</th><th>Sum</th>", [50, 36, 14]],
    ["<th>ID</th><th>Test</th>", [6, 17, 20, 25, 25, 7]],
    ["<th>Step</th><th>Action</th>", [7, 18, 45, 30]],
    ["<th>File</th><th>What it does</th>", [30, 70]],
  ];
  let docFinal = docHtml;
  for (const [sig, w] of COLS)
    docFinal = docFinal.split("<table><thead><tr>" + sig).join(`<table><colgroup>${w.map((x) => `<col style="width:${x}%">`).join("")}</colgroup><thead><tr>` + sig)
      .split('<table class="steps"><thead><tr>' + sig).join(`<table><colgroup>${w.map((x) => `<col style="width:${x}%">`).join("")}</colgroup><thead><tr>` + sig)
      .split('<table class="tests"><thead><tr>' + sig).join(`<table><colgroup>${w.map((x) => `<col style="width:${x}%">`).join("")}</colgroup><thead><tr>` + sig);
  fs.writeFileSync(path.join(__dirname, "report_docx.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${docFinal}</body></html>`);
  execSync(`pandoc report_docx.html -f html -t docx --resource-path=. -o DSA_Report.docx`, { cwd: __dirname });
  fs.unlinkSync(path.join(__dirname, "report_docx.html"));
  console.log("wrote report/DSA_Report.docx");
})();
