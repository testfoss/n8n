<!-- generated-by: lmhtml index -->
# Index

Read the relevant chapter before changing this repository.

- [Connector credential storage examples](credential-secret-storage-examples.md) — These examples show the data shapes at each storage boundary. Every secret value is fake. The examples do not call a connector service.
- [Reusable credential store extraction](credential-secret-storage-extraction.md) — The end goal is a separate project that other applications can reuse. The first extraction should cover static project credentials. It should preserve n8n ciphertext compatibility and keep authorization ahead of decryption.
- [Connector credential storage tests](credential-secret-storage-testing.md) — The focused integration suite defines the behavior that a future standalone credential store must preserve. It uses the production n8n API, credential service, cipher, and database adapters.
- [Connector credential secret storage](credential-secret-storage.md) — This chapter maps the common storage path for n8n connector credentials. It also records the stores that use different semantics. The source baseline is n8n upstream master commit fea1ec010611045cea92f0e7fecdf2f59e79618b.
- [n8n workflows with lmmock](lmmock-workflows.md) — These examples execute real n8n workflows over real loopback HTTP sockets. lmmock supplies the external Telegram and OpenAI-compatible APIs. No live provider, paid model, or real credential is involved.
