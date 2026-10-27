# Blantyre City Road Network: Dijkstra and Minimum Spanning Tree

DSA 2026 assignment. A weighted, undirected graph of 23 places and 37 roads in Blantyre
city, from Limbe to Blantyre town (distances stored in metres, shown in km), with Dijkstra's shortest path algorithm and two minimum spanning tree
algorithms (Kruskal and Prim), implemented in C++17.

**Live demo (no installation):** open `docs/index.html`, or the GitHub Pages site for this repository.

## Build and run

```sh
make                              # builds ./roads and ./run_tests
./roads path "Blantyre CBD" Limbe   # shortest route
./roads trace Mandala Chichiri    # shortest route with a step-by-step dry run
./roads all Limbe                 # shortest distance from Limbe to every place
./roads mst kruskal               # minimum spanning tree (or: prim)
./roads places                    # list places
./roads                           # interactive menu
make test                         # run the 25 tests
```

Place names with spaces need quotes: `./roads path "Ginnery Corner" Limbe`.
Use another graph file with `./roads --data path/to/file.csv ...`.

## Layout

| Path | Contents |
|---|---|
| `data/blantyre_roads.csv` | The graph, one road per line: `place_a,place_b,metres` |
| `src/graph.hpp` | Graph (adjacency list), Dijkstra, Kruskal, Prim |
| `src/main.cpp` | Command line program |
| `tests/tests.cpp` | Test suite (prints input, expected and actual output for each test) |
| `docs/` | Web version (GitHub Pages). `graph.js` holds the data and algorithms, `app.html` the page; `node build.js` writes `docs/index.html` |
| `report/` | The PDF report and the script that generates it (`node report/build_report.js`, needs Playwright) |

## Deploying the web demo on GitHub Pages

Repository Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/docs`.
The site appears at `https://<account>.github.io/<repository>/`.

## Results

- Blantyre CBD → Limbe: 9.1 km (Blantyre CBD → Namiwawa → Ginnery Corner → Kanjedza → Limbe)
- Kameza → Bangwe: 15.0 km
- Minimum spanning tree: 22 roads, 39.3 km (out of 78.0 km for all roads)
