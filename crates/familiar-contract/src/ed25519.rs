//! Ed25519 attestations, as the reference `verifyEd25519` checks them.
//!
//! A binding, a lineage transition and a revocation event each carry their
//! own public key, as base64 SPKI DER. The signature is over the 32 raw bytes
//! of the lowercase hexadecimal digest, not over the hexadecimal text.
//!
//! The key a document carries proves only that the document is internally
//! consistent. Deciding which keys to trust is the consumer's policy:
//! [`spki_public_key`] exposes the raw key so a consumer can check it against
//! its own trusted set.

use ring::signature::{UnparsedPublicKey, ED25519};

/// The DER prefix of an Ed25519 SubjectPublicKeyInfo: SEQUENCE { SEQUENCE {
/// OID 1.3.101.112 }, BIT STRING (32 bytes) }.
const SPKI_PREFIX: [u8; 12] = [
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
];

/// Decodes base64 as Node's `Buffer.from(text, 'base64')` does for text
/// matching the schema's `^[A-Za-z0-9+/]+={0,2}$`: it stops at the first `=`,
/// emits each whole byte, and drops leftover bits, so padding is optional and
/// non-zero trailing bits are ignored.
pub(crate) fn decode_base64(text: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let mut bits: u32 = 0;
    let mut count = 0;
    for byte in text.bytes() {
        let sextet = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' => break,
            _ => return None,
        };
        bits = (bits << 6) | u32::from(sextet);
        count += 6;
        if count >= 8 {
            count -= 8;
            out.push((bits >> count) as u8);
            bits &= (1 << count) - 1;
        }
    }
    Some(out)
}

/// The raw 32-byte Ed25519 key in a base64 SPKI DER public key, or `None` when
/// the key is not Ed25519.
pub fn spki_public_key(public_key: &str) -> Option<[u8; 32]> {
    let der = decode_base64(public_key)?;
    let raw = der.strip_prefix(&SPKI_PREFIX)?;
    raw.try_into().ok()
}

/// Whether `signature` (base64, 64 bytes) by `public_key` (base64 SPKI DER)
/// verifies the raw bytes of `digest_hex`.
pub fn verify(public_key: &str, signature: &str, digest_hex: &str) -> bool {
    let Some(key) = spki_public_key(public_key) else {
        return false;
    };
    let Some(signature) = decode_base64(signature).filter(|bytes| bytes.len() == 64) else {
        return false;
    };
    let Some(message) = decode_hex(digest_hex) else {
        return false;
    };
    UnparsedPublicKey::new(&ED25519, key)
        .verify(&message, &signature)
        .is_ok()
}

fn decode_hex(text: &str) -> Option<Vec<u8>> {
    if text.len() % 2 != 0 {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(text.get(index..index + 2)?, 16).ok())
        .collect()
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use ring::rand::SystemRandom;
    use ring::signature::{Ed25519KeyPair, KeyPair};

    pub(crate) fn encode_base64(bytes: &[u8]) -> String {
        const ALPHABET: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::new();
        for chunk in bytes.chunks(3) {
            let block = chunk.iter().enumerate().fold(0_u32, |sum, (index, byte)| {
                sum | u32::from(*byte) << (16 - index * 8)
            });
            for index in 0..4 {
                if index <= chunk.len() {
                    out.push(ALPHABET[(block >> (18 - index * 6) & 63) as usize] as char);
                } else {
                    out.push('=');
                }
            }
        }
        out
    }

    pub(crate) struct TestSigner {
        pair: Ed25519KeyPair,
    }

    impl TestSigner {
        pub(crate) fn new() -> Self {
            let document = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).unwrap();
            Self {
                pair: Ed25519KeyPair::from_pkcs8(document.as_ref()).unwrap(),
            }
        }

        pub(crate) fn public_key(&self) -> String {
            let mut der = SPKI_PREFIX.to_vec();
            der.extend_from_slice(self.pair.public_key().as_ref());
            encode_base64(&der)
        }

        pub(crate) fn sign(&self, digest_hex: &str) -> String {
            encode_base64(self.pair.sign(&decode_hex(digest_hex).unwrap()).as_ref())
        }
    }

    #[test]
    fn decodes_base64_as_node_does() {
        // Expected bytes are `Buffer.from(text, 'base64')` in Node 24.
        for (text, hex) in [
            ("AAAA", "000000"),
            ("AAAAA", "000000"),
            ("AAAAAA", "00000000"),
            ("AAAAAAA", "0000000000"),
            ("AB", "00"),
            ("AB==", "00"),
            ("ABC=", "0010"),
            ("AQ", "01"),
            ("AR", "01"),
            ("/w", "ff"),
            ("//8", "ffff"),
            ("QUJDRA", "41424344"),
            ("QUJDRA==", "41424344"),
        ] {
            assert_eq!(decode_base64(text), decode_hex(hex), "{text}");
        }
        assert_eq!(decode_base64("A A"), None);
    }

    #[test]
    fn verifies_signatures_over_raw_digest_bytes() {
        let signer = TestSigner::new();
        let digest = "ab".repeat(32);
        let signature = signer.sign(&digest);
        assert!(verify(&signer.public_key(), &signature, &digest));
        // Unpadded base64 decodes to the same bytes.
        assert!(verify(
            signer.public_key().trim_end_matches('='),
            signature.trim_end_matches('='),
            &digest
        ));
        assert!(!verify(&signer.public_key(), &signature, &"cd".repeat(32)));
        assert!(!verify(
            &TestSigner::new().public_key(),
            &signature,
            &digest
        ));
        // A signature over the hexadecimal text is not a signature over the digest.
        let over_text = encode_base64(signer.pair.sign(digest.as_bytes()).as_ref());
        assert!(!verify(&signer.public_key(), &over_text, &digest));
        // A truncated signature or a non-Ed25519 key fails closed.
        assert!(!verify(&signer.public_key(), &signature[..80], &digest));
        assert!(!verify(&encode_base64(&[0; 44]), &signature, &digest));
        assert_eq!(
            spki_public_key(&signer.public_key()),
            Some(signer.pair.public_key().as_ref().try_into().unwrap())
        );
    }
}
