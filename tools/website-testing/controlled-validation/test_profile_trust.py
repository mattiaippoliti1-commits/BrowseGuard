import hashlib
from pathlib import Path
import sqlite3
import ssl
import subprocess
import tempfile
import unittest
from profile_trust import seed


class ProfileTrustTest(unittest.TestCase):
    def test_unknown_chromium_version_refused(self):
        with self.assertRaisesRegex(ValueError, 'only for Chromium 145'):
            seed('/does/not/matter', '/not/read', 146)

    def test_nonempty_or_non_disposable_profile_refused(self):
        with tempfile.TemporaryDirectory(prefix='bg-controlled-profile-') as directory:
            (Path(directory) / 'existing-user-data').write_text('keep')
            with self.assertRaisesRegex(ValueError, 'empty disposable'):
                seed(directory, '/not/read', 145)
            self.assertEqual((Path(directory) / 'existing-user-data').read_text(), 'keep')
        with tempfile.TemporaryDirectory(prefix='ordinary-profile-') as directory:
            with self.assertRaisesRegex(ValueError, 'empty disposable'):
                seed(directory, '/not/read', 145)

    def test_schema_and_constraints_without_system_trust_mutation(self):
        with tempfile.TemporaryDirectory(prefix='bg-controlled-tls-unit-') as material, tempfile.TemporaryDirectory(prefix='bg-controlled-profile-') as profile:
            material = Path(material)
            cert = material / 'root.crt'
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=Unit fixture CA', '-keyout', str(material / 'root.key'), '-out', str(cert)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            expected_hash = hashlib.sha256(ssl.PEM_cert_to_DER_cert(cert.read_text())).hexdigest()
            self.assertEqual(seed(profile, cert, 145), expected_hash)
            with sqlite3.connect(Path(profile) / 'Default' / 'ServerCertificate') as connection:
                self.assertEqual(dict(connection.execute('SELECT key,value FROM meta')), {'version': '1', 'last_compatible_version': '1'})
                row = connection.execute('SELECT sha256hash_hex,trust_settings FROM certificates').fetchone()
                self.assertEqual(row[0], expected_hash)
                # Literal protobuf specification: trusted(3), localhost + 127.0.0.1/32.
                self.assertEqual(row[1].hex(), '0a02080312150a096c6f63616c686f73741a080a047f0000011020')
            with self.assertRaisesRegex(ValueError, 'empty disposable'):
                seed(profile, cert, 145)


if __name__ == '__main__':
    unittest.main()
