# Connector credential storage tests

The focused integration suite defines the behavior that a future standalone credential store must preserve. It uses the production n8n API, credential service, cipher, and database adapters.

## Test location

The suite is [credential-secret-storage.test.ts](../packages/cli/test/integration/credentials/credential-secret-storage.test.ts). The GitHub Actions workflow is [test-credential-secret-storage.yml](../.github/workflows/test-credential-secret-storage.yml).

The suite uses the githubApi declaration from [GithubApi.credentials.ts](../packages/nodes-base/credentials/GithubApi.credentials.ts). This declaration supplies a normal field and a password field. The common storage path is connector-independent. A separate test for every connector would repeat the same persistence path and require provider-specific validation and mocks.

## Behavior contract

| Behavior | Integration assertion |
| --- | --- |
| Encryption at rest | The raw data column does not contain the fake plaintext markers |
| Complete round trip | Real decryption returns every static and OAuth field |
| Atomic ownership | The new credential has an owner sharing in the personal project |
| Owner redaction | A data read masks the password and exposes only OAuth connection state |
| Redacted update | An unchanged sentinel preserves the stored secret while other fields change |
| OAuth update protection | An editor update cannot replace the stored OAuth token object |
| Sharing | Sharing adds a credential user role without changing decrypted data |
| Read-only sharing | The sharee receives neither plaintext nor ciphertext |
| No connector dependency | The suite never invokes the credential test or probe routes |

The test uses fixed fake markers. It must not use real credentials. The existing test harness supplies a test encryption key and mocks the sharing license and mailer. Encryption and persistence remain real.

## Local SQLite run

Use pnpm from the repository root. Set N8N_USER_FOLDER only when running outside the provided harness. The harness already creates a test-owned folder before it imports n8n settings.

```sh
pnpm agent:test --filter n8n --script test:sqlite -- test/integration/credentials/credential-secret-storage.test.ts --maxWorkers=1
```

The direct package command is equivalent.

```sh
pnpm --filter=n8n test:sqlite test/integration/credentials/credential-secret-storage.test.ts --maxWorkers=1
```

Do not insert a separate -- argument before the test path in these direct pnpm commands. With pnpm 12, that argument reaches Vitest and the focused file selection does not occur.

## PostgreSQL run

The PostgreSQL configuration uses Testcontainers. It starts PostgreSQL and Redis. Docker must be available. The primary PostgreSQL image comes from [postgres-versions.json](../packages/quality/environments/containers/postgres-versions.json).

```sh
TEST_IMAGE_POSTGRES=postgres:18.4-alpine pnpm --filter=n8n test:postgres:integration:tc test/integration/credentials/credential-secret-storage.test.ts --maxWorkers=1
```

The dedicated Actions workflow runs SQLite and PostgreSQL as separate jobs. It requests only contents read permission. It does not use repository secrets, deployment credentials, connector services, or pull_request_target.

## Existing compatibility suites

Run these suites when changing shared credential behavior rather than only adding the focused contract.

```sh
pnpm --filter=n8n test:sqlite test/integration/credentials/credentials.api.test.ts test/integration/credentials/credentials.api.ee.test.ts test/integration/public-api/credentials.test.ts --maxWorkers=1
```

Run the core tests when changing cipher or credential serialization code.

```sh
pnpm --filter=n8n-core test src/__tests__/credentials.test.ts src/encryption/__tests__/cipher.test.ts --maxWorkers=1
```

Run key-store integration tests when changing rotation or bootstrap code.

```sh
pnpm --filter=n8n test:sqlite src/encryption/__tests__/encryption-bootstrap.service.integration.test.ts src/encryption/__tests__/key-rotation-cycle.integration.test.ts --maxWorkers=1
```

## Mock decision

lmctl-ai/lmmock is not needed for this storage suite. No LLM or connector HTTP request occurs. The existing global test setup blocks external HTTP except loopback. The real database and cipher provide more useful evidence than a storage mock.

The [lmmock workflow suite](lmmock-workflows.md) covers real connector and LLM requests. Keep those protocol tests separate from this credential persistence contract.

## Durable-memory checks

The notes follow [the durable-memory skill](https://lmctl.com/skills/durable-memory.html). Generate the index after editing a chapter. Then check index drift, links, anchors, plain Markdown, and the no-emoji policy.

```sh
pnpm build:memory-index
pnpm check:memory
```

The wrapper uses LMHTML when supplied. Otherwise it downloads the lmhtml release pinned in [lmhtml.lock](../scripts/memory/lmhtml.lock). It verifies the release SHA-256 before execution. The tool cache stays under the ignored .build directory.

## Validation status

Validation on 2026-11-17 produced these results.

- pnpm build: passed.
- pnpm agent:test with test:sqlite and the focused test path: passed with two tests.
- pnpm --filter=n8n typecheck: passed.
- Focused oxlint with type awareness: passed.
- pnpm check:memory: passed.
- [Focused GitHub Actions run](https://github.com/lmctl-ai/n8n/actions/runs/44199514758): passed for SQLite, PostgreSQL, and durable memory.

Record later results with the command, database, and result. Do not record machine-local paths or credentials.
