import {
	App,
	Editor,
	EventRef,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";
import { failure, Result, success } from "src/result";
import { baseCharacters, getSafeName } from "src/safe-name";

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

export default class SyncSafePlugin extends Plugin {
	settings: SyncSafeSettings;
	automaticRenameCallbacks: EventRef[];

	async onload() {
		await this.loadSettings();
		this.automaticRenameCallbacks = [];

		this.addCommand({
			id: "rename-all-sync-safe",
			name: "Rename all files to be sync-safe",
			callback: () => {
				this.renameAllFiles().catch(console.error);
			},
		});

		this.addCommand({
			id: "report-all",
			name: "Insert report of all unsafe file names",
			editorCallback: (editor) => {
				this.generateReport(editor).catch(console.error);
			},
		});

		this.addCommand({
			id: "rename-single-sync-safe",
			name: "Rename current file to be sync-safe",
			editorCheckCallback: (checking, _, view) => {
				if (checking) {
					return view.file !== null;
				} else if (view.file !== null) {
					this.renameSingleFile(view.file)
						.then((result) => {
							if (result.success) {
								if (result.data.alreadySafe) {
									new Notice(
										`File name was already sync-safe.`,
									);
								} else {
									new Notice(`Renamed file to be sync-safe.`);
								}
							} else {
								if (result.error.code === "alreadyExists") {
									new Notice(
										`Could not rename file to "${result.error.data.safeName}" because that file already exists.`,
									);
								} else {
									new Notice(
										`Could not rename file to "${result.error.data.safeName}" because of an error: ${result.error.message}`,
									);
								}
							}
						})
						.catch(console.error);
				} else {
					new Notice(`Could not find an active file to rename.`);
				}
			},
		});

		this.addSettingTab(new SyncSafeSettingTab(this.app, this));

		if (this.settings.renameAutomatically) {
			this.registerAutomaticRenaming();
		}
	}

	registerAutomaticRenaming() {
		// Obsidian fires the `create` event for every file on startup. Therefore, we should only register after the layout is ready, according to https://docs.obsidian.md/Plugins/Guides/Optimizing+plugin+load+time#Option+B.+Register+the+handler+once+the+layout+is+ready.
		this.app.workspace.onLayoutReady(() => {
			const callbacks = [
				this.app.vault.on(
					"create",
					(file) => this.onCreate(file),
					this,
				),
				this.app.vault.on(
					"rename",
					(file) => this.onRename(file),
					this,
				),
			];
			callbacks.forEach((callback) => this.registerEvent(callback));
			this.automaticRenameCallbacks = callbacks;
		});
	}

	unregisterAutomaticRenaming() {
		this.automaticRenameCallbacks.forEach((callback) =>
			this.app.vault.offref(callback),
		);
		this.automaticRenameCallbacks = [];
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as SyncSafeSettings,
		);
	}

	async saveSettings() {
		if (
			this.settings.renameAutomatically &&
			this.automaticRenameCallbacks.length === 0
		) {
			this.registerAutomaticRenaming();
		} else if (
			!this.settings.renameAutomatically &&
			this.automaticRenameCallbacks.length > 0
		) {
			this.unregisterAutomaticRenaming();
		}

		await this.saveData(this.settings);
	}

	async onRename(file: TAbstractFile) {
		await this.renameSingleFileSilently(file);
	}

	onCreate(file: TAbstractFile) {
		window.setTimeout(() => {
			this.renameSingleFileSilently(file).catch(console.error);
		}, 100);
	}

	async renameSingleFileSilently(file: TAbstractFile) {
		const result = await this.renameSingleFile(file);
		if (result.success) {
			if (!result.data.alreadySafe) {
				new Notice(`Renamed file to make it sync-safe.`);
			}
		} else {
			if (result.error.code === "alreadyExists") {
				new Notice(
					`Sync-safe: Could not rename to "${result.error.data.safeName}" because that file already exists.`,
				);
			} else {
				new Notice(
					`Sync-safe: Could not rename to "${result.error.data.safeName}" because of an error: ${result.error.message}`,
				);
			}
		}
	}

	async generateReport(editor: Editor) {
		const filesToRename = await this.getFilesToRename();

		if (filesToRename.length === 0) {
			editor.replaceRange(
				"All files are already sync-safe.",
				editor.getCursor(),
			);
			return;
		}

		filesToRename.sort((left, right) =>
			left.file.path.localeCompare(right.file.path),
		);
		const checkedFiles = filesToRename.map((entry) => {
			const newPath = this.getSafePath(entry.file, entry.safeName);
			const newFile = this.app.vault.getAbstractFileByPath(
				newPath.join("/"),
			);
			const newPathAvailable = newFile === null;
			return {
				newPathAvailable,
				...entry,
			};
		});

		const tableHeading =
			"| Current path| Current name | Safe name | Rename possible |\n|---|---|---|---|";
		const tableRows = checkedFiles.map((entry) => {
			const renamePossible = entry.newPathAvailable
				? "Yes"
				: `No, already exists: [[${this.getSafePath(entry.file, entry.safeName).join("/")}]]`;
			return `| [[${entry.file.path}]] | ${entry.file.name} | ${entry.safeName} | ${renamePossible} |`;
		});
		const report = `${filesToRename.length} files should be renamed to be sync-safe:\n\n${tableHeading}\n${tableRows.join("\n")}`;

		editor.replaceRange(report, editor.getCursor());
	}

	async getFilesToRename(): Promise<
		{ isAlreadySafe: boolean; safeName: string; file: TFile }[]
	> {
		const allFiles = this.app.vault.getFiles();
		return allFiles
			.map((file) => {
				const safeName = this.getSafeNameFromFilename(file.name);
				const isAlreadySafe = file.name === safeName;
				return {
					isAlreadySafe,
					safeName,
					file,
				};
			})
			.filter((entry) => !entry.isAlreadySafe);
	}

	async renameAllFiles() {
		const filesToRename = await this.getFilesToRename();
		const results = await Promise.all(
			filesToRename.map(async (entry) => {
				const newPath = this.getSafePath(entry.file, entry.safeName);
				return this.moveFile(entry.file, newPath);
			}),
		);

		let successes = 0;
		let failures = 0;
		results.forEach((result) => {
			if (result.success) {
				successes += 1;
			} else {
				failures += 1;
			}
		});

		if (failures === 0) {
			new Notice(`Successfully renamed ${successes} file(s).`);
		} else {
			new Notice(
				`Failed to rename ${failures} file(s). Successfully renamed ${successes} file(s).`,
			);
		}
	}

	async renameSingleFile(
		file: TAbstractFile,
	): Promise<Result<RenameResult, RenameError>> {
		const { previousName, safeName } =
			this.extractNamesFromAbstractFile(file);

		if (previousName === safeName) {
			return success({ alreadySafe: true, previousName });
		} else {
			const newPath = this.getSafePath(file, safeName);

			if (file instanceof TFile && this.settings.addOriginalAlias) {
				await this.setAlias(file, file.basename);
			}
			const result = await this.moveFile(file, newPath);
			if (result.success) {
				return success({ alreadySafe: false, previousName, safeName });
			} else if (result.error.code === "alreadyExists") {
				return failure({
					code: "alreadyExists",
					data: { safeName },
					message: result.error.message,
				});
			} else {
				return failure({
					code: "unspecified",
					data: { safeName },
					message: result.error.message,
				});
			}
		}
	}

	extractNamesFromAbstractFile(file: TAbstractFile): {
		previousName: string;
		safeName: string;
	} {
		let previousName, safeName;

		if (file instanceof TFolder) {
			previousName = file.name;
			safeName = this.getSafeNameFromFilename(file.name);
		} else if (file instanceof TFile) {
			previousName = file.name;
			const safeBaseName = this.getSafeNameFromFilename(file.basename);
			safeName = `${safeBaseName}.${file.extension}`;
		} else {
			throw new Error(
				"Unknown file type. File is neither folder nor file.",
			);
		}

		return { previousName, safeName };
	}

	getSafeNameFromFilename(fileName: string): string {
		return getSafeName(
			fileName,
			this.settings.additionalCharacters,
			this.settings.forceLowercase,
		);
	}

	getSafePath(file: TAbstractFile, safeName: string): string[] {
		const newPath =
			file.parent?.path.split("/").filter((part) => part.length !== 0) ||
			[];
		newPath.push(safeName);

		return newPath;
	}

	async moveFile(
		file: TAbstractFile,
		newPath: string[],
	): Promise<Result<boolean, MoveFileError>> {
		try {
			await this.app.fileManager.renameFile(file, newPath.join("/"));
			return success(true);
		} catch (e) {
			if (e instanceof Error) {
				return failure({ code: "alreadyExists", message: e.message });
			} else {
				throw e;
			}
		}
	}

	async setAlias(file: TFile, alias: string): Promise<void> {
		return this.app.fileManager.processFrontMatter(
			file,
			(frontmatter: { aliases?: unknown }) => {
				if (!Array.isArray(frontmatter.aliases)) {
					frontmatter.aliases = [];
				}
				// Prevent duplicate aliases
				else if (!frontmatter.aliases.includes(alias)) {
					frontmatter.aliases.push(alias);
				}
			},
		);
	}
}

type RenameResult = {
	alreadySafe: boolean;
	previousName: string;
	newName?: string;
};

type MoveFileError = { code: "alreadyExists"; message?: string };

type RenameError =
	| { code: "alreadyExists"; data: { safeName: string }; message?: string }
	| { code: "unspecified"; data: { safeName: string }; message?: string };

class SyncSafeSettingTab extends PluginSettingTab {
	plugin: SyncSafePlugin;

	constructor(app: App, plugin: SyncSafePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Rename automatically")
			.setDesc("If active, all new files will be renamed automatically.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.renameAutomatically)
					.onChange(async (value) => {
						this.plugin.settings.renameAutomatically = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Keep original name as alias")
			.setDesc(
				"When a file name is rewritten, the original file name (without file extension) is added as an alias so that it can still be used to link to the file. If the file name is already safe, no alias will be added.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.addOriginalAlias)
					.onChange(async (value) => {
						this.plugin.settings.addOriginalAlias = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Lowercase")
			.setDesc("If active, converts all uppercase letters to lowercase.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.forceLowercase)
					.onChange(async (value) => {
						this.plugin.settings.forceLowercase = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Allowed special characters")
			.setDesc(
				`Specify characters that should be allowed in addition to the basics.\nAlways allowed are roman letters, numbers, hyphen, dot, underline and space (/[${baseCharacters}]/).`,
			)
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.additionalCharacters)
					.onChange(async (value) => {
						this.plugin.settings.additionalCharacters = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
