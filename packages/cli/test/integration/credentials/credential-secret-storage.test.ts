import { RoleCacheService } from '@n8n/backend-services';
import { mockInstance, testDb } from '@n8n/backend-test-utils';
import type { Project, User } from '@n8n/db';
import { CredentialsRepository, ProjectRepository } from '@n8n/db';
import { Container } from '@n8n/di';
import { CREDENTIAL_BLANKING_VALUE } from 'n8n-workflow';

import { UserManagementMailer } from '@/user-management/email';

import { decryptCredentialData, getCredentialSharings } from '../shared/db/credentials';
import { createMember } from '../shared/db/users';
import type { SuperAgentTest } from '../shared/types';
import { initCredentialsTypes, setupTestServer } from '../shared/utils';

const ACCESS_TOKEN = 'fake-connector-secret-storage-value';
const OAUTH_ACCESS_TOKEN = 'fake-oauth-access-token';
const OAUTH_REFRESH_TOKEN = 'fake-oauth-refresh-token';

const credentialPayload = () => ({
	name: 'Credential storage contract',
	type: 'githubApi',
	data: {
		server: 'https://api.github.com',
		user: 'example-user',
		accessToken: ACCESS_TOKEN,
		oauthTokenData: {
			access_token: OAUTH_ACCESS_TOKEN,
			refresh_token: OAUTH_REFRESH_TOKEN,
		},
	},
});

const testServer = setupTestServer({
	endpointGroups: ['credentials'],
	enabledFeatures: ['feat:sharing'],
});

mockInstance(UserManagementMailer);

let owner: User;
let sharee: User;
let ownerProject: Project;
let shareeProject: Project;
let ownerAgent: SuperAgentTest;
let shareeAgent: SuperAgentTest;

beforeAll(async () => {
	await Container.get(RoleCacheService).refreshCache();
	await initCredentialsTypes();
});

beforeEach(async () => {
	await testDb.truncate(['SharedCredentials', 'CredentialsEntity', 'Project', 'ProjectRelation']);

	owner = await createMember();
	sharee = await createMember();

	const projectRepository = Container.get(ProjectRepository);
	ownerProject = await projectRepository.getPersonalProjectForUserOrFail(owner.id);
	shareeProject = await projectRepository.getPersonalProjectForUserOrFail(sharee.id);

	ownerAgent = testServer.authAgentFor(owner);
	shareeAgent = testServer.authAgentFor(sharee);
});

afterEach(() => {
	vi.clearAllMocks();
});

test('stores encrypted connector and OAuth data, redacts reads, and preserves secrets on update', async () => {
	const payload = credentialPayload();
	const createResponse = await ownerAgent.post('/credentials').send(payload).expect(200);
	const credentialId = createResponse.body.data.id as string;

	expect(JSON.stringify(createResponse.body)).not.toContain(ACCESS_TOKEN);
	expect(JSON.stringify(createResponse.body)).not.toContain(OAUTH_ACCESS_TOKEN);
	expect(JSON.stringify(createResponse.body)).not.toContain(OAUTH_REFRESH_TOKEN);

	const credentialsRepository = Container.get(CredentialsRepository);
	const stored = await credentialsRepository.findOneByOrFail({ id: credentialId });

	expect(stored.data).toEqual(expect.any(String));
	expect(stored.data).not.toContain(ACCESS_TOKEN);
	expect(stored.data).not.toContain(OAUTH_ACCESS_TOKEN);
	expect(stored.data).not.toContain(OAUTH_REFRESH_TOKEN);
	expect(await decryptCredentialData(stored)).toEqual(payload.data);

	const ownerSharings = await getCredentialSharings(stored);
	expect(ownerSharings).toHaveLength(1);
	expect(ownerSharings[0]).toMatchObject({
		projectId: ownerProject.id,
		role: 'credential:owner',
	});

	const readResponse = await ownerAgent
		.get(`/credentials/${credentialId}`)
		.query({ includeData: true })
		.expect(200);

	expect(readResponse.body.data.data).toMatchObject({
		server: payload.data.server,
		user: payload.data.user,
		accessToken: CREDENTIAL_BLANKING_VALUE,
		oauthTokenData: true,
	});
	expect(JSON.stringify(readResponse.body)).not.toContain(ACCESS_TOKEN);
	expect(JSON.stringify(readResponse.body)).not.toContain(OAUTH_ACCESS_TOKEN);
	expect(JSON.stringify(readResponse.body)).not.toContain(OAUTH_REFRESH_TOKEN);

	const updateResponse = await ownerAgent
		.patch(`/credentials/${credentialId}`)
		.send({
			name: 'Updated credential storage contract',
			type: payload.type,
			data: {
				...payload.data,
				server: 'https://github.example.com',
				accessToken: CREDENTIAL_BLANKING_VALUE,
				oauthTokenData: { access_token: 'fake-replacement-token' },
			},
		})
		.expect(200);

	expect(JSON.stringify(updateResponse.body)).not.toContain(ACCESS_TOKEN);
	expect(JSON.stringify(updateResponse.body)).not.toContain(OAUTH_ACCESS_TOKEN);
	expect(JSON.stringify(updateResponse.body)).not.toContain(OAUTH_REFRESH_TOKEN);

	const updated = await credentialsRepository.findOneByOrFail({ id: credentialId });
	expect(updated.name).toBe('Updated credential storage contract');
	expect(updated.data).not.toContain(ACCESS_TOKEN);
	expect(await decryptCredentialData(updated)).toEqual({
		...payload.data,
		server: 'https://github.example.com',
	});
});

test('shares a credential without changing or exposing its stored secret', async () => {
	const payload = credentialPayload();
	const createResponse = await ownerAgent.post('/credentials').send(payload).expect(200);
	const credentialId = createResponse.body.data.id as string;
	const credentialsRepository = Container.get(CredentialsRepository);
	const stored = await credentialsRepository.findOneByOrFail({ id: credentialId });

	await ownerAgent
		.put(`/credentials/${credentialId}/share`)
		.send({ shareWithIds: [shareeProject.id] })
		.expect(200);

	const sharings = await getCredentialSharings(stored);
	expect(sharings).toHaveLength(2);
	expect(sharings).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ projectId: ownerProject.id, role: 'credential:owner' }),
			expect.objectContaining({ projectId: shareeProject.id, role: 'credential:user' }),
		]),
	);

	const storedAfterSharing = await credentialsRepository.findOneByOrFail({ id: credentialId });
	expect(await decryptCredentialData(storedAfterSharing)).toEqual(payload.data);

	const shareeResponse = await shareeAgent
		.get(`/credentials/${credentialId}`)
		.query({ includeData: true })
		.expect(200);

	expect(shareeResponse.body.data.id).toBe(credentialId);
	expect(shareeResponse.body.data.data).toBeUndefined();
	expect(JSON.stringify(shareeResponse.body)).not.toContain(ACCESS_TOKEN);
	expect(JSON.stringify(shareeResponse.body)).not.toContain(OAUTH_ACCESS_TOKEN);
	expect(JSON.stringify(shareeResponse.body)).not.toContain(OAUTH_REFRESH_TOKEN);
	expect(JSON.stringify(shareeResponse.body)).not.toContain(stored.data);
});
