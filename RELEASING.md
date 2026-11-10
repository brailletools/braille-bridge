# Releasing braille-bridge

`main` only changes through pull requests, and every release is a version tag on `main`.
Other repos depend on those tags (webeditor clones the tag named in its `braille-bridge.version`),
so a tag always means the same code.

## Making a change

1. Branch from an up-to-date `main`: `git switch main && git pull && git switch -c my-change`.
2. Open a pull request. CI (`lint`, `test`) must pass before it can merge.
3. Merge the PR. Never push to `main` directly.

## Cutting a release

1. In a PR, bump `version` in `package.json` (pre-1.0: bump the minor for features or breaking
   changes, the patch for fixes) and merge it.
2. Tag the merge commit — the tag **must equal `v` + the `package.json` version**:

   ```bash
   git switch main && git pull
   git log -1 --oneline            # confirm this is the merge commit you mean to release
   git tag v0.3.2
   git push origin v0.3.2
   ```

3. The **Release** workflow validates the tag (format `vX.Y.Z`; matches `package.json`; the commit
   is on `main`) and creates a GitHub Release with generated notes. If validation fails, the
   workflow run says why.

Tags are protected: `v*` tags can be created but **never moved or deleted**. If a tag turns out to
be wrong, don't try to fix it — publish the next patch version. (If you truly must remove one, an
admin has to temporarily disable the tag ruleset in Settings → Rules.)

## Rolling a release out to webeditor

webeditor doesn't pick up new braille-bridge releases by itself. In a webeditor PR, change
`braille-bridge.version` to the new tag. CI clones that tag, so a pin to a tag that doesn't exist
yet fails — **tag first, then bump the pin**. A weekly workflow in webeditor opens an issue when
its pin is behind the latest tag.
