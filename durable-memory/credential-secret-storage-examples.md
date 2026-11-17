# Connector credential storage examples

These examples show the data shapes at each storage boundary. Every secret value is fake. The examples do not call a connector service.

## Create a static connector credential

This editor API payload creates a GitHub API credential. The accessToken field has a password marker in the credential declaration. The oauthTokenData object illustrates runtime token storage and is not required for GitHub basic token authentication.

```json
{
  "name": "Example GitHub credential",
  "type": "githubApi",
  "data": {
    "server": "https://api.github.com",
    "user": "example-user",
    "accessToken": "fake-connector-secret-storage-value",
    "oauthTokenData": {
      "access_token": "fake-oauth-access-token",
      "refresh_token": "fake-oauth-refresh-token"
    }
  }
}
```

The database row has the same name and type. Its data value is an encrypted string. The following JSON is a schematic row, not a valid ciphertext fixture.

```json
{
  "id": "credential-id",
  "name": "Example GitHub credential",
  "type": "githubApi",
  "data": "encrypted-complete-json-object"
}
```

The plaintext access token and OAuth tokens must not occur in this data string. Decryption with the correct instance and deployment keys returns the complete original data object.

## Read through the editor API

An actor with update permission can request credential data. The response redacts declared password fields and replaces OAuth token data with connection state.

```json
{
  "data": {
    "id": "credential-id",
    "name": "Example GitHub credential",
    "type": "githubApi",
    "data": {
      "server": "https://api.github.com",
      "user": "example-user",
      "accessToken": "***",
      "oauthTokenData": true
    }
  }
}
```

The actual blanking sentinel comes from CREDENTIAL_BLANKING_VALUE in [constants.ts](../packages/workflow/src/constants.ts). The three asterisks above illustrate the redacted shape. A read-only sharee receives credential metadata without the data property.

## Update with a redacted value

An editor can return the redaction sentinel when it changes non-secret fields. The service restores the stored access token before encryption. It also preserves the existing OAuth token object.

```json
{
  "name": "Renamed GitHub credential",
  "type": "githubApi",
  "data": {
    "server": "https://github.example.com",
    "user": "example-user",
    "accessToken": "***",
    "oauthTokenData": true
  }
}
```

The real editor update path removes incoming oauthTokenData before it prepares the update. An integration test should use the actual sentinel constant instead of the illustrative three asterisks.

## Reference a credential from a workflow node

A workflow node stores a reference for each supported credential type. It does not copy the encrypted or decrypted data into the workflow.

```json
{
  "name": "GitHub",
  "type": "n8n-nodes-base.gitHub",
  "credentials": {
    "githubApi": {
      "id": "credential-id",
      "name": "Example GitHub credential"
    }
  }
}
```

Deleting or replacing this reference does not define credential deletion. Credential lifecycle and workflow authorization are separate operations.

## Reference an external secret

A credential field can contain an expression that reads an external provider. This example stores the expression string in the encrypted credential object.

```json
{
  "name": "External secret example",
  "type": "httpHeaderAuth",
  "data": {
    "name": "Authorization",
    "value": "={{ $secrets.vault.apiKey }}"
  }
}
```

The vault provider returns apiKey at runtime. The credential row does not contain the fetched value. Provider connection settings and project access control this read.

## Executable example

[credential-secret-storage.test.ts](../packages/cli/test/integration/credentials/credential-secret-storage.test.ts) is the executable form of the static credential examples. It uses the real API, database, cipher, credential declarations, and sharing rules. It blocks external connector calls. See [the test guide](credential-secret-storage-testing.md) for commands.
