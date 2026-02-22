# Add Tests

Add tests for an existing source file that lacks coverage.

Usage: `/add-test src/application/registries/ConnectorRegistry.ts`

---

Given the file path `$ARGUMENTS`:

1. Read the source file at `$ARGUMENTS` thoroughly.
2. Identify the `__tests__` directory next to it (create if needed).
3. Create a test file named `[FileName].test.ts` in that directory.
4. Write comprehensive tests covering:
   - All exported functions and methods
   - Happy path (normal usage)
   - Edge cases (empty input, missing items, duplicates)
   - Error cases (should throw, should not throw)
5. Use Vitest patterns:
   ```ts
   import { describe, it, expect, vi, beforeEach } from "vitest";
   ```
6. Use `beforeEach` to reset any global state (call `.clear()` on registries).
7. Run `npm test` after writing to confirm all pass.
8. Report coverage if it improved.
