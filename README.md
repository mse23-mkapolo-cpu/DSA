# Malawi Road Network: Dijkstra and Minimum Spanning Tree

DSA 2026 assignment. A weighted, undirected graph of 25 Malawian towns and 38 roads
(distances in km), with Dijkstra's shortest path algorithm and two minimum spanning tree
algorithms (Kruskal and Prim), implemented in C++17.

**Live demo (no installation):** open `docs/index.html`, or the GitHub Pages site for this repository.

## Build and run

```sh
make                              # builds ./roads and ./run_tests
./roads path Lilongwe Blantyre    # shortest route
./roads trace Lilongwe Blantyre   # shortest route with a step-by-step dry run
./roads all Zomba                 # shortest distance from Zomba to every town
./roads mst kruskal               # minimum spanning tree (or: prim)
./roads towns                     # list towns
./roads                           # interactive menu
make test                         # run the 25 tests
```

Town names with spaces need quotes: `./roads path "Nkhata Bay" Salima`.
Use another graph file with `./roads --data path/to/file.csv ...`.

## Layout

| Path | Contents |
|---|---|
| `data/malawi_roads.csv` | The graph, one road per line: `town_a,town_b,km` |
| `src/graph.hpp` | Graph (adjacency list), Dijkstra, Kruskal, Prim |
| `src/main.cpp` | Command line program |
| `tests/tests.cpp` | Test suite (prints input, expected and actual output for each test) |
| `docs/` | Web version (GitHub Pages). `graph.js` holds the data and algorithms, `app.html` the page; `node build.js` writes `docs/index.html` |
| `report/` | The PDF report and the script that generates it (`node report/build_report.js`, needs Playwright) |

## Deploying the web demo on GitHub Pages

Repository Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/docs`.
The site appears at `https://<account>.github.io/<repository>/`.

## Results

- Lilongwe → Blantyre: 320 km (Lilongwe → Dedza → Ntcheu → Blantyre)
- Chitipa → Nsanje: 1169 km
- Minimum spanning tree: 24 roads, 1889 km (out of 3854 km for all roads)
