# Lowercase-only option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in plugin setting that, when enabled, lowercases the basename of every file as part of the sync-safe rename.

**Architecture:** Add a third optional parameter `forceLowercase` to `getSafeName` in `src/safe-name.ts`; when `true`, apply `.toLowerCase()` as the final transformation step. Add a matching `forceLowercase: boolean` setting to `SyncSafeSettings`, surface it as a toggle in the settings tab, and pass it through `getSafeNameFromFilename` (the only call site). The basename/extension split is already handled by `extractNamesFromAbstractFile`, so the extension is never lowercased.

**Tech Stack:** TypeScript 4.7, Jest 30 (via ts-jest), Obsidian plugin API, esbuild.

**Spec:** `docs/superpowers/specs/2026-05-14-lowercase-only-option-design.md`

**Pre-flight check (do once before starting):**

```bash
cd /Users/johannes.maas/Obsidian/Dev/.obsidian/plugins/sync-safe-file-names
npm test
```
Expected: all 4 existing `getSafeName` tests pass. This establishes a green baseline before changes.

---

### Task 1: Add `forceLowercase` parameter to `getSafeName`

**Files:**
- Modify: `src/safe-name.ts`
- Test: `src/safe-name.test.ts`

- [ ] **Step 1: Write failing test for ASCII uppercase**

Append inside the `describe("getSafeName", ...)` block in `src/safe-name.test.ts`:

```ts
test("lowercases ASCII uppercase when forceLowercase is true", () => {
    const input = "My File Name";
    const result = getSafeName(input, "", true);
    expect(result).toBe("my file name");
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- -t "lowercases ASCII uppercase"
```
Expected: FAIL. The third positional argument is currently ignored, so the result is still `"My File Name"`.

- [ ] **Step 3: Add the parameter and apply it**

In `src/safe-name.ts`, change the signature and append a lowercase step:

```ts
export const baseCharacters = "-a-zA-Z0-9._ ";

export function getSafeName(
    rawFileName: string,
    additionalCharacters = "",
    forceLowercase = false,
): string {
    const safeAdditionalCharacters = additionalCharacters.replace(/[[\]]/g, "");
    const regexp = new RegExp(
        `[^${baseCharacters}${safeAdditionalCharacters}]`,
        "g",
    );

    const result = rawFileName
        // Replace dashes with hyphen.
        .replace(/[–—]/g, "-")
        // Replace apostrophe with single quote.
        .replace(/’/g, "'")
        // Replace curled quotes with straight quotes.
        .replace(/[“”]/g, '"')
        // Replace unkown characters.
        .replace(regexp, "-")
        .trim();

    return forceLowercase ? result.toLowerCase() : result;
}
```

- [ ] **Step 4: Run the new test, verify it passes**

```bash
npm test -- -t "lowercases ASCII uppercase"
```
Expected: PASS.

- [ ] **Step 5: Add a test for non-ASCII letters allowed via `additionalCharacters`**

Append to the same `describe` block:

```ts
test("lowercases non-ASCII letters that are in additionalCharacters", () => {
    const input = "Ärger";
    const result = getSafeName(input, "Ää", true);
    expect(result).toBe("ärger");
});
```

- [ ] **Step 6: Add a regression test for the default (no lowercase) behavior**

```ts
test("preserves case when forceLowercase is omitted", () => {
    const input = "My File Name";
    const result = getSafeName(input);
    expect(result).toBe("My File Name");
});
```

- [ ] **Step 7: Add a test confirming trim/replacement still works under forceLowercase**

```ts
test("forceLowercase still trims and replaces unsafe characters", () => {
    const input = " Bad?Name ";
    const result = getSafeName(input, "", true);
    expect(result).toBe("bad-name");
});
```

- [ ] **Step 8: Run the full test suite, verify all green**

```bash
npm test
```
Expected: all tests pass (4 pre-existing + 4 new = 8).

- [ ] **Step 9: Commit**

```bash
git add src/safe-name.ts src/safe-name.test.ts
git commit -m "Add forceLowercase option to getSafeName"
```

---

### Task 2: Wire the setting through `main.ts` and add the UI toggle

**Files:**
- Modify: `main.ts`

- [ ] **Step 1: Add `forceLowercase` to `SyncSafeSettings` and `DEFAULT_SETTINGS`**

In `main.ts`, change the interface (around lines 16–20) and the defaults (around lines 22–26):

```ts
interface SyncSafeSettings {
    renameAutomatically: boolean;
    addOriginalAlias: boolean;
    additionalCharacters: string;
    forceLowercase: boolean;
}

const DEFAULT_SETTINGS: SyncSafeSettings = {
    renameAutomatically: true,
    addOriginalAlias: true,
    additionalCharacters: "&+'(),$€ÄäÖöÜüßÀàÉéÈèÇçÂâÊêËëÏïÎîÔôŒœÆæ",
    forceLowercase: false,
};
```

- [ ] **Step 2: Pass `forceLowercase` into `getSafeName`**

In `main.ts`, update `getSafeNameFromFilename` (around line 297):

```ts
getSafeNameFromFilename(fileName: string): string {
    return getSafeName(
        fileName,
        this.settings.additionalCharacters,
        this.settings.forceLowercase,
    );
}
```

- [ ] **Step 3: Add the toggle in `SyncSafeSettingTab.display`**

In `main.ts`, after the "Allowed special characters" `new Setting(...)` block (ends around line 396), append a new block:

```ts
new Setting(containerEl)
    .setName("Force lowercase")
    .setDesc("If active, converts all uppercase letters to lowercase.")
    .addToggle((toggle) =>
        toggle
            .setValue(this.plugin.settings.forceLowercase)
            .onChange(async (value) => {
                this.plugin.settings.forceLowercase = value;
                await this.plugin.saveSettings();
            }),
    );
```

- [ ] **Step 4: Type-check and build**

```bash
npm run build
```
Expected: builds cleanly with no TypeScript errors. The build script runs `tsc -noEmit -skipLibCheck` first, which will catch typos in property names.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```
Expected: all tests still pass — `main.ts` is not directly tested, but a green safe-name suite confirms nothing in `src/` broke.

- [ ] **Step 6: Manual smoke test in Obsidian**

(If running in an environment without Obsidian, skip this step and note it in the commit message / PR description.)

1. Copy the built `main.js` and `manifest.json` into a test vault's `.obsidian/plugins/sync-safe-file-names/` (or use the dev vault).
2. Reload Obsidian (Cmd-R in dev mode) or toggle the plugin off/on.
3. Open Settings → Sync-safe file names. Confirm the new **Force lowercase** toggle appears below "Allowed special characters", defaulted to off.
4. With the toggle **off**: create a file named `Foo Bar.md`. Expected: file is not renamed (or only existing rules apply).
5. With the toggle **on**: create a file named `Baz Qux.md`. Expected: renamed to `baz qux.md`. The extension stays `.md` because `extractNamesFromAbstractFile` splits before calling `getSafeName`.
6. Toggle back to **off**: create `Quux.md`. Expected: stays `Quux.md`.

- [ ] **Step 7: Commit**

```bash
git add main.ts
git commit -m "Add force-lowercase setting to plugin"
```

---

### Task 3: Document the new option in the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a brief mention of the new option**

In `README.md`, locate the "Getting started" section (starts around line 13). Append a short paragraph after the numbered list:

```markdown
## Options

The plugin settings include a **Force lowercase** option. When enabled, file names are also converted to lowercase as part of the sync-safe rename (e.g. `Foo Bar.md` becomes `foo bar.md`). The file extension is preserved. This is useful when syncing between case-sensitive and case-insensitive file systems.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document force-lowercase option in README"
```

---

## Self-review notes (already addressed inline)

- **Spec coverage:** Setting field + default (Task 2 step 1), UI toggle text (Task 2 step 3), `getSafeName` parameter + final lowercase step (Task 1 step 3), all four test cases from the spec (Task 1 steps 1, 5, 6, 7), main.ts wiring (Task 2 step 2), README mention (Task 3). The `addOriginalAlias` and `renameAutomatically` interactions need no code — they "fall out" of routing through the existing call chain — and that's confirmed by the manual smoke test.
- **Placeholder scan:** No TBDs, every code step has complete code, every command has expected output.
- **Type consistency:** `forceLowercase: boolean` is the same name in `SyncSafeSettings`, `DEFAULT_SETTINGS`, the `getSafeName` parameter, and the settings UI binding.
