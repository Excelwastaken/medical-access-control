import copy
import unittest

from analyze import analyze


def fixture():
    runs = []
    for i, mean in enumerate((2, 4), 1):
        run = {"run": i, "S1_pass": True, "S2_pass": True, "S3_pass": True,
               "S5_totalEventsOnChain": 1000 + i}
        for level, n in (("low", 10), ("med", 25), ("high", 50)):
            run[f"S4_{level}"] = {"n": n, "mean": mean, "std": 0,
                                    "min": mean, "max": mean, "tps": 100}
        runs.append(run)
    return {"allRuns": runs}


class AnalysisTests(unittest.TestCase):
    def test_known_population_statistics_and_audit_limit(self):
        result = analyze(fixture())
        self.assertEqual(result["summary"]["latency_low_ms"],
                         {"mean": 3, "std": 1, "min": 2, "max": 4})
        self.assertEqual(result["valid_requests"]["requested"], 172)
        self.assertEqual(result["valid_requests"]["success_rate"], 1)
        self.assertIsNone(result["audit"]["completeness"])
        self.assertTrue(result["checks_passed"])

    def test_partial_load_failure_is_not_hidden_by_successful_s1(self):
        data = fixture()
        data["allRuns"][0]["S4_low"]["n"] = 9
        result = analyze(data)
        self.assertEqual(result["summary"]["ASR"], 1)
        self.assertAlmostEqual(result["valid_requests"]["success_rate"], 171 / 172)
        self.assertFalse(result["checks_passed"])

    def test_scenario_failure(self):
        data = fixture()
        data["allRuns"][0]["S2_pass"] = False
        result = analyze(data)
        self.assertEqual(result["summary"]["DCR_forgedSignature"], 0.5)
        self.assertFalse(result["checks_passed"])

    def test_summary_checked_independently(self):
        data = fixture()
        data["summary"] = copy.deepcopy(analyze(data)["summary"])
        self.assertTrue(analyze(data)["checks_passed"])
        data["summary"]["latency_low_ms"]["std"] = 99
        result = analyze(data)
        self.assertEqual(result["summary_comparison"]["mismatched_fields"], ["latency_low_ms.std"])
        self.assertFalse(result["checks_passed"])

    def test_invalid_inputs(self):
        cases = [None, {}, {"allRuns": []}]
        for field, value in (("n", 0), ("n", 11), ("n", True),
                             ("mean", float("nan")), ("tps", -1), ("std", float("inf"))):
            data = fixture()
            data["allRuns"][0]["S4_low"][field] = value
            cases.append(data)
        data = fixture()
        data["allRuns"][0]["S1_pass"] = "true"
        cases.append(data)
        data = fixture()
        data["allRuns"][1]["run"] = 1
        cases.append(data)
        for data in cases:
            with self.subTest(data=data), self.assertRaises(ValueError):
                analyze(data)


if __name__ == "__main__":
    unittest.main()
