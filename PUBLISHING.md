1. Update the version in `package.json`.
2. If necessary, update the [`minAppVersion`](https://docs.obsidian.md/Reference/TypeScript+API/PluginManifest/minAppVersion) in `manifest.json`.
3. Run `npm run version`.
4. Commit the updated files.
5. Push commit.
6. Run `git tag -a 1.0.1 -m "1.0.1"` with the appropriate version number.
7. Run `git push origin 1.0.1` with the appropriate version number.
8. Wait for the release [action](https://github.com/j-maas/sync-safe-file-names/actions) to complete.
9. Edit the draft [release](https://github.com/j-maas/sync-safe-file-names/releases).
