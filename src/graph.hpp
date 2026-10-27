// graph.hpp - Weighted undirected graph of places in Blantyre city, with
// Dijkstra's shortest path and two Minimum Spanning Tree algorithms
// (Prim and Kruskal).
#pragma once

#include <algorithm>
#include <fstream>
#include <functional>
#include <limits>
#include <map>
#include <queue>
#include <sstream>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>

namespace mw {

const long long INF = std::numeric_limits<long long>::max() / 4;

struct Edge {
    int u, v;
    long long w;
};

class Graph {
public:
    // Add a place if it is new; return its index either way.
    int addNode(const std::string& name) {
        auto it = index_.find(name);
        if (it != index_.end()) return it->second;
        int id = static_cast<int>(names_.size());
        names_.push_back(name);
        index_[name] = id;
        adj_.emplace_back();
        return id;
    }

    void addEdge(const std::string& a, const std::string& b, long long w) {
        if (w < 0) throw std::invalid_argument("Negative distance on road " + a + " - " + b +
                                                ": Dijkstra needs non-negative weights");
        if (a == b) throw std::invalid_argument("Self loop on " + a + " is not allowed");
        int u = addNode(a), v = addNode(b);
        adj_[u].push_back({v, w});
        adj_[v].push_back({u, w});
        edges_.push_back({u, v, w});
    }

    // Load "place_a,place_b,metres" lines. Blank lines and lines starting with # are skipped.
    static Graph fromCsv(std::istream& in) {
        Graph g;
        std::string line;
        int lineNo = 0;
        while (std::getline(in, line)) {
            ++lineNo;
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line.empty() || line[0] == '#') continue;
            std::stringstream ss(line);
            std::string a, b, w;
            if (!std::getline(ss, a, ',') || !std::getline(ss, b, ',') || !std::getline(ss, w)) {
                throw std::runtime_error("Line " + std::to_string(lineNo) + ": expected place_a,place_b,metres");
            }
            long long metres;
            try {
                size_t used = 0;
                metres = std::stoll(w, &used);
                if (used != w.size()) throw std::invalid_argument("trailing");
            } catch (const std::exception&) {
                throw std::runtime_error("Line " + std::to_string(lineNo) + ": bad distance '" + w + "'");
            }
            g.addEdge(a, b, metres);
        }
        return g;
    }

    static Graph fromFile(const std::string& path) {
        std::ifstream f(path);
        if (!f) throw std::runtime_error("Cannot open " + path);
        return fromCsv(f);
    }

    int size() const { return static_cast<int>(names_.size()); }
    const std::vector<Edge>& edges() const { return edges_; }
    const std::string& name(int id) const { return names_.at(id); }
    const std::vector<std::pair<int, long long>>& neighbours(int u) const { return adj_.at(u); }

    int id(const std::string& name) const {
        auto it = index_.find(name);
        if (it == index_.end()) throw std::out_of_range("Unknown place: " + name);
        return it->second;
    }
    bool has(const std::string& name) const { return index_.count(name) > 0; }

private:
    std::vector<std::string> names_;
    std::map<std::string, int> index_;
    std::vector<std::vector<std::pair<int, long long>>> adj_;
    std::vector<Edge> edges_;
};

// ---------------------------------------------------------------- Dijkstra

struct DijkstraResult {
    std::vector<long long> dist;  // dist[v] = shortest distance in metres from source (INF if unreachable)
    std::vector<int> prev;        // prev[v] = previous place on the shortest path (-1 if none)
};

// One step of the algorithm, recorded for the dry run trace.
struct TraceStep {
    int settled;                                   // place removed from the queue and finalised
    long long settledDist;
    std::vector<std::tuple<int, long long, long long>> relaxed;  // (place, old dist, new dist)
};

// Dijkstra with a binary heap (std::priority_queue): O((V + E) log V).
inline DijkstraResult dijkstra(const Graph& g, int source, std::vector<TraceStep>* trace = nullptr) {
    int n = g.size();
    if (source < 0 || source >= n) throw std::out_of_range("Source index out of range");
    DijkstraResult r{std::vector<long long>(n, INF), std::vector<int>(n, -1)};
    std::vector<bool> done(n, false);
    using Item = std::pair<long long, int>;  // (distance, place)
    std::priority_queue<Item, std::vector<Item>, std::greater<Item>> pq;

    r.dist[source] = 0;
    pq.push({0, source});
    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();
        if (done[u]) continue;  // stale queue entry
        done[u] = true;
        TraceStep step{u, d, {}};
        for (auto [v, w] : g.neighbours(u)) {
            if (done[v]) continue;
            if (d + w < r.dist[v]) {
                step.relaxed.emplace_back(v, r.dist[v], d + w);
                r.dist[v] = d + w;
                r.prev[v] = u;
                pq.push({r.dist[v], v});
            }
        }
        if (trace) trace->push_back(step);
    }
    return r;
}

// Rebuild the path source -> target from prev[]. Empty if unreachable.
inline std::vector<int> buildPath(const DijkstraResult& r, int target) {
    std::vector<int> path;
    if (r.dist.at(target) >= INF) return path;
    for (int v = target; v != -1; v = r.prev[v]) path.push_back(v);
    std::reverse(path.begin(), path.end());
    return path;
}

// ---------------------------------------------------------------- MST

struct MstResult {
    std::vector<Edge> edges;
    long long total = 0;
    bool spanning = false;  // false if the graph is disconnected (then it is a forest)
};

// Disjoint Set Union with path compression and union by rank.
class DSU {
public:
    explicit DSU(int n) : parent_(n), rank_(n, 0) {
        for (int i = 0; i < n; ++i) parent_[i] = i;
    }
    int find(int x) { return parent_[x] == x ? x : parent_[x] = find(parent_[x]); }
    bool unite(int a, int b) {
        a = find(a);
        b = find(b);
        if (a == b) return false;
        if (rank_[a] < rank_[b]) std::swap(a, b);
        parent_[b] = a;
        if (rank_[a] == rank_[b]) ++rank_[a];
        return true;
    }

private:
    std::vector<int> parent_, rank_;
};

// Kruskal: sort edges by weight, add each edge that joins two different components. O(E log E).
inline MstResult kruskal(const Graph& g) {
    MstResult r;
    std::vector<Edge> es = g.edges();
    std::stable_sort(es.begin(), es.end(), [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(g.size());
    for (const Edge& e : es) {
        if (dsu.unite(e.u, e.v)) {
            r.edges.push_back(e);
            r.total += e.w;
        }
    }
    r.spanning = g.size() > 0 && static_cast<int>(r.edges.size()) == g.size() - 1;
    return r;
}

// Prim: grow one tree from `start`, always taking the cheapest edge leaving it. O(E log V).
inline MstResult prim(const Graph& g, int start = 0) {
    MstResult r;
    int n = g.size();
    if (n == 0) return r;
    std::vector<bool> inTree(n, false);
    using Item = std::tuple<long long, int, int>;  // (weight, from, to)
    std::priority_queue<Item, std::vector<Item>, std::greater<Item>> pq;
    pq.push({0, -1, start});
    while (!pq.empty()) {
        auto [w, from, to] = pq.top();
        pq.pop();
        if (inTree[to]) continue;
        inTree[to] = true;
        if (from != -1) {
            r.edges.push_back({from, to, w});
            r.total += w;
        }
        for (auto [v, wv] : g.neighbours(to))
            if (!inTree[v]) pq.push({wv, to, v});
    }
    r.spanning = static_cast<int>(r.edges.size()) == n - 1;
    return r;
}

}  // namespace mw
