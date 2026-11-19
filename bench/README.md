# Benchmarks

Run from the repository root:

```bash
dune exec bench/bench.exe
```

This writes:

- `bench/results.json` — machine-readable results;
- `bench/results.js` — the same results for the static dashboard.

Open `bench/dashboard.html` in a browser after a run.

## Adding a benchmark

Use `run_bench` in `bench/bench.ml`:

```ocaml
run_bench ~group:"Group" ~name:"thing" ~variant:"algorithm A"
  ~iterations:100_000 (fun n ->
    for _ = 1 to n do
      (* operation *)
    done)
```

To compare algorithms, use the same `group` and `name` with different
`variant` labels. The dashboard scales bars against the fastest variant and
shows ns/op and operations per second.

Use `~single:true` for one-shot measurements such as startup phases; the
dashboard shows those in milliseconds.

## Method

- Monotonic timing via `Mtime_clock.now_ns`.
- Warmup followed by the median of three repetitions for loop benchmarks.
- Inputs are prepared outside the timed loop.
- Single-shot startup phases are labelled explicitly.
- Results include OCaml version, commit, CPU model and process RSS.

See `docs/ALGORITHMS.md` for the algorithm rationale and benchmark analysis.
