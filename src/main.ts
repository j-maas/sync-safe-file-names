import {
	App,
	Editor,
	EventRef,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";
import { failure, Result, success } from "./utils/result";
import {
	baseCharacters,
	getNewAliases,
	getSafeName,
	InsertAliasError,
} from "./safe-name";
import { FileRenameInfo, getFilesToRename, getRenameReport } from "./report";
import { Path } from "./utils/path";

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

const renameAllCommandName = "Rename all files to be sync-safe";
const reportCommandName = "Insert report of all unsafe file names";

export default class SyncSafePlugin extends Plugin {
	settings: SyncSafeSettings;
	automaticRenameCallbacks: EventRef[];

	async onload() {
		await this.loadSettings();
		this.automaticRenameCallbacks = [];

		this.addCommand({
			id: "rename-all-sync-safe",
			name: renameAllCommandName,
			callback: () => {
				this.triggerRenamingAllFiles().catch(console.error);
			},
		});

		this.addCommand({
			id: "report-all",
			name: reportCommandName,
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
							this.giveNoticeAboutResult(result);
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

	updateRenameCallbacks() {
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
		this.giveNoticeAboutResult(result, false);
	}

	giveNoticeAboutResult(
		result: Result<RenameResult, RenameError>,
		noticeWhenAlreadySafe = true,
	) {
		if (result.success) {
			if (result.data.alreadySafe && noticeWhenAlreadySafe) {
				shortNotice(`File name was already sync-safe.`);
				return;
			}

			if (!result.data.alreadySafe) {
				if (result.data.aliasError === undefined) {
					shortNotice(`Renamed file to be sync-safe.`);
				} else {
					longNotice(
						`Renamed file to be sync-safe, but could not safely update aliases: Instead of a list it is a ${result.data.aliasError.data.type} containing '${result.data.aliasError.data.content}'.`,
					);
				}
			}
		} else {
			if (result.error.code === "alreadyExists") {
				longNotice(
					`Sync-safe: Could not rename file to "${result.error.data.safeName}" because that file already exists.`,
				);
			} else {
				longNotice(
					`Sync-safe: Could not rename file to "${result.error.data.safeName}" because of an error: ${result.error.message}`,
				);
			}
		}
	}

	async generateReport(editor: Editor) {
		const allFiles = this.app.vault.getFiles();
		const report = await getRenameReport(
			allFiles,
			this.settings.additionalCharacters,
			this.settings.forceLowercase,
		);

		editor.replaceRange(report, editor.getCursor());
	}

	async triggerRenamingAllFiles() {
		const allFiles = this.app.vault.getFiles();
		const { filesToRename, conflictingFiles } = await getFilesToRename(
			allFiles,
			this.settings.additionalCharacters,
			this.settings.forceLowercase,
		);

		if (filesToRename.length === 0) {
			shortNotice(`All file names are already sync-safe.`);
			return;
		}

		const conflictCount = conflictingFiles.length;

		new ConfirmRenameAllModal(
			this.app,
			filesToRename.length,
			conflictCount,
			() => {
				this.renameAllFiles(filesToRename).catch(console.error);
			},
		).open();
	}

	async renameAllFiles(filesToRename: FileRenameInfo[]) {
		const results = await Promise.all(
			filesToRename.map(async (entry) => {
				const newPath = Path.forRenamedFile(entry.file, entry.safeName);
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
			shortNotice(`Successfully renamed ${successes} file(s).`);
		} else {
			longNotice(
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
			const newPath = Path.forRenamedFile(file, safeName);

			let aliasError: InsertAliasError | undefined;
			if (file instanceof TFile && this.settings.addOriginalAlias) {
				const result = await this.setAlias(file, file.basename);
				if (!result.success) {
					aliasError = result.error;
				}
			}
			const result = await this.moveFile(file, newPath);
			if (result.success) {
				return success({
					alreadySafe: false,
					aliasError,
					previousName,
					safeName,
				});
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
		const previousName = file.name;
		const safeName = getSafeName(
			file.name,
			this.settings.additionalCharacters,
			this.settings.forceLowercase,
		);

		if (!(file instanceof TFolder) && !(file instanceof TFile)) {
			throw new Error(
				"Unknown file type. File is neither folder nor file.",
			);
		}

		return { previousName, safeName };
	}

	async moveFile(
		file: TAbstractFile,
		newPath: Path,
	): Promise<Result<boolean, MoveFileError>> {
		try {
			await this.app.fileManager.renameFile(
				file,
				newPath.toRelativeString(),
			);
			return success(true);
		} catch (e) {
			if (e instanceof Error) {
				return failure({ code: "alreadyExists", message: e.message });
			} else {
				throw e;
			}
		}
	}

	async setAlias(
		file: TFile,
		newAlias: string,
	): Promise<Result<void, InsertAliasError>> {
		let error: InsertAliasError | undefined;
		await this.app.fileManager.processFrontMatter(
			file,
			(frontmatter: { aliases?: unknown }) => {
				const result = getNewAliases(frontmatter.aliases, newAlias);
				if (result.success) {
					frontmatter.aliases = result.data;
				} else {
					error = result.error;
				}
			},
		);
		if (error === undefined) {
			return success(undefined);
		} else {
			return failure(error);
		}
	}
}

type RenameResult = {
	alreadySafe: boolean;
	aliasError?: InsertAliasError;
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

	getSettingDefinitions(): SettingDefinitionItem<keyof SyncSafeSettings>[] {
		return [
			{
				name: "Rename automatically",
				desc: "If active, all new files will be renamed automatically.",
				render: (setting) => {
					setting.addToggle((toggle) =>
						toggle
							.setValue(this.plugin.settings.renameAutomatically)
							.onChange(async (value) => {
								this.plugin.settings.renameAutomatically =
									value;
								await this.plugin.saveSettings();

								this.plugin.updateRenameCallbacks();
							}),
					);
				},
			},
			{
				name: "Keep original name as alias",
				desc: "When a file name is rewritten, the original file name (without file extension) is added as an alias so that it can still be used to link to the file. If the file name is already safe, no alias will be added.",
				control: { type: "toggle", key: "addOriginalAlias" },
			},
			{
				name: "Lowercase",
				desc: "If active, converts all uppercase letters to lowercase.",
				control: { type: "toggle", key: "forceLowercase" },
			},
			{
				name: "Allowed special characters",
				desc: `Specify characters that should be allowed in addition to the basics.\nAlways allowed are roman letters, numbers, hyphen, dot, underline and space (/[${baseCharacters}]/).`,
				control: { type: "textarea", key: "additionalCharacters" },
			},
		];
	}
}

class ConfirmRenameAllModal extends Modal {
	constructor(
		app: App,
		private readonly renameCount: number,
		private readonly confliceCount: number,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen() {
		this.setTitle("Rename all files to be sync-safe?");

		const fileCountDisplay =
			this.renameCount === 1 ? "1 file" : `${this.renameCount} files`;
		let countInfo = `This will rename ${fileCountDisplay} in your vault so that their names are sync-safe.`;

		if (this.confliceCount > 0) {
			const conflictCountDisplay =
				this.confliceCount === 1
					? "1 file"
					: `${this.confliceCount} files`;
			countInfo += ` ${conflictCountDisplay} will be skipped, because their names conflict with existing files.`;
		}

		this.contentEl.createEl("p", {
			text: countInfo,
		});
		this.contentEl.createEl("p", {
			text: `This cannot be undone. Consider making a backup of your vault first. To preview the affected files, open a new note and run the command '${reportCommandName}' in it.`,
		});

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText("Rename all")
					.setDestructive()
					.setCta()
					.onClick(() => {
						this.onConfirm();
						this.close();
					}),
			);
	}
}

function shortNotice(message: string) {
	new Notice(message, 5000);
}

function longNotice(message: string) {
	new Notice(message, 10_000);
}
