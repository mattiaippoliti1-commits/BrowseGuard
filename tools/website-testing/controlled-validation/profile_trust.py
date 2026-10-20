#!/usr/bin/env python3
"""Seed one constrained root into a fresh, disposable Chromium 145 profile.

Verified against Chromium 145.0.7632.6 ServerCertificateDatabase schema v1 and
CertificateMetadata protobuf. This is a user trust anchor, not a verifier bypass.
Never writes the macOS Keychain, an existing profile, or a browser in use.
"""
import argparse
import hashlib
import os
from pathlib import Path
import sqlite3
import ssl
import tempfile


def metadata():
    # CertificateMetadata.trust(1) -> CertificateTrust.trust_type(1) = TRUSTED(3).
    trust = bytes.fromhex('0a020803')
    # Constraints.dns_names(1) = localhost; CIDRs(3) = 127.0.0.1/32.
    constraints = b'\x0a\x09localhost' + bytes.fromhex('1a080a047f0000011020')
    return trust + bytes([0x12, len(constraints)]) + constraints


def seed(profile, ca, major):
    profile, ca = Path(profile), Path(ca)
    if major != 145:
        raise ValueError('Profile trust schema verified only for Chromium 145; refuse unknown browser version')
    if (profile.is_symlink() or profile.resolve().parent != Path(tempfile.gettempdir()).resolve()
            or not profile.name.startswith('bg-controlled-profile-') or not profile.is_dir()
            or any(profile.iterdir())):
        raise ValueError('Trust seeding requires an empty disposable bg-controlled-profile-* directory')
    der = ssl.PEM_cert_to_DER_cert(ca.read_text())
    default = profile / 'Default'
    default.mkdir(mode=0o700)
    db = default / 'ServerCertificate'
    with sqlite3.connect(db) as connection:
        connection.execute('CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR)')
        connection.executemany('INSERT INTO meta VALUES (?,?)', [('version', '1'), ('last_compatible_version', '1')])
        connection.execute('CREATE TABLE certificates(sha256hash_hex TEXT PRIMARY KEY,der_cert BLOB NOT NULL,trust_settings BLOB NOT NULL)')
        connection.execute('INSERT INTO certificates VALUES (?,?,?)', (hashlib.sha256(der).hexdigest(), der, metadata()))
    os.chmod(db, 0o600)
    return hashlib.sha256(der).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--ca', type=Path, required=True)
    parser.add_argument('--chromium-major', type=int, required=True)
    args = parser.parse_args()
    print(seed(args.profile, args.ca, args.chromium_major))


if __name__ == '__main__':
    main()
