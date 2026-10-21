CXX ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra

all: roads run_tests

roads: src/main.cpp src/graph.hpp
	$(CXX) $(CXXFLAGS) -o roads src/main.cpp

run_tests: tests/tests.cpp src/graph.hpp
	$(CXX) $(CXXFLAGS) -o run_tests tests/tests.cpp

test: run_tests
	./run_tests

clean:
	rm -f roads run_tests

.PHONY: all test clean
