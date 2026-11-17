import { NodeTestHarness } from '@nodes-testing/node-test-harness';
import type { WorkflowTestData } from 'n8n-workflow';
import nock from 'nock';
import path from 'node:path';

const restoreUserFolder = vi.hoisted(() => {
	const { mkdtempSync, rmSync } = process.getBuiltinModule('fs');
	const { tmpdir } = process.getBuiltinModule('os');
	const { join } = process.getBuiltinModule('path');
	const originalUserFolder = process.env.N8N_USER_FOLDER;
	const testUserFolder = mkdtempSync(join(tmpdir(), 'n8n-agent-lmmock-test-'));
	process.env.N8N_USER_FOLDER = testUserFolder;
	return () => {
		if (originalUserFolder === undefined) delete process.env.N8N_USER_FOLDER;
		else process.env.N8N_USER_FOLDER = originalUserFolder;
		rmSync(testUserFolder, { recursive: true, force: true });
	};
});

afterAll(restoreUserFolder);

const hasLmmock = Boolean(process.env.LMMOCK_URL);

describe.skipIf(!hasLmmock)('AI Agent workflow with lmmock', () => {
	const lmmockUrl = process.env.LMMOCK_URL!;
	const testHarness = new NodeTestHarness({
		additionalPackagePaths: [path.dirname(require.resolve('n8n-nodes-base'))],
	});

	beforeEach(() => {
		nock.enableNetConnect('127.0.0.1');
	});

	afterEach(() => {
		nock.disableNetConnect();
	});

	const testData: WorkflowTestData = {
		description: 'executes an AI Agent through the OpenAI-compatible lmmock API',
		input: {
			workflowData: testHarness.readWorkflowJSON('workflows/agent-v3-basic.json'),
		},
		output: {
			nodeData: {
				'AI Agent': [[{ json: { output: 'pong' } }]],
			},
		},
	};

	testHarness.setupTest(testData, {
		credentials: {
			openAiApi: {
				apiKey: 'fixture-key',
				url: `${lmmockUrl}/v1`,
			},
		},
	});

	afterAll(async () => {
		nock.enableNetConnect('127.0.0.1');
		try {
			const requestCountResponse = await fetch(`${lmmockUrl}/__requests`);
			expect(requestCountResponse.ok).toBe(true);
			expect(await requestCountResponse.json()).toEqual({ count: 1 });

			const inspectResponse = await fetch(`${lmmockUrl}/__inspect`);
			expect(inspectResponse.ok).toBe(true);
			const inspection = (await inspectResponse.json()) as {
				url: string;
				headers: { authorization: string };
				body: string;
			};
			expect(inspection).toMatchObject({
				url: '/v1/chat/completions',
				headers: { authorization: 'Bearer fixture-key' },
			});
			expect(JSON.parse(inspection.body)).toMatchObject({
				model: 'gpt-4o-mini',
				messages: expect.any(Array),
			});
		} finally {
			nock.disableNetConnect();
		}
	});
});
