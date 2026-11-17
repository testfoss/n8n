import { NodeTestHarness } from '@nodes-testing/node-test-harness';
import type { WorkflowTestData } from 'n8n-workflow';
import nock from 'nock';

const hasLmmock = Boolean(process.env.LMMOCK_URL);

describe.skipIf(!hasLmmock)('Telegram workflow with lmmock', () => {
	const lmmockUrl = process.env.LMMOCK_URL!;
	const testHarness = new NodeTestHarness();

	beforeEach(() => {
		nock.enableNetConnect('127.0.0.1');
	});

	afterEach(() => {
		nock.disableNetConnect();
	});

	const testData: WorkflowTestData = {
		description: 'executes Telegram message and chat operations through lmmock',
		input: {
			workflowData: testHarness.readWorkflowJSON('lmmock.workflow.json'),
		},
		output: {
			nodeData: {
				'Send Message': [
					[
						{
							json: {
								ok: true,
								result: expect.objectContaining({
									message_id: 1,
									text: 'hello from lmmock',
									chat: expect.objectContaining({ id: 987654321 }),
									from: expect.objectContaining({ is_bot: true, username: 'lmmock_bot' }),
								}),
							},
						},
					],
				],
				'Get Chat': [
					[
						{
							json: {
								ok: true,
								result: expect.objectContaining({
									id: 987654321,
									type: 'private',
									username: 'fixture_user',
								}),
							},
						},
					],
				],
			},
			nodeExecutionOrder: ['Manual Trigger', 'Send Message', 'Get Chat'],
		},
	};

	testHarness.setupTest(testData, {
		credentials: {
			telegramApi: {
				accessToken: '123456:fixture-telegram-token',
				baseUrl: lmmockUrl,
			},
		},
	});
});
