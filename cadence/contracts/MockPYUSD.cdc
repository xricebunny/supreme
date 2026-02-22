import "FungibleToken"
import "MetadataViews"
import "FungibleTokenMetadataViews"

/// MockPYUSD — a testnet-only fungible token with an open mint function.
/// Anyone can mint any amount. Used as the betting currency in the prediction game.
access(all) contract MockPYUSD: FungibleToken {

    access(all) event TokensMinted(amount: UFix64, type: String)

    access(all) var totalSupply: UFix64

    access(all) let VaultStoragePath: StoragePath
    access(all) let VaultPublicPath: PublicPath
    access(all) let ReceiverPublicPath: PublicPath

    // ── Contract-level metadata views ──────────────────────────────────────

    access(all) view fun getContractViews(resourceType: Type?): [Type] {
        return [
            Type<FungibleTokenMetadataViews.FTView>(),
            Type<FungibleTokenMetadataViews.FTDisplay>(),
            Type<FungibleTokenMetadataViews.FTVaultData>(),
            Type<FungibleTokenMetadataViews.TotalSupply>()
        ]
    }

    access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
        switch viewType {
            case Type<FungibleTokenMetadataViews.FTView>():
                return FungibleTokenMetadataViews.FTView(
                    ftDisplay: self.resolveContractView(resourceType: nil, viewType: Type<FungibleTokenMetadataViews.FTDisplay>()) as! FungibleTokenMetadataViews.FTDisplay?,
                    ftVaultData: self.resolveContractView(resourceType: nil, viewType: Type<FungibleTokenMetadataViews.FTVaultData>()) as! FungibleTokenMetadataViews.FTVaultData?
                )
            case Type<FungibleTokenMetadataViews.FTDisplay>():
                let media = MetadataViews.Media(
                    file: MetadataViews.HTTPFile(url: "https://pyusd.io/favicon.png"),
                    mediaType: "image/png"
                )
                return FungibleTokenMetadataViews.FTDisplay(
                    name: "Mock PYUSD",
                    symbol: "PYUSD",
                    description: "A testnet mock of PayPal USD for the prediction game.",
                    externalURL: MetadataViews.ExternalURL("https://pyusd.io"),
                    logos: MetadataViews.Medias([media]),
                    socials: {}
                )
            case Type<FungibleTokenMetadataViews.FTVaultData>():
                return FungibleTokenMetadataViews.FTVaultData(
                    storagePath: self.VaultStoragePath,
                    receiverPath: self.ReceiverPublicPath,
                    metadataPath: self.VaultPublicPath,
                    receiverLinkedType: Type<&MockPYUSD.Vault>(),
                    metadataLinkedType: Type<&MockPYUSD.Vault>(),
                    createEmptyVaultFunction: (fun(): @{FungibleToken.Vault} {
                        return <-MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>())
                    })
                )
            case Type<FungibleTokenMetadataViews.TotalSupply>():
                return FungibleTokenMetadataViews.TotalSupply(totalSupply: MockPYUSD.totalSupply)
        }
        return nil
    }

    // ── Vault resource ─────────────────────────────────────────────────────

    access(all) resource Vault: FungibleToken.Vault {

        access(all) var balance: UFix64

        init(balance: UFix64) {
            self.balance = balance
        }

        access(contract) fun burnCallback() {
            if self.balance > 0.0 {
                MockPYUSD.totalSupply = MockPYUSD.totalSupply - self.balance
            }
            self.balance = 0.0
        }

        access(all) view fun getViews(): [Type] {
            return MockPYUSD.getContractViews(resourceType: nil)
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            return MockPYUSD.resolveContractView(resourceType: nil, viewType: view)
        }

        access(all) view fun getSupportedVaultTypes(): {Type: Bool} {
            return {self.getType(): true}
        }

        access(all) view fun isSupportedVaultType(type: Type): Bool {
            return type == self.getType()
        }

        access(all) view fun isAvailableToWithdraw(amount: UFix64): Bool {
            return amount <= self.balance
        }

        access(FungibleToken.Withdraw) fun withdraw(amount: UFix64): @MockPYUSD.Vault {
            self.balance = self.balance - amount
            return <-create Vault(balance: amount)
        }

        access(all) fun deposit(from: @{FungibleToken.Vault}) {
            let vault <- from as! @MockPYUSD.Vault
            self.balance = self.balance + vault.balance
            vault.balance = 0.0
            destroy vault
        }

        access(all) fun createEmptyVault(): @MockPYUSD.Vault {
            return <-create Vault(balance: 0.0)
        }
    }

    // ── Public mint — anyone can create tokens (testnet only) ──────────────

    access(all) fun mint(amount: UFix64): @MockPYUSD.Vault {
        self.totalSupply = self.totalSupply + amount
        let vault <- create Vault(balance: amount)
        emit TokensMinted(amount: amount, type: vault.getType().identifier)
        return <-vault
    }

    access(all) fun createEmptyVault(vaultType: Type): @MockPYUSD.Vault {
        return <-create Vault(balance: 0.0)
    }

    // ── Init ───────────────────────────────────────────────────────────────

    init() {
        self.totalSupply = 0.0
        self.VaultStoragePath = /storage/mockPYUSDVault
        self.VaultPublicPath = /public/mockPYUSDVault
        self.ReceiverPublicPath = /public/mockPYUSDReceiver

        // Set up deployer's vault
        let vault <- create Vault(balance: 0.0)
        self.account.storage.save(<-vault, to: self.VaultStoragePath)

        let vaultCap = self.account.capabilities.storage.issue<&MockPYUSD.Vault>(self.VaultStoragePath)
        self.account.capabilities.publish(vaultCap, at: self.VaultPublicPath)

        let receiverCap = self.account.capabilities.storage.issue<&MockPYUSD.Vault>(self.VaultStoragePath)
        self.account.capabilities.publish(receiverCap, at: self.ReceiverPublicPath)
    }
}
