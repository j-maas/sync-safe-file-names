# Lowercase-only option — design

## Goal

Add a plugin setting that, when enabled, converts uppercase letters in file
names to lowercase as part of the sync-safe rename. This helps users who sync
between case-sensitive and case-insensitive file systems (or who simply prefer
all-lowercase names).

## Setting

- Field: `forceLowercase: boolean` on `SyncSafeSettings`.
- Default: `false` (non-breaking; existing users see no change).
- UI: a new toggle in `SyncSafeSettingTab`, placed after the "Allowed special
  characters" setting.
  - Name: **Force lowercase**
  - Description: *"If active, converts all uppercase letters to lowercase."*

## Behavior

When `forceLowercase` is on, `getSafeName` applies `.toLowerCase()` as the
final step, after the existing character replacements, regex filtering, and
trim. The function will receive the basename, not the extension.

When `forceLowercase` is off, `getSafeName` returns the same result as today.

### Interaction with `additionalCharacters`

The allowlist regex runs **before** lowercasing. That means uppercase
characters survive the regex if and only if their exact code point is in
`baseCharacters` or in `additionalCharacters`. After surviving, they are
lowercased.

- ASCII uppercase (`A`–`Z`): always in `baseCharacters`, so they always
  survive and then get lowercased to `a`–`z`.
- Non-ASCII uppercase (e.g. `Ä`): only survives if it is listed in
  `additionalCharacters`. With `forceLowercase` enabled, the user can list
  either `Ä` or both `Ä`/`ä` — the resulting file name uses the lowercase
  form regardless.

The existing default `additionalCharacters` value (which includes pairs like
`Ää`, `Öö`, etc.) continues to work correctly under `forceLowercase`.

### Interaction with `addOriginalAlias`

Unchanged. The alias is set from the file's original basename (with its
original capitalization), so links using the original name continue to work
after the file is renamed to a lowercase form.

### Interaction with `renameAutomatically`

Unchanged. The same rename path runs; it just produces a lowercase result
when the new setting is enabled.

## API shape

`getSafeName` gains a third positional parameter, defaulting to `false`:

```ts
export function getSafeName(
  rawFileName: string,
  additionalCharacters = "",
  forceLowercase = false,
): string
```

Chosen over an options object because the function currently has one extra
parameter and the diff stays minimal. Existing callers continue to compile
without changes.

## Code touchpoints

- **`src/safe-name.ts`**
  - Add the `forceLowercase = false` parameter.
  - At the end of the transformation pipeline, apply
    `forceLowercase ? result.toLowerCase() : result`.
- **`src/safe-name.test.ts`**
  - New tests:
    - `forceLowercase=true` lowercases ASCII uppercase.
    - `forceLowercase=true` lowercases non-ASCII letters that are in
      `additionalCharacters` (e.g. `Ä` → `ä`).
    - `forceLowercase=false` (default) preserves case (regression check).
    - `forceLowercase=true` does not break trim/replacement behavior.
- **`main.ts`**
  - Add `forceLowercase: boolean` to `SyncSafeSettings` and `DEFAULT_SETTINGS`
    (default `false`).
  - In `getSafeNameFromFilename`, pass `this.settings.forceLowercase` as the
    third argument to `getSafeName`. The basename/extension split is already
    handled upstream by `extractNamesFromAbstractFile`, so no other plumbing
    is needed.
  - In `SyncSafeSettingTab.display`, add a new `Setting` toggle after the
    "Allowed special characters" setting.
- **`README.md`**
  - Brief mention of the new option.

## Non-goals

- No filesystem-level case-folding detection. The setting is opt-in and
  applied uniformly when on.
- No migration / one-shot conversion command beyond what already exists
  ("Rename all files to be sync-safe" already re-runs `getSafeName` across
  the vault).

## Testing

Unit tests in `safe-name.test.ts` cover the new parameter. Manual sanity
check in Obsidian: toggle the setting, create a file named `Foo Bar.md`,
confirm it renames to `foo bar.md`; toggle off, create `Baz.md`, confirm it
stays `Baz.md`.
