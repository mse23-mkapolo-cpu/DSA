// tests.cpp - Test suite for the Malawi road network graph, Dijkstra and MST.
// Every test prints its input, expected output and actual output.
#include <iostream>
#include <sstream>

#include "../src/graph.hpp"

using namespace mw;

static int passed = 0, failed = 0;

static void check(const std::string& id, const std::string& input, const std::string& expected,
                  const std::string& actual) {
    bool ok = expected == actual;
    (ok ? passed : failed)++;
    std::cout << (ok ? "[PASS] " : "[FAIL] ") << id << "\n"
              << "       input:    " << input << "\n"
              << "       expected: " << expected << "\n"
              << "       actual:   " << actual << "\n";
}

static std::string pathStr(const Graph& g, const std::vector<int>& p) {
    if (p.empty()) return "(no path)";
    std::string s;
    for (size_t i = 0; i < p.size(); ++i) s += (i ? " > " : "") + g.name(p[i]);
    return s;
}

static std::string route(const Graph& g, const std::string& a, const std::string& b) {
    DijkstraResult r = dijkstra(g, g.id(a));
    int t = g.id(b);
    if (r.dist[t] >= INF) return "unreachable";
    return std::to_string(r.dist[t]) + " km: " + pathStr(g, buildPath(r, t));
}

template <class F>
static std::string errorOf(F f) {
    try {
        f();
        return "no error";
    } catch (const std::exception& e) {
        return std::string("error: ") + e.what();
    }
}

// Floyd-Warshall: an independent all-pairs algorithm used to cross-check Dijkstra.
static std::vector<std::vector<long long>> floyd(const Graph& g) {
    int n = g.size();
    std::vector<std::vector<long long>> d(n, std::vector<long long>(n, INF));
    for (int i = 0; i < n; ++i) d[i][i] = 0;
    for (const Edge& e : g.edges()) {
        d[e.u][e.v] = std::min(d[e.u][e.v], e.w);
        d[e.v][e.u] = std::min(d[e.v][e.u], e.w);
    }
    for (int k = 0; k < n; ++k)
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j)
                if (d[i][k] < INF && d[k][j] < INF) d[i][j] = std::min(d[i][j], d[i][k] + d[k][j]);
    return d;
}

int main(int argc, char** argv) {
    std::string data = argc > 1 ? argv[1] : "data/malawi_roads.csv";
    Graph g = Graph::fromFile(data);

    std::cout << "=== Loading the graph ===\n";
    check("T01 town and road count", data, "25 towns, 38 roads",
          std::to_string(g.size()) + " towns, " + std::to_string(g.edges().size()) + " roads");

    std::cout << "\n=== Dijkstra: shortest routes ===\n";
    check("T02 same start and end", "Lilongwe -> Lilongwe", "0 km: Lilongwe", route(g, "Lilongwe", "Lilongwe"));
    check("T03 direct neighbours", "Lilongwe -> Dedza", "85 km: Lilongwe > Dedza", route(g, "Lilongwe", "Dedza"));
    check("T04 capital to commercial city", "Lilongwe -> Blantyre",
          "320 km: Lilongwe > Dedza > Ntcheu > Blantyre", route(g, "Lilongwe", "Blantyre"));
    check("T05 indirect route beats direct road", "Ntcheu -> Zomba (Ntcheu > Blantyre > Zomba would be 225)",
          "145 km: Ntcheu > Balaka > Liwonde > Zomba", route(g, "Ntcheu", "Zomba"));
    check("T06 northern tip to southern tip", "Chitipa -> Nsanje",
          "1169 km: Chitipa > Rumphi > Mzuzu > Mzimba > Kasungu > Lilongwe > Dedza > Ntcheu > Blantyre > "
          "Chikwawa > Nsanje",
          route(g, "Chitipa", "Nsanje"));
    check("T07 symmetric (undirected)", "Nsanje -> Chitipa", "1169 km",
          route(g, "Nsanje", "Chitipa").substr(0, 7));
    check("T08 lakeshore route", "Nkhata Bay -> Salima",
          "340 km: Nkhata Bay > Nkhotakota > Salima", route(g, "Nkhata Bay", "Salima"));
    check("T09 north to lake south", "Mzuzu -> Mangochi",
          "577 km: Mzuzu > Nkhata Bay > Nkhotakota > Salima > Mangochi", route(g, "Mzuzu", "Mangochi"));

    std::cout << "\n=== Dijkstra cross-checked against Floyd-Warshall (all 625 pairs) ===\n";
    {
        auto fw = floyd(g);
        int mismatches = 0;
        for (int s = 0; s < g.size(); ++s) {
            DijkstraResult r = dijkstra(g, s);
            for (int t = 0; t < g.size(); ++t) {
                if (r.dist[t] != fw[s][t]) ++mismatches;
                // the rebuilt path must really add up to the distance
                std::vector<int> p = buildPath(r, t);
                long long sum = 0;
                for (size_t i = 1; i < p.size(); ++i)
                    for (auto [v, w] : g.neighbours(p[i - 1]))
                        if (v == p[i]) { sum += w; break; }
                if (sum != r.dist[t]) ++mismatches;
            }
        }
        check("T10 all pairs agree, all paths add up", "every source and target", "0 mismatches",
              std::to_string(mismatches) + " mismatches");
    }

    std::cout << "\n=== Errors and edge cases ===\n";
    check("T11 unknown town", "Lilongwe -> Kampala", "error: Unknown town: Kampala",
          errorOf([&] { route(g, "Lilongwe", "Kampala"); }));
    check("T12 town names are case sensitive", "lilongwe -> Dedza", "error: Unknown town: lilongwe",
          errorOf([&] { route(g, "lilongwe", "Dedza"); }));
    {
        Graph neg;
        check("T13 negative distance rejected", "addEdge(A, B, -5)",
              "error: Negative distance on road A - B: Dijkstra needs non-negative weights",
              errorOf([&] { neg.addEdge("A", "B", -5); }));
    }
    {
        std::istringstream bad("Lilongwe,Dedza,eighty\n");
        check("T14 non-numeric distance in file", "Lilongwe,Dedza,eighty", "error: Line 1: bad distance 'eighty'",
              errorOf([&] { Graph::fromCsv(bad); }));
    }
    {
        std::istringstream bad("Lilongwe;Dedza;85\n");
        check("T15 wrong separator in file", "Lilongwe;Dedza;85", "error: Line 1: expected town_a,town_b,km",
              errorOf([&] { Graph::fromCsv(bad); }));
    }
    check("T16 missing data file", "no_such_file.csv", "error: Cannot open no_such_file.csv",
          errorOf([&] { Graph::fromFile("no_such_file.csv"); }));
    {
        // Likoma island has no road link to the mainland: a disconnected graph.
        std::istringstream in("Lilongwe,Dedza,85\nLikoma,Chizumulu,10\n");
        Graph island = Graph::fromCsv(in);
        check("T17 unreachable town (island)", "Lilongwe -> Likoma", "unreachable", route(island, "Lilongwe", "Likoma"));
        MstResult f = kruskal(island);
        check("T18 MST of disconnected graph is a forest", "{Lilongwe-Dedza 85, Likoma-Chizumulu 10}",
              "2 edges, total 95, spanning=false",
              std::to_string(f.edges.size()) + " edges, total " + std::to_string(f.total) +
                  ", spanning=" + (f.spanning ? "true" : "false"));
    }
    {
        std::istringstream in("A,B,0\nB,C,4\nA,C,9\n");
        Graph z = Graph::fromCsv(in);
        check("T19 zero-weight road allowed", "A-B 0, B-C 4, A-C 9; A -> C", "4 km: A > B > C", route(z, "A", "C"));
    }
    {
        std::istringstream in("A,B,10\nA,B,3\n");
        Graph par = Graph::fromCsv(in);
        check("T20 parallel roads: shorter one used", "A-B 10 and A-B 3; A -> B", "3 km: A > B", route(par, "A", "B"));
    }

    std::cout << "\n=== Minimum spanning tree ===\n";
    MstResult k = kruskal(g), p = prim(g);
    check("T21 Kruskal MST size", "Malawi graph", "24 edges, spanning=true",
          std::to_string(k.edges.size()) + " edges, spanning=" + (k.spanning ? "true" : "false"));
    check("T22 Kruskal MST total", "Malawi graph", "1889 km", std::to_string(k.total) + " km");
    check("T23 Prim gives the same total", "Malawi graph, start at " + g.name(0), std::to_string(k.total) + " km",
          std::to_string(p.total) + " km");
    {
        int bestTotalMismatch = 0;
        for (int s = 0; s < g.size(); ++s)
            if (prim(g, s).total != k.total) ++bestTotalMismatch;
        check("T24 Prim from every start town", "25 different start towns", "0 mismatches",
              std::to_string(bestTotalMismatch) + " mismatches");
    }
    {
        // A spanning tree must connect every town: check with a DSU.
        DSU d(g.size());
        for (const Edge& e : k.edges) d.unite(e.u, e.v);
        int roots = 0;
        for (int v = 0; v < g.size(); ++v)
            if (d.find(v) == v) ++roots;
        check("T25 MST connects all towns", "Kruskal edges", "1 component", std::to_string(roots) + " component" +
              (roots == 1 ? "" : "s"));
    }

    std::cout << "\nSummary: " << passed << " passed, " << failed << " failed\n";
    return failed == 0 ? 0 : 1;
}
