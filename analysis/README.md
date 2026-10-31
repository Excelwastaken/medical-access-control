# Research evaluation analysis

Python 3.10+; no third-party dependencies. Run commands from the repository root.

```sh
python3 -m unittest discover -s analysis/tests -t analysis -v
python3 analysis/analyze.py backend/evaluation-results-repeated.json --output-dir analysis/output
```

Outputs: `analysis/output/report.md` (English report) and `report.json` (machine-readable results).
Generated output and Python caches are ignored by Git.

The supported input is the repeated evaluation harness format (`allRuns`, optional `summary`).
This does not accept the different single-run evaluation format.
The analyzer independently recalculates summary statistics using population standard deviation
and compares them with an optional stored summary (absolute tolerance 0.005 for rounding).
It includes every run, including warm-up; it does not remove outliers.

The batch sizes are fixed to the current harness: 10/25/50 requests.
The `n` field represents successful requests, not attempted requests. S1-only ASR is reported
separately from the success rate including load requests. Non-empty batch summaries are required;
an empty successful batch has no meaningful latency statistics and is rejected.

This analyzes historical recorded results; it does not run the medical system or verify signatures.
It cannot establish request-level audit completeness, replay/expiry protection, raw latency
percentiles, or production performance. Event counts are never converted into audit completeness.
The report includes the SHA-256 of the input for provenance.

Exit codes: 0 = recorded scenarios, batch success counts and available summary checks pass;
1 = a recorded scenario/load failure or summary mismatch; 2 = invalid input or file error.
An exit code of 0 does not establish audit completeness or overall system security.

## Docker

Build from the repository root. The build runs the unit tests before producing the runtime image.
Only analyzer code is packaged; experimental inputs are supplied at runtime.

```sh
docker build --progress=plain -t medical-access-analysis:assignment5 analysis
mkdir -p analysis/output
docker run --rm --network none --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$(pwd)/backend/evaluation-results-repeated.json,target=/data/results.json,readonly" \
  --mount "type=bind,source=$(pwd)/analysis/output,target=/output" \
  medical-access-analysis:assignment5
```

The host-user override lets the container write to the mounted output folder, including on Linux.
The image otherwise defaults to non-root UID/GID 10001. It requires no runtime network access.
The multi-platform Python base image is pinned by digest; refresh that digest deliberately
when updating the runtime and rerun the checks. Architecture and host resources still affect timing
in new experiments; packaging does not make historical measurements production benchmarks.

## Jenkins

The root Jenkinsfile runs tests, builds the image, analyzes the recorded results and archives reports.
See [local Jenkins setup](jenkins/README.md) for launch, login and GitHub CI configuration.
Local snapshot mode requires manual builds; automatic GitHub execution requires publication and SCM configuration.
