# n8n workflows with lmmock

These examples execute real n8n workflows over real loopback HTTP sockets. lmmock supplies the external Telegram and OpenAI-compatible APIs. No live provider, paid model, or real credential is involved.

## Workflow coverage

| Workflow | Real n8n behavior | lmmock behavior |
| --- | --- | --- |
| [Telegram lmmock workflow](../packages/nodes-base/nodes/Telegram/tests/Workflow/lmmock.workflow.json) | Manual trigger, sendMessage, expression propagation, getChat, credential baseUrl, and node output | [telegram.lms](https://github.com/lmctl-ai/lmmock/blob/v0.1.117/examples/telegram.lms) validates the bot token in the path and returns deterministic messages and chats |
| [AI Agent basic workflow](../packages/@n8n/nodes-langchain/nodes/agents/Agent/test/integration/workflows/agent-v3-basic.json) | Manual trigger, AI Agent, OpenAI chat model, credential apiKey and URL, and final agent output | The embedded llm-api preset validates Bearer authentication and returns pong through the Chat Completions API |

The Telegram test is [lmmock.workflow.test.ts](../packages/nodes-base/nodes/Telegram/tests/Workflow/lmmock.workflow.test.ts). It checks both node outputs and the node execution order.

The AI Agent test is [agent-lmmock.workflow.test.ts](../packages/@n8n/nodes-langchain/nodes/agents/Agent/test/integration/agent-lmmock.workflow.test.ts). It checks the final output, the request count, the request path, the synthetic Bearer credential, and the requested model.

Both tests use NodeTestHarness and real node implementations. The harness supplies in-memory credential values. These tests do not replace [the database credential storage contract](credential-secret-storage-testing.md).

## Network controls

Each test permits only 127.0.0.1 after the harness blocks network access. The lmmock executable chooses an ephemeral loopback port and exports LMMOCK_URL to the test process. The exec wrapper closes the listener when the test process exits.

The Telegram preset runs from its reviewed lmcode source. The llm-api preset is embedded in the lmmock release and needs no compiler. The test runner installs the compiler only for the Telegram source preset.

Ordinary package test runs skip these two suites when LMMOCK_URL is absent. The dedicated Actions workflow always supplies the wrappers. Do not replace the real socket calls with Nock responses in these suites.

## Run locally

Build n8n first after a fresh checkout.

```sh
pnpm build
```

Run both workflow suites with one command.

```sh
pnpm test:lmmock
```

Use pnpm 12 without a separate -- argument before Vitest file paths. The runner uses direct package commands with explicit paths.

The runner supports Linux and macOS on x64 and arm64. It downloads lmmock v0.1.117 and lmctl 0.2.482. It verifies the release manifest, binary, and examples archive against [lmmock.lock](../scripts/lmmock/lmmock.lock). The cache and compiler package store stay under the ignored .build directory.

Set LMMOCK_CACHE to use a different test-owned cache. Do not put credentials in that directory. The fixtures use only synthetic values.

## GitHub Actions

[test-lmmock-workflows.yml](../.github/workflows/test-lmmock-workflows.yml) builds n8n and runs pnpm test:lmmock on Ubuntu. It triggers for relevant workflow, node, runner, and documentation changes. It also supports manual dispatch.

The workflow requests only contents read permission. It uses no repository secrets, connector credentials, model credentials, Docker containers, or pull_request_target. The runner downloads public release assets from lmctl-ai/lmmock and verifies their SHA-256 hashes before use.

## Current limits and next candidates

The Telegram workflow covers selected message and chat operations. It does not prove the complete Telegram API. The AI Agent workflow covers a basic completion. It does not claim semantic model quality or complete OpenAI API coverage.

Slack is not in this round. Its node request helper currently hardcodes the Slack API origin, and the hidden credential URL affects only the credential test. A future Slack integration should add a deliberate custom-endpoint seam and align the credential-test route with the lmmock preset.

Jira and other presets with existing n8n custom-endpoint fields are candidates for the same pattern. Add only operations that the preset supports. Keep provider error and retry scenarios in separate deterministic workflows.

## Validation status

On 2026-11-17, pnpm test:lmmock passed locally with the pinned lmmock release. Both workflow tests passed. The same tests skipped cleanly when LMMOCK_URL was absent.

Record the dedicated Actions result after publication. Keep machine-local paths and credentials out of this chapter.
