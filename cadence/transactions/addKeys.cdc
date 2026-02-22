/// One-time setup: add multiple keys to the admin account for key rotation.
/// All keys use the same public key material but get different key indices,
/// enabling parallel transaction submission (waddle pattern).
transaction(publicKeyHex: String, numOfKeys: Int) {

    prepare(signer: auth(Keys) &Account) {
        let publicKey = PublicKey(
            publicKey: publicKeyHex.decodeHex(),
            signatureAlgorithm: SignatureAlgorithm.ECDSA_P256
        )

        var i = 0
        while i < numOfKeys {
            signer.keys.add(
                publicKey: publicKey,
                hashAlgorithm: HashAlgorithm.SHA3_256,
                weight: 1000.0
            )
            i = i + 1
        }

        log("Added ".concat(numOfKeys.toString()).concat(" keys to account"))
    }
}
