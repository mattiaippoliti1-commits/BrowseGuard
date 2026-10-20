import unittest
from summarize import summarize


class ControlledSummaryTest(unittest.TestCase):
    def test_denominators_and_non_pass_statuses(self):
        rows = [{'id': str(n), 'category': 'transport', 'status': status}
                for n, status in enumerate(['PASS', 'FAIL', 'NOT_OBSERVABLE', 'INCONCLUSIVE', 'SKIPPED'])]
        result = summarize({'kind': 'controlled-validation', 'scenarios': rows})
        self.assertEqual(result['denominators'], {'all_recorded': 5, 'executed': 4})
        self.assertEqual(result['pass_percent_all'], 20)
        self.assertEqual(result['pass_percent_executed'], 25)
        self.assertEqual(result['counts']['FAIL'], 1)
        self.assertEqual(result['categories']['transport']['NOT_OBSERVABLE'], 1)

    def test_empty_results(self):
        result = summarize({'kind': 'controlled-validation', 'scenarios': []})
        self.assertIsNone(result['pass_percent_executed'])

    def test_rejects_public_schema_and_unknown_status(self):
        with self.assertRaises(ValueError):
            summarize({'kind': 'benchmark'})
        with self.assertRaises(ValueError):
            summarize({'kind': 'controlled-validation', 'scenarios': [{'id': 'S01', 'status': 'ok'}]})

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            summarize({'kind': 'controlled-validation', 'scenarios': [{'id': 'S01', 'status': 'PASS'}] * 2})


if __name__ == '__main__':
    unittest.main()
