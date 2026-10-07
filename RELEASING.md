# Releasing Chativa

Everything publishes from one git tag. There is no token to rotate: npm auth is
[trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers).

## The normal release

```bash
git checkout main && git pull
git tag v0.18.0 && git push origin v0.18.0
```

Pushing a `v*` tag runs [.github/workflows/release.yml](.github/workflows/release.yml), which:

1. stamps every workspace package with the version from the tag
   (`pnpm -r exec npm version <v> --no-git-tag-version` — versions in the repo
   stay untouched; the tag is the source of truth),
2. installs, tests and builds,
3. publishes each `@chativa/*` package with `pnpm publish` (OIDC, provenance
   signed; `workspace:*` deps are rewritten to real versions),
4. creates the GitHub Release with generated notes.

Pick the version by what shipped since the last tag: `feat:` commits → minor,
fixes only → patch. A tag that never published (the run failed before the first
`Publish` step) may be deleted and re-pointed; a tag that published anything may
not — bump instead.

## Why publishing works (and what breaks it)

Each package on npmjs.com has a **trusted publisher** bound to exactly:
owner `AimTune` (case-sensitive!), repo `chativa`, workflow file `release.yml`.
The workflow exchanges its GitHub OIDC token for a short-lived npm credential —
no `NPM_TOKEN` secret exists or is needed.

Requirements the workflow already satisfies — keep them when editing it:

- `permissions: id-token: write` on the job,
- pnpm ≥ 10.9 (OIDC support) and a Node version new enough for that pnpm
  (pnpm 11 needs Node ≥ 22.13),
- no `NODE_AUTH_TOKEN` / `registry-url` auth lines — an empty token env var
  shadows the OIDC flow and turns every publish into a 404.

**Troubleshooting a publish 404/403:**

| Symptom | Cause |
|---|---|
| `Skipped OIDC … token exchange … 404` | No trusted publisher matches: wrong owner case (`aimtune` ≠ `AimTune`), wrong workflow filename, an Environment name set on npmjs.com that the job doesn't use, or the package has no publisher configured at all. Fields are case-sensitive and not validated on save — errors only surface at publish time. |
| `404 Not Found - PUT …` with no OIDC warning | Dead/expired token in the environment (should not happen anymore — no token is configured). |
| `403 … cannot publish over previously published versions` | That version already exists; the tag points at the wrong place or the release already ran. Bump and re-tag. |

## Adding a new package

1. Add the publish step to `release.yml` (copy a sibling step).
2. Merge, then **publish the first version manually** — npm can only attach a
   trusted publisher to a package that already exists:

   ```powershell
   pnpm install && pnpm build
   cd packages/<new> ; pnpm publish --access public --no-git-checks ; cd ../..
   npm trust github "@chativa/<new>" --file release.yml --repo AimTune/chativa -y
   npm trust list "@chativa/<new>" --json   # expect AimTune/chativa + release.yml
   ```

   (`npm trust` needs an interactive 2FA approval in the browser; commands run
   within ~5 minutes of an approval don't re-prompt.)
3. From the next tag on, the pipeline handles it.

The published placeholder version doesn't matter — the next tag overwrites the
line (versions come from the tag, not the manifest).

## Related repos

`mekik` (server) and `ilmek` (runtime) release differently: versions live in
the repo (`chore(release): X` commit bumping every manifest +
`dotnet/Directory.Build.props`), and the tag's `release-npm.yml` runs
`pnpm -r publish`, which picks up new workspace packages automatically — their
trusted publishers are bound to **`release-npm.yml`**, not `release.yml`. The
NuGet side packs the whole solution and pushes via NuGet trusted publishing
(`NuGet/login@v1`). See each repo's own `RELEASING.md`.
