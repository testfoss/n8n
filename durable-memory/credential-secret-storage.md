# Connector credential secret storage

This chapter maps the common storage path for n8n connector credentials. It also records the stores that use different semantics. The source baseline is n8n upstream master commit fea1ec010611045cea92f0e7fecdf2f59e79618b.

## Main finding

Connector packages declare credential fields. Workflows store credential IDs and names. The credentials_entity table stores the complete credential data object as one encrypted text value. Connector packages do not each implement a secret store.

The common path has four boundaries.

| Boundary | Stored or returned value | Source |
| --- | --- | --- |
| Credential declaration | Field names, defaults, password markers, authentication rules, and test rules | [GithubApi.credentials.ts](../packages/nodes-base/credentials/GithubApi.credentials.ts) |
| Workflow node | Credential ID, display name, and credential type key | [interfaces.ts](../packages/workflow/src/interfaces.ts) |
| Credential row | Name, type, lifecycle metadata, and encrypted JSON data | [credentials-entity.ts](../packages/@n8n/db/src/entities/credentials-entity.ts) |
| Runtime credential | Decrypted object after access checks, defaults, overwrites, and expression resolution | [credentials-helper.ts](../packages/cli/src/credentials-helper.ts) |

The ICredentialType contract and ICredentialDataDecryptedObject type do not limit stored data to visible editor fields. Hidden fields, inherited fields, and runtime OAuth fields can share the same encrypted object.

## Database tables

| Table | Purpose | Secret value location |
| --- | --- | --- |
| credentials_entity | Static project or instance credential | The data text column contains encrypted JSON |
| shared_credentials | Credential-to-project owner or user role | No secret value |
| project_relation | User-to-project role | No secret value |
| credential_dependency | External provider dependency metadata | No secret value |
| dynamic_credential_user_entry | Per-user resolved credential | The data text column contains encrypted JSON |
| dynamic_credential_entry | Per-subject resolved credential | The data text column contains encrypted JSON |
| dynamic_credential_resolver | Resolver definition | The config text column contains encrypted JSON |
| secrets_provider_connection | External provider connection | The encryptedSettings column contains encrypted settings |
| deployment_key | Wrapped data-encryption and signing keys | The value column contains wrapped key material |

See [credentials-entity.ts](../packages/@n8n/db/src/entities/credentials-entity.ts) for the static row. See [dynamic-credential-user-entry.ts](../packages/cli/src/modules/dynamic-credentials.ee/database/entities/dynamic-credential-user-entry.ts) for a per-user dynamic row.

A normal project credential has an owner row in shared_credentials. Users receive access through project_relation and credential roles. The access query crosses credential, sharing, project, and user boundaries. See [credential-access.repository.ts](../packages/@n8n/db/src/repositories/credential-access.repository.ts) and [credentials-finder.service.ts](../packages/@n8n/backend-services/src/credentials/credentials-finder.service.ts).

## Create and update path

The editor controller receives plaintext data in [credentials.controller.ts](../packages/cli/src/credentials/credentials.controller.ts). The service in [credentials.service.ts](../packages/cli/src/credentials/credentials.service.ts) validates the type and fields. It then calls the core Credentials class in [credentials.ts](../packages/core/src/credentials.ts).

Credentials.setData serializes the complete object and calls Cipher.encryptV2. Credentials.getDataToSave returns the encrypted string. The repository writes that string and the owner sharing in one transaction. See [credentials.repository.ts](../packages/@n8n/db/src/repositories/credentials.repository.ts).

An update decrypts the existing object first. It restores unchanged redaction sentinels with unredact. It preserves OAuth token data when an ordinary editor update omits that data. It then encrypts the complete replacement object. A metadata-only public API update can carry forward the existing ciphertext.

## Encryption and keys

Cipher.encryptV2 and Cipher.decryptV2 are the public encryption boundary in [cipher.ts](../packages/core/src/encryption/cipher.ts). New application code should use this boundary. Raw AES implementations include [aes-256-cbc.ts](../packages/core/src/encryption/aes-256-cbc.ts) and [aes-256-gcm.ts](../packages/core/src/encryption/aes-256-gcm.ts).

| Mode | Stored shape | Compatibility rule |
| --- | --- | --- |
| Legacy or rotation disabled | Unprefixed OpenSSL-compatible AES-256-CBC value | The instance key or legacy deployment key decrypts it |
| Rotation enabled | Deployment key ID, a colon, and an AES-256-GCM payload | The key ID selects a wrapped deployment key |

The method name encryptV2 does not imply a literal v2 ciphertext marker. The GCM payload has its own internal format version.

[instance-settings.ts](../packages/core/src/instance-settings/instance-settings.ts) loads or creates the instance key. The default settings file is the config file below the n8n user folder. N8N_ENCRYPTION_KEY or N8N_ENCRYPTION_KEY_FILE can supply the key. Workers do not generate a missing key.

[key-manager.service.ts](../packages/cli/src/encryption/key-manager.service.ts) supplies active and legacy keys. Deployment keys remain available after deactivation. Old ciphertext must remain readable after rotation. The management response does not expose DeploymentKey.value.

## Runtime use

NodeExecutionContext checks that the node declares and can use the requested credential type. CredentialsPermissionChecker checks workflow, project, global, and user access before execution. CredentialsHelper then loads by credential ID and type, applies decryption policy, and decrypts the row.

The runtime also applies administrator overwrites, declaration defaults, dynamic values, and expressions. These steps occur after storage decryption. A standalone extraction must not treat raw database decryption as the complete runtime contract.

The relevant sources are [node-execution-context.ts](../packages/core/src/execution-engine/node-execution-context/node-execution-context.ts), [credentials-permission-checker.ts](../packages/cli/src/executions/pre-execution-checks/credentials-permission-checker.ts), and [credentials-helper.ts](../packages/cli/src/credentials-helper.ts).

## OAuth connector tokens

Ordinary OAuth1 and OAuth2 connector tokens live in the oauthTokenData field inside the same encrypted credential object. They do not use a separate connector token table. The object can contain access_token, refresh_token, expiry, and provider-specific fields.

[oauth.service.ts](../packages/cli/src/oauth/oauth.service.ts) encrypts callback results and updates the credential. The refresh path uses updateDataIfUnchanged in the credential repository. This compare-and-write guard prevents a refreshed token from overwriting a concurrently changed client configuration.

Transient OAuth state uses the cache with a time limit. CSRF secrets and PKCE verifiers do not remain in shared credential data. n8n OAuth server access tokens and refresh tokens are a separate feature and do not follow this connector storage contract.

## Other connector secret sources

| Source | Storage behavior |
| --- | --- |
| Dynamic or end-user credentials | A static blueprint can coexist with encrypted per-user or per-subject entries |
| External secrets through $secrets | The credential stores an expression. The provider returns the value at runtime |
| External provider settings | Provider connection settings use their own encrypted database fields |
| Administrator overwrites | Environment or persisted settings supply values after database decryption |
| Environment expressions | The credential stores an expression. The environment supplies the value at runtime |
| AWS system credentials | The host or cloud credential chain supplies values when the node enables this source |
| AI Gateway managed credentials | A synthetic runtime credential references the gateway. It is not a normal database row |

External secrets support requires the licensed module. Resolver configuration and provider connection settings have their own redaction paths. These stores should remain optional adapters in the first reusable extraction.

## API redaction

CredentialsService.redact uses password markers from the credential declaration. It always masks oauthTokenData and csrfSecret. It handles fixed collections and marked JSON leaves. CredentialsService.unredact restores unchanged sentinels before an update.

An editor read includes decrypted data only when the actor has credential update scope. A read-only sharee receives metadata without data. Owner responses replace oauthTokenData with a boolean connection signal. Public API response mappers omit credential data.

Unknown or undeclared fields are not generically redacted. An unknown credential type currently makes this redaction path return data unchanged. A reusable project must preserve this behavior for compatibility or choose and test a fail-closed policy.

## Stores outside this contract

Execution item data is not blanket encrypted by the connector credential store. Execution identity context and secure artifacts have separate encrypted fields. API keys, SSO settings, n8n OAuth server tokens, signing keys, and generic settings also have different semantics.

Do not generalize the connector credential contract to every n8n secret. Start with static project credentials. Use [the extraction plan](credential-secret-storage-extraction.md) and [the test contract](credential-secret-storage-testing.md) for the next work.
