// main.cpp - Command line program for the Blantyre city road network
// (Limbe to Blantyre place). Distances are stored in metres and shown in km.
//
// Usage:
//   roads [--data FILE] path   <From> <To>    shortest route between two places
//   roads [--data FILE] trace  <From> <To>    same, plus a step-by-step dry run of Dijkstra
//   roads [--data FILE] all    <From>         shortest distance to every place
//   roads [--data FILE] mst    [prim|kruskal] minimum spanning tree
//   roads [--data FILE] places                list the places
//   roads [--data FILE]                      interactive menu
#include <iomanip>
#include <iostream>
#include <sstream>

#include "graph.hpp"

using namespace mw;

// Metres to km, two decimals only when needed: 1000 -> "1.0", 450 -> "0.45".
static std::string km(long long m) {
    if (m >= INF) return "inf";
    std::ostringstream o;
    o << std::fixed << std::setprecision(2) << m / 1000.0;
    std::string s = o.str();
    if (s.back() == '0') s.pop_back();
    return s;
}

static void printPath(const Graph& g, const std::string& from, const std::string& to, bool withTrace) {
    int s = g.id(from), t = g.id(to);
    std::vector<TraceStep> trace;
    DijkstraResult r = dijkstra(g, s, withTrace ? &trace : nullptr);

    if (withTrace) {
        std::cout << "Dry run of Dijkstra from " << from << "\n";
        int step = 1;
        for (const TraceStep& st : trace) {
            std::cout << "Step " << std::setw(2) << step++ << ": settle " << g.name(st.settled)
                      << " (" << km(st.settledDist) << " km)";
            if (st.relaxed.empty()) std::cout << ", no updates";
            for (auto [v, oldD, newD] : st.relaxed)
                std::cout << "\n          update " << g.name(v) << ": " << km(oldD) << " -> " << km(newD);
            std::cout << "\n";
            if (st.settled == t) {
                std::cout << "Target " << to << " settled, so its distance is final.\n";
                break;
            }
        }
        std::cout << "\n";
    }

    std::vector<int> path = buildPath(r, t);
    if (path.empty()) {
        std::cout << "No route from " << from << " to " << to << "\n";
        return;
    }
    std::cout << "Shortest route " << from << " -> " << to << ": " << km(r.dist[t]) << " km\n";
    for (size_t i = 0; i < path.size(); ++i) {
        std::cout << (i ? " -> " : "  ") << g.name(path[i]);
    }
    std::cout << "\n";
}

static void printAll(const Graph& g, const std::string& from) {
    DijkstraResult r = dijkstra(g, g.id(from));
    std::cout << "Shortest distances from " << from << ":\n";
    for (int v = 0; v < g.size(); ++v) {
        std::cout << "  " << std::left << std::setw(29) << g.name(v) << std::right << std::setw(6)
                  << km(r.dist[v]) << " km   via ";
        std::vector<int> p = buildPath(r, v);
        for (size_t i = 0; i < p.size(); ++i) std::cout << (i ? " > " : "") << g.name(p[i]);
        std::cout << "\n";
    }
}

static void printMst(const Graph& g, const std::string& algo) {
    MstResult m;
    if (algo == "prim") m = prim(g);
    else if (algo == "kruskal") m = kruskal(g);
    else throw std::invalid_argument("MST algorithm must be prim or kruskal");
    std::cout << "Minimum spanning tree (" << algo << "), in the order edges were added:\n";
    for (const Edge& e : m.edges)
        std::cout << "  " << std::left << std::setw(29) << g.name(e.u) << " - " << std::setw(29) << g.name(e.v)
                  << std::right << std::setw(5) << km(e.w) << " km\n";
    std::cout << "Edges: " << m.edges.size() << ", total length: " << km(m.total) << " km"
              << (m.spanning ? "" : "  (graph is disconnected: this is a spanning forest)") << "\n";
}

static void printPlaces(const Graph& g) {
    std::cout << g.size() << " places, " << g.edges().size() << " roads\n";
    for (int v = 0; v < g.size(); ++v) std::cout << "  " << g.name(v) << "\n";
}

static void interactive(const Graph& g) {
    while (true) {
        std::cout << "\n1) Shortest route  2) Route with dry run  3) Distances from a place\n"
                     "4) MST (Prim)  5) MST (Kruskal)  6) List places  0) Quit\nChoice: ";
        std::string c;
        if (!std::getline(std::cin, c) || c == "0") return;
        try {
            std::string a, b;
            if (c == "1" || c == "2" || c == "3") {
                std::cout << "From place: ";
                std::getline(std::cin, a);
            }
            if (c == "1" || c == "2") {
                std::cout << "To place: ";
                std::getline(std::cin, b);
            }
            if (c == "1") printPath(g, a, b, false);
            else if (c == "2") printPath(g, a, b, true);
            else if (c == "3") printAll(g, a);
            else if (c == "4") printMst(g, "prim");
            else if (c == "5") printMst(g, "kruskal");
            else if (c == "6") printPlaces(g);
            else std::cout << "Unknown choice\n";
        } catch (const std::exception& e) {
            std::cout << "Error: " << e.what() << "\n";
        }
    }
}

int main(int argc, char** argv) {
    std::vector<std::string> args(argv + 1, argv + argc);
    std::string data = "data/blantyre_roads.csv";
    if (args.size() >= 2 && args[0] == "--data") {
        data = args[1];
        args.erase(args.begin(), args.begin() + 2);
    }
    try {
        Graph g = Graph::fromFile(data);
        if (args.empty()) interactive(g);
        else if (args[0] == "path" && args.size() == 3) printPath(g, args[1], args[2], false);
        else if (args[0] == "trace" && args.size() == 3) printPath(g, args[1], args[2], true);
        else if (args[0] == "all" && args.size() == 2) printAll(g, args[1]);
        else if (args[0] == "mst") printMst(g, args.size() > 1 ? args[1] : "kruskal");
        else if (args[0] == "places") printPlaces(g);
        else {
            std::cerr << "Usage: roads [--data FILE] path|trace <From> <To> | all <From> | mst [prim|kruskal] | places\n";
            return 2;
        }
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }
    return 0;
}
