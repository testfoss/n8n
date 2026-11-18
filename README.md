# n8n credential storage research and lmmock workflows

[![Credential storage integration tests](https://github.com/testfoss/n8n/actions/workflows/test-credential-secret-storage.yml/badge.svg)](https://github.com/testfoss/n8n/actions/workflows/test-credential-secret-storage.yml)
[![Telegram and AI Agent workflows with lmmock](https://github.com/testfoss/n8n/actions/workflows/test-lmmock-workflows.yml/badge.svg)](https://github.com/testfoss/n8n/actions/workflows/test-lmmock-workflows.yml)

This repository is a public research fork of [n8n-io/n8n](https://github.com/n8n-io/n8n). It documents how n8n stores connector secrets. It protects that behavior with integration tests. It also runs real n8n workflows against [lmmock](https://github.com/lmctl-ai/lmmock) instead of live provider APIs.

The upstream n8n product and source tree remain available in this repository. The sections below describe the additions and their exact locations.

## Purpose

This research has four goals.

1. Map connector credential declarations, encrypted persistence, sharing, redaction, runtime decryption, OAuth tokens, and external secret references.
2. Add executable integration contracts for the existing behavior.
3. Define a phased boundary for a future standalone credential-storage project.
4. Provide n8n workflow examples that use deterministic lmmock services over real loopback HTTP sockets.

The standalone extraction is not complete. The current work supplies the source map, compatibility invariants, examples, and test gate needed before that extraction.

## Start here

Read [durable-memory/index.md](durable-memory/index.md) first. It links the current research chapters.

| Document | Contents |
| --- | --- |
| [Connector credential secret storage](durable-memory/credential-secret-storage.md) | Database tables, encryption keys, credential CRUD, runtime use, OAuth tokens, redaction, and other secret sources |
| [Credential storage examples](durable-memory/credential-secret-storage-examples.md) | API payloads, encrypted-row shape, redacted reads, updates, workflow references, and external-secret expressions |
| [Credential storage tests](durable-memory/credential-secret-storage-testing.md) | Behavior matrix, test commands, database coverage, and validation results |
| [Reusable credential store extraction](durable-memory/credential-secret-storage-extraction.md) | Proposed interfaces, extraction phases, compatibility requirements, and exclusions |
| [n8n workflows with lmmock](durable-memory/lmmock-workflows.md) | Telegram and AI Agent examples, network controls, lifecycle, pins, and current limits |

## Additions beyond the upstream fork

| Path | Purpose |
| --- | --- |
| `durable-memory/` | Research, decisions, examples, test commands, and validation history |
| `packages/cli/test/integration/credentials/credential-secret-storage.test.ts` | Real API, SQLite or PostgreSQL, encryption, decryption, redaction, OAuth, ownership, and sharing contract |
| `packages/nodes-base/nodes/Telegram/tests/Workflow/lmmock.workflow.json` | Importable Telegram workflow with message creation, expression propagation, and chat lookup |
| `packages/nodes-base/nodes/Telegram/tests/Workflow/lmmock.workflow.test.ts` | Executes the Telegram workflow through the lmmock source preset |
| `packages/@n8n/nodes-langchain/nodes/agents/Agent/test/integration/agent-lmmock.workflow.test.ts` | Executes a real AI Agent workflow through the embedded lmmock OpenAI-compatible API |
| `scripts/lmmock/` | Checksum-pinned lmmock release setup and focused workflow runner |
| `scripts/memory/` | Generated durable-memory index and validation tooling |
| `.github/workflows/test-credential-secret-storage.yml` | SQLite, PostgreSQL, and durable-memory CI |
| `.github/workflows/test-lmmock-workflows.yml` | Telegram and AI Agent workflow CI with lmmock |

The changes to `package.json` and `.github/WORKFLOWS.md` register the new commands and workflows. This README is the public entry point for the research.

## Integration examples

### Encrypted connector credential lifecycle

The credential storage suite uses a synthetic GitHub token and synthetic OAuth tokens. It proves these behaviors without calling GitHub:

- The database stores one encrypted JSON value rather than plaintext fields.
- Decryption returns the complete static and OAuth data object.
- Owner reads redact password fields and expose OAuth connection state only.
- An update with the redaction sentinel preserves the original secret.
- An editor update cannot replace the stored OAuth token object.
- Ownership and sharing rows preserve access rules.
- A read-only sharee receives neither plaintext nor ciphertext.

See [the storage examples](durable-memory/credential-secret-storage-examples.md) for the input and output shapes.

### Telegram workflow with lmmock

The [Telegram workflow](packages/nodes-base/nodes/Telegram/tests/Workflow/lmmock.workflow.json) has this path:

```text
Manual Trigger -> Send Message -> Get Chat
```

The Send Message node returns a deterministic message. The Get Chat node reads the chat ID from that result through an n8n expression. The lmmock preset checks the synthetic bot token in the URL path and supplies both responses.

### AI Agent workflow with lmmock

The AI Agent test uses the existing [basic agent workflow](packages/@n8n/nodes-langchain/nodes/agents/Agent/test/integration/workflows/agent-v3-basic.json) with an OpenAI credential pointed to lmmock. The embedded mock returns `pong` through Chat Completions. The test checks the agent output, request count, request path, model, and synthetic Bearer credential.

These workflow tests use in-memory credentials through NodeTestHarness. The CLI integration suite separately proves database encryption and credential persistence.

## Run the checks

Use the Node.js and pnpm versions declared in `package.json`.

Install and build a fresh checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Run the credential storage contract on SQLite:

```sh
pnpm agent:test --filter n8n --script test:sqlite -- test/integration/credentials/credential-secret-storage.test.ts --maxWorkers=1
```

Run it on PostgreSQL through Testcontainers when Docker is available:

```sh
TEST_IMAGE_POSTGRES=postgres:18.4-alpine pnpm --filter=n8n test:postgres:integration:tc test/integration/credentials/credential-secret-storage.test.ts --maxWorkers=1
```

Run both lmmock workflows:

```sh
pnpm test:lmmock
```

The runner downloads public lmmock release assets and verifies their SHA-256 hashes. It uses ephemeral loopback ports and owns each server lifecycle. Ordinary package test runs skip the lmmock suites when `LMMOCK_URL` is absent.

Regenerate and check the durable-memory index after editing a chapter:

```sh
pnpm build:memory-index
pnpm check:memory
```

Do not edit the generated list in `durable-memory/index.md` directly.

## GitHub Actions

| Workflow | Coverage | External requirements |
| --- | --- | --- |
| [Connector Credential Secret Storage](.github/workflows/test-credential-secret-storage.yml) | SQLite, PostgreSQL, and durable-memory validation | PostgreSQL and Redis Testcontainers for the PostgreSQL leg |
| [Workflows with lmmock](.github/workflows/test-lmmock-workflows.yml) | Real Telegram and AI Agent node execution over loopback HTTP | Public, checksum-verified lmmock release assets |

Both workflows request only `contents: read`. They need no live provider credential, model key, repository secret, or `pull_request_target` execution.

## Security and fixture scope

All tokens, keys, messages, and provider identities in the additions are synthetic fixtures. lmmock listens on loopback only. Nock blocks other network access in the workflow tests. The tests do not send real credentials to an inspection endpoint or a provider.

The examples cover selected contracts. They do not claim complete Telegram, OpenAI, Slack, or connector coverage. The documents list known limits and the Slack custom-endpoint work that remains.

## Upstream synchronization

The repository remains a linked fork of [n8n-io/n8n](https://github.com/n8n-io/n8n). Most additions use new files or directories to reduce merge conflicts.

For a clone without an upstream remote, use:

```sh
git remote add upstream https://github.com/n8n-io/n8n.git
git fetch upstream master
git merge upstream/master
```

Review changes to `README.md`, `package.json`, and `.github/WORKFLOWS.md` during a merge. These files contain the research registration and entry points.

## Upstream n8n

n8n is a fair-code platform for AI agents and workflow automation. It combines a visual canvas with custom code and supports self-hosted or cloud deployments.

- [Upstream repository](https://github.com/n8n-io/n8n)
- [n8n documentation](https://docs.n8n.io)
- [n8n integrations](https://n8n.io/integrations)
- [n8n workflow templates](https://n8n.io/workflows)
- [Upstream contributing guide](CONTRIBUTING.md)

## License

The upstream license files are unchanged. n8n is distributed under the [Sustainable Use License](LICENSE.md) and the [n8n Enterprise License](LICENSE_EE.md).

Review those licenses before copying code into the proposed standalone project. Preserve required notices and keep enterprise modules outside the first extraction.
