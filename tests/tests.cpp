// tests.cpp - Test suite for the Blantyre city road network graph, Dijkstra and MST.
// Every test prints its input, expected output and actual output.
#include <iomanip>
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

// Metres to km, two decimals only when needed: 1000 -> "1.0 km", 450 -> "0.45 km".
static std::string km(long long m) {
    std::ostringstream o;
    o << std::fixed << std::setprecision(2) << m / 1000.0;
    std::string s = o.str();
    if (s.back() == '0') s.pop_back();
    return s + " km";
}

static std::string route(const Graph& g, const std::string& a, const std::string& b) {
    DijkstraResult r = dijkstra(g, g.id(a));
    int t = g.id(b);
    if (r.dist[t] >= INF) return "unreachable";
    return km(r.dist[t]) + ": " + pathStr(g, buildPath(r, t));
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
    std::string data = argc > 1 ? argv[1] : "data/blantyre_roads.csv";
    Graph g = Graph::fromFile(data);

    std::cout << "=== Loading the graph ===\n";
    check("T01 place and road count", data, "22 places, 32 roads",
          std::to_string(g.size()) + " places, " + std::to_string(g.edges().size()) + " roads");

    std::cout << "\n=== Dijkstra: shortest routes ===\n";
    check("T02 same start and end", "Mandala -> Mandala", "0.0 km: Mandala", route(g, "Mandala", "Mandala"));
    check("T03 direct neighbours", "Mandala -> Blantyre Market", "0.21 km: Mandala > Blantyre Market",
          route(g, "Mandala", "Blantyre Market"));
    check("T04 Limbe Market to Blantyre Market", "Limbe Market -> Blantyre Market",
          "7.76 km: Limbe Market > Liquid Lounge Roundabout > Puma Energy Kanjedza > Automotive Products Limited > "
          "Kamba Pork Market > Red Cross Malawi > Mandala > Blantyre Market",
          route(g, "Limbe Market", "Blantyre Market"));
    check("T05 Limbe Market to Chichiri", "Limbe Market -> Chichiri Shopping Mall",
          "4.8 km: Limbe Market > Liquid Lounge Roundabout > Puma Energy Kanjedza > Automotive Products Limited > "
          "Chichiri Shopping Mall",
          route(g, "Limbe Market", "Chichiri Shopping Mall"));
    check("T06 southern route", "Yanakis Roundabout -> HHI",
          "8.3 km: Yanakis Roundabout > Reunion Insurance Roundabout > Independence Arch > Chichiri Shopping Mall > "
          "Castel > HHI",
          route(g, "Yanakis Roundabout", "HHI"));
    check("T07 symmetric (undirected)", "Blantyre Market -> Limbe Market", "7.76 km",
          route(g, "Blantyre Market", "Limbe Market").substr(0, 7));
    check("T08 northern start", "St Columba -> Mandala",
          "5.1 km: St Columba > Automotive Products Limited > Kamba Pork Market > Red Cross Malawi > Mandala",
          route(g, "St Columba", "Mandala"));
    check("T09 south to north-east", "Reunion Insurance Roundabout -> Stereo Night Club",
          "7.7 km: Reunion Insurance Roundabout > Independence Arch > Chichiri Shopping Mall > Red Cross Malawi > "
          "Kamba Pork Market > Stereo Night Club",
          route(g, "Reunion Insurance Roundabout", "Stereo Night Club"));

    std::cout << "\n=== Dijkstra cross-checked against Floyd-Warshall (all 484 pairs) ===\n";
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
    check("T11 unknown place", "Limbe Market -> Lilongwe", "error: Unknown place: Lilongwe",
          errorOf([&] { route(g, "Limbe Market", "Lilongwe"); }));
    check("T12 place names are case sensitive", "limbe market -> Mandala", "error: Unknown place: limbe market",
          errorOf([&] { route(g, "limbe market", "Mandala"); }));
    {
        Graph neg;
        check("T13 negative distance rejected", "addEdge(A, B, -500)",
              "error: Negative distance on road A - B: Dijkstra needs non-negative weights",
              errorOf([&] { neg.addEdge("A", "B", -500); }));
    }
    {
        std::istringstream bad("Mandala,Blantyre Market,0.21km\n");
        check("T14 distance not in whole metres", "Mandala,Blantyre Market,0.21km",
              "error: Line 1: bad distance '0.21km'",
              errorOf([&] { Graph::fromCsv(bad); }));
    }
    {
        std::istringstream bad("Mandala;Blantyre Market;210\n");
        check("T15 wrong separator in file", "Mandala;Blantyre Market;210", "error: Line 1: expected place_a,place_b,metres",
              errorOf([&] { Graph::fromCsv(bad); }));
    }
    check("T16 missing data file", "no_such_file.csv", "error: Cannot open no_such_file.csv",
          errorOf([&] { Graph::fromFile("no_such_file.csv"); }));
    {
        // Chileka and Lunzu are linked to each other but not to the rest: a disconnected graph.
        std::istringstream in("Limbe,Bangwe,2800\nChileka,Lunzu,9000\n");
        Graph split = Graph::fromCsv(in);
        check("T17 unreachable place", "Limbe -> Chileka", "unreachable", route(split, "Limbe", "Chileka"));
        MstResult f = kruskal(split);
        check("T18 MST of disconnected graph is a forest", "{Limbe-Bangwe 2800, Chileka-Lunzu 9000}",
              "2 edges, total 11.8 km, spanning=false",
              std::to_string(f.edges.size()) + " edges, total " + km(f.total) +
                  ", spanning=" + (f.spanning ? "true" : "false"));
    }
    {
        std::istringstream in("A,B,0\nB,C,400\nA,C,900\n");
        Graph z = Graph::fromCsv(in);
        check("T19 zero-length road allowed", "A-B 0, B-C 400, A-C 900; A -> C", "0.4 km: A > B > C", route(z, "A", "C"));
    }
    {
        std::istringstream in("A,B,1000\nA,B,300\n");
        Graph par = Graph::fromCsv(in);
        check("T20 parallel roads: shorter one used", "A-B 1000 and A-B 300; A -> B", "0.3 km: A > B",
              route(par, "A", "B"));
    }

    std::cout << "\n=== Minimum spanning tree ===\n";
    MstResult k = kruskal(g), p = prim(g);
    check("T21 Kruskal MST size", "Blantyre graph", "21 edges, spanning=true",
          std::to_string(k.edges.size()) + " edges, spanning=" + (k.spanning ? "true" : "false"));
    check("T22 Kruskal MST total", "Blantyre graph", "20.66 km", km(k.total));
    check("T23 Prim gives the same total", "Blantyre graph, start at " + g.name(0), km(k.total), km(p.total));
    {
        int mismatch = 0;
        for (int s = 0; s < g.size(); ++s)
            if (prim(g, s).total != k.total) ++mismatch;
        check("T24 Prim from every start place", "22 different start places", "0 mismatches",
              std::to_string(mismatch) + " mismatches");
    }
    {
        // A spanning tree must connect every place: check with a DSU.
        DSU d(g.size());
        for (const Edge& e : k.edges) d.unite(e.u, e.v);
        int roots = 0;
        for (int v = 0; v < g.size(); ++v)
            if (d.find(v) == v) ++roots;
        check("T25 MST connects all places", "Kruskal edges", "1 component",
              std::to_string(roots) + " component" + (roots == 1 ? "" : "s"));
    }

    std::cout << "\nSummary: " << passed << " passed, " << failed << " failed\n";
    return failed == 0 ? 0 : 1;
}
