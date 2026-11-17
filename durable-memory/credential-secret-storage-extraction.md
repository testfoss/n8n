# Reusable credential store extraction

The end goal is a separate project that other applications can reuse. The first extraction should cover static project credentials. It should preserve n8n ciphertext compatibility and keep authorization ahead of decryption.

## Scope decision

Start with declarations, compatible encryption, encrypted CRUD, sharing-aware reads, redaction, unredaction, and controlled runtime decryption. Do not extract the complete CredentialsService. That service also couples projects, users, hooks, credential testing, instance credentials, dynamic credentials, external secrets, and enterprise policy.

Review licensing before publishing copied code. This repository has [LICENSE.md](../LICENSE.md) and [LICENSE_EE.md](../LICENSE_EE.md). Keep enterprise modules out of the first extraction. Preserve required notices and choose the separate project license only after a license review.

## Neutral contracts

Define interfaces that do not import Express, TypeORM, or n8n dependency injection.

| Contract | Responsibility | n8n source evidence |
| --- | --- | --- |
| CredentialTypeRegistry | Resolve declarations and inherited properties | [credential-types.ts](../packages/cli/src/credential-types.ts) |
| CredentialCipher | Encrypt and decrypt complete JSON values | [cipher.ts](../packages/core/src/encryption/cipher.ts) |
| EncryptionKeyProvider | Supply active, prefixed, and legacy key descriptors | [encryption-key-proxy.ts](../packages/core/src/encryption/encryption-key-proxy.ts) |
| CredentialStore | Create, read, update, delete, and compare-and-write ciphertext | [credentials.repository.ts](../packages/@n8n/db/src/repositories/credentials.repository.ts) |
| CredentialAccessPolicy | Authorize actor, project, workflow, and node use before decryption | [credential-access.repository.ts](../packages/@n8n/db/src/repositories/credential-access.repository.ts) |
| CredentialRedactor | Redact responses and restore sentinels during updates | [credentials.service.ts](../packages/cli/src/credentials/credentials.service.ts) |
| CredentialExpressionResolver | Resolve variables and external references after storage decryption | [credentials-helper.ts](../packages/cli/src/credentials-helper.ts) |

CredentialStore should expose use-case-named methods. It should not expose generic TypeORM find, save, manager, or query-builder methods. Credential and owner creation should remain atomic.

## Phase 1: Crypto and opaque values

Extract the core Credentials wrapper, Cipher, the key-provider port, and the AES implementations. Use [credentials.ts](../packages/core/src/credentials.ts), [cipher.ts](../packages/core/src/encryption/cipher.ts), and [encryption-key-proxy.ts](../packages/core/src/encryption/encryption-key-proxy.ts) as the starting point.

Remove direct dependency-injection lookups. Inject Cipher into the credential value object or service. Put instance-key configuration behind a small port. Supply a no-rotation provider first. Retain reads for key-prefixed ciphertext even before implementing rotation management.

Run [credentials.test.ts](../packages/core/src/__tests__/credentials.test.ts) and [cipher.test.ts](../packages/core/src/encryption/__tests__/cipher.test.ts) against the extracted implementation. Keep fixed compatibility ciphertext fixtures. Do not regenerate a fixture to make a changed implementation pass.

## Phase 2: Pure redaction and merge logic

Extract redact, unredact, fixed-collection traversal, JSON-leaf handling, and update merge behavior. These functions should receive declaration properties and plain values. They should not receive database entities or services.

Use CredentialsService and [credential-data-merge.ts](../packages/cli/src/credentials/credential-data-merge.ts) as source evidence. Preserve unknown fields during partial updates. Decide explicitly whether an unknown credential type preserves the current redaction behavior or fails closed.

## Phase 3: Persistence adapter and application service

Implement a small adapter for credentials_entity and shared_credentials. Use the entity and repository sources as the schema reference. Support SQLite first. Add PostgreSQL through the same contract suite.

The application service should orchestrate validation, encryption, storage, access checks, and response mapping. It should not contain HTTP routes. An HTTP adapter can be a separate package.

Return metadata by default. Do not copy the current internal create response shape that can include ciphertext. Use an explicit public response that omits both plaintext and ciphertext.

## Phase 4: Runtime adapter

Add node declaration checks and workflow or project authorization before storage decryption. Then apply overwrites, defaults, dynamic providers, and expressions in that order through explicit ports.

Use NodeExecutionContext, CredentialsPermissionChecker, and CredentialsHelper as the behavior references. Query by credential ID and type. Do not look up runtime credentials by display name.

## Optional later packages

Keep these features independent of the first package.

- OAuth callback, refresh, locking, and compare-and-write token updates.
- Dynamic and end-user credential resolvers.
- External secret providers and provider connection settings.
- Deployment-key rotation and administration.
- Instance-scoped credentials.
- Administrator overwrites and source-control sanitization.
- Execution identity context, secure artifacts, and execution redaction.
- CLI import and export.

Each optional package should implement a narrow port and reuse the core compatibility tests.

## Required invariants

- Encrypt the complete JSON object before every database write.
- Read legacy unprefixed CBC and current key-prefixed GCM ciphertext.
- Preserve custom-key CBC behavior when import and export support is added.
- Wrap deployment keys with the instance key. Never return wrapped or raw key material through an API.
- Never delete deployment keys that can protect stored data.
- Fail decryption loudly when a write could follow. Never replace unreadable data with an empty object.
- Authorize user, project, workflow, and node use before decryption.
- Create the credential and owner sharing atomically.
- Restore redaction sentinels before re-encryption.
- Preserve unknown fields unless the API contract explicitly replaces the complete object.
- Return neither plaintext secrets nor ciphertext in the default API shape.
- Preserve compare-and-write semantics for OAuth token refresh.
- Keep connector tokens separate from n8n OAuth server tokens and execution data.

## Compatibility test gate

The focused suite in [credential-secret-storage-testing.md](credential-secret-storage-testing.md) is the first behavior gate. The standalone project should run an equivalent suite against each supported database and key mode.

A later extraction pull request should prove two directions. It must read n8n-generated ciphertext. n8n must also read standalone-generated ciphertext. Test both legacy and key-prefixed data before calling the extraction compatible.
