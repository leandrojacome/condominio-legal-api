# IdempotencyRecord contract

Migration: `20260605161000_idempotency_records`

`IdempotencyRecord` stores persisted responses for tenant-scoped sensitive routes that require `Idempotency-Key`.

## Table

Prisma model/table: `IdempotencyRecord`

Columns:

- `id`: text primary key, Prisma `cuid()`.
- `condominioId`: tenant id, FK to `Condominio(id)` with cascade delete.
- `operationScope`: route/use-case scope, varchar(160). Use a stable value such as `financeiro.emitir_pix`.
- `idempotencyKey`: client header value, varchar(128).
- `requestHash`: canonical request hash, varchar(128). Backend must compare this on replay and reject same key with a different payload.
- `responseStatus`: enum `pending | completed | failed`, default `pending`.
- `statusCode`: HTTP status code, nullable until completed.
- `responseHeaders`: JSON metadata/headers to replay, nullable.
- `responseBody`: JSON response body to replay, nullable until completed.
- `expiresAt`: retention cutoff for cleanup.
- `criadoEm`: creation timestamp.
- `atualizadoEm`: update timestamp.

## Constraints and indexes

- Unique: `(condominioId, operationScope, idempotencyKey)`.
- Check: completed records require `statusCode` and `responseBody`.
- Check: `statusCode` must be between 100 and 599 when present.
- Index: `(condominioId, expiresAt)` for tenant-scoped cleanup/listing.
- Index: `(condominioId, operationScope, requestHash)` for replay validation.
- Index: `expiresAt` for global cleanup.

## Backend usage

Recommended helper flow:

1. Compute `operationScope` from the route/use case and `requestHash` from a canonicalized request payload.
2. In a transaction, insert `pending` for `(condominioId, operationScope, idempotencyKey)`.
3. If the insert conflicts, load the existing row.
4. If `requestHash` differs, return a conflict/validation error without executing the use case.
5. If the existing row is `completed`, replay `statusCode`, `responseHeaders`, and `responseBody`.
6. If this request owns the new `pending` row, execute the use case once and update the row to `completed` with the final response.

## RLS/security

The table is server-only. The migration enables RLS and deliberately creates no `anon` or `authenticated` policies; direct Supabase client access is not part of the contract. Backend access should use the server database connection or Supabase service role.

## Expiration

No scheduled job is introduced by this migration. Existing backend/server maintenance can delete rows where `expiresAt < now()`; the `expiresAt` indexes support that cleanup without adding new infrastructure.
