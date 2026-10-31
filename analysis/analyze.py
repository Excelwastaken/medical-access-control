"""Independently summarize the repeated medical-access-control evaluation.

Python 3.10+, standard library only. No network or database access.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys

LOADS = {"low": 10, "med": 25, "high": 50}


def number(value, field, integer=False):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or value < 0
            or (integer and not isinstance(value, int))):
        raise ValueError(f"{field}: expected a finite non-negative {'integer' if integer else 'number'}")
    return value


def stats(values):
    return {"mean": round(statistics.mean(values), 2),
            "std": round(statistics.pstdev(values), 2),
            "min": min(values), "max": max(values)}


def analyze(data):
    if not isinstance(data, dict) or not isinstance(data.get("allRuns"), list) or not data["allRuns"]:
        raise ValueError("allRuns must be a non-empty list")
    runs = data["allRuns"]
    ids = set()
    scenarios = {key: 0 for key in ("S1_pass", "S2_pass", "S3_pass")}
    loads = {key: {"means": [], "tps": [], "successful": 0} for key in LOADS}
    for index, run in enumerate(runs):
        if not isinstance(run, dict):
            raise ValueError(f"allRuns[{index}] must be an object")
        run_id = number(run.get("run"), "run", integer=True)
        if run_id < 1 or run_id in ids:
            raise ValueError("run identifiers must be positive and unique")
        ids.add(run_id)
        for key in scenarios:
            if type(run.get(key)) is not bool:
                raise ValueError(f"run {run_id}: {key} must be boolean")
            scenarios[key] += int(run[key])
        number(run.get("S5_totalEventsOnChain"), "S5_totalEventsOnChain", integer=True)
        for level, requested in LOADS.items():
            batch = run.get(f"S4_{level}")
            if not isinstance(batch, dict):
                raise ValueError(f"run {run_id}: missing S4_{level}")
            n = number(batch.get("n"), f"S4_{level}.n", integer=True)
            if not 1 <= n <= requested:
                raise ValueError(f"S4_{level}.n must be between 1 and {requested}; empty batches lack usable timing statistics")
            for field in ("mean", "std", "min", "max", "tps"):
                number(batch.get(field), f"S4_{level}.{field}")
            if not batch["min"] <= batch["mean"] <= batch["max"]:
                raise ValueError(f"S4_{level}: expected min <= mean <= max")
            loads[level]["means"].append(batch["mean"])
            loads[level]["tps"].append(batch["tps"])
            loads[level]["successful"] += n
    count = len(runs)
    summary = {"repetitions": count,
               "ASR": scenarios["S1_pass"] / count,
               "DCR_forgedSignature": scenarios["S2_pass"] / count,
               "DCR_invalidRole": scenarios["S3_pass"] / count}
    for level in LOADS:
        summary[f"latency_{level}_ms"] = stats(loads[level]["means"])
        summary[f"tps_{level}"] = stats(loads[level]["tps"])
    mismatches = []
    existing = data.get("summary")
    if existing is not None:
        if not isinstance(existing, dict):
            raise ValueError("summary must be an object when present")
        for key, expected in summary.items():
            fields = expected.items() if isinstance(expected, dict) else [(None, expected)]
            for field, value in fields:
                actual = existing.get(key)
                if field is not None:
                    actual = actual.get(field) if isinstance(actual, dict) else None
                if (isinstance(actual, bool) or not isinstance(actual, (int, float))
                        or not math.isfinite(actual) or abs(actual - value) > 0.005000001):
                    mismatches.append(f"{key}{'.' + field if field else ''}")
    load_successes = sum(v["successful"] for v in loads.values())
    valid_count = count * (1 + sum(LOADS.values()))
    return {"summary": summary,
            "scenario_pass_counts": scenarios,
            "valid_requests": {"successful": scenarios["S1_pass"] + load_successes,
                               "requested": valid_count,
                               "success_rate": (scenarios["S1_pass"] + load_successes) / valid_count},
            "summary_comparison": {"available": existing is not None, "mismatched_fields": mismatches},
            "audit": {"completeness": None,
                      "reason": "Cumulative event counts do not establish request-to-event matching."},
            "checks_passed": not mismatches and all(v == count for v in scenarios.values())
                             and load_successes == count * sum(LOADS.values())}


def markdown(result):
    summary = result["summary"]
    valid = result["valid_requests"]
    lines = ["# Medical Access Control: Evaluation Analysis", "",
             f"Input SHA-256: `{result['input_sha256']}`", "",
             f"Repetitions: {summary['repetitions']}",
             f"S1 authorization success rate: {summary['ASR']:.2%}",
             f"S2 forged-signature denial rate: {summary['DCR_forgedSignature']:.2%}",
             f"S3 invalid-role denial rate: {summary['DCR_invalidRole']:.2%}",
             f"Valid-request success rate including load batches: {valid['success_rate']:.2%} "
             f"({valid['successful']}/{valid['requested']})", "",
             "| Load | Mean latency (ms) | SD across run means (ms) | Mean throughput (requests/s) |",
             "| --- | ---: | ---: | ---: |"]
    for level, requested in LOADS.items():
        latency = summary[f"latency_{level}_ms"]
        lines.append(f"| {level} ({requested} requests/run) | {latency['mean']:.2f} | "
                     f"{latency['std']:.2f} | {summary[f'tps_{level}']['mean']:.2f} |")
    comparison = result["summary_comparison"]
    status = (", ".join(comparison["mismatched_fields"]) or "All checked values match") if comparison["available"] else "Not provided"
    lines += ["", f"Stored summary comparison: {status}.", "",
              "## Interpretation and limitations", "",
              "Statistics are recomputed from rounded per-run summaries, not raw request timings. "
              "Standard deviation uses the population definition, matching the original harness. "
              "Latency dispersion describes variation between run means; it is not request-level dispersion.", "",
              "Request totals assume the unchanged harness design: one S1 request and batches of 10, 25, "
              "and 50 per run. Batch n counts successful requests. Latency statistics cover successful requests only. "
              "Throughput values are averaged across runs, not pooled across elapsed durations.", "",
              "S2/S3 rates reflect recorded denial flags, not an independent verification of denial causes. "
              "Expired-consent and replay tests are not represented in this input.", "",
              "Audit completeness: NOT ESTABLISHED. Cumulative event counts cannot prove that each "
              "authorized request has its own matching event. No audit-completeness percentage is inferred.", "",
              "These are historical single-node development-chain measurements. This analysis does not run "
              "new blockchain experiments or establish production performance.", "",
              f"Recorded scenario, batch-success and summary checks: {'PASS' if result['checks_passed'] else 'FAIL'}. "
              "This status is not a security certification or an audit-completeness result.", ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("analysis/output"))
    args = parser.parse_args()
    try:
        raw = args.input.read_bytes()
        result = analyze(json.loads(raw))
        result["input_sha256"] = hashlib.sha256(raw).hexdigest()
        args.output_dir.mkdir(parents=True, exist_ok=True)
        (args.output_dir / "report.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        (args.output_dir / "report.md").write_text(markdown(result), encoding="utf-8")
        print(f"Reports written to {args.output_dir}")
        return 0 if result["checks_passed"] else 1
    except (OSError, ValueError, TypeError, OverflowError) as error:
        print(f"Analysis failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
