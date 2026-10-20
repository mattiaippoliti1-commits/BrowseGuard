"""Offline URL sanitation tests; no source or website requests are performed."""
import unittest
from build_corpus import clean_url, host_key, query_for


class CorpusTest(unittest.TestCase):
    def test_https_and_stable_homepage(self):
        self.assertEqual(clean_url('https://WWW.Example.com'), 'https://www.example.com/')
        self.assertEqual(clean_url('https://example.com/en/'), 'https://example.com/en/')
        self.assertEqual(host_key('WWW.Example.com.'), 'example.com')

    def test_rejects_nonpublic_literals_and_reserved_names(self):
        for url in ['https://127.0.0.1/', 'https://10.0.0.1/', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://router.local/', 'https://localhost/', 'https://site.test/']:
            with self.subTest(url=url):
                self.assertIsNone(clean_url(url))

    def test_credentials_tokens_fragments_and_sensitive_paths_rejected(self):
        for url in ['http://example.com/', 'https://u:p@example.com/', 'https://example.com/?token=test', 'https://example.com/#fragment', 'https://example.com/login', 'https://example.com/payment', 'https://example.com/software.exe', 'https://example.com:8443/']:
            with self.subTest(url=url):
                self.assertIsNone(clean_url(url))

    def test_provenance_query_uses_only_supplied_classes_and_official_site_property(self):
        query=query_for(['Q7397'])
        self.assertIn('wd:Q7397',query)
        self.assertIn('wdt:P856',query)
        self.assertIn('wdt:P31',query)
        self.assertIn('https://',query)


if __name__ == '__main__':
    unittest.main()
