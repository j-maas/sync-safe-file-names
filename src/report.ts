import { TFile } from "obsidian";
import { Path } from "./utils/path";
import { getSafeName } from "./safe-name";
import { PathMap } from "./utils/pathMap";

export async function getRenameReport(
	allFiles: TFile[],
	additionalCharacters: string,
	forceLowercase: boolean,
): Promise<string> {
	const { filesToRename, conflictingFiles } = await getFilesToRename(
		allFiles,
		additionalCharacters,
		forceLowercase,
	);

	const totalUnsafeFiles = filesToRename.length + conflictingFiles.length;
	if (totalUnsafeFiles === 0) {
		return "All files are already sync-safe.";
	}

	conflictingFiles.sort((left, right) =>
		left.file.path.localeCompare(right.file.path),
	);
	filesToRename.sort((left, right) =>
		left.file.path.localeCompare(right.file.path),
	);

	const conflictCount = conflictingFiles.length;

	let summary = `${totalUnsafeFiles} files should be renamed to be sync-safe:`;
	if (conflictCount > 0) {
		summary = `${totalUnsafeFiles} files should be renamed to be sync-safe, but ${conflictCount} of these cannot be renamed due to an existing file:`;
	}

	const tableHeading =
		"| Current path| Current name | Safe name | Rename possible |\n|---|---|---|---|";
	const conflictTableRows = conflictingFiles.map((entry) => {
		return `| [[${entry.file.path}]] | ${entry.file.name} | ${entry.safeName} | No, already exists: [[${entry.conflictingPath?.toRelativeString()}]] |`;
	});
	const renameTableRows = filesToRename.map((entry) => {
		return `| [[${entry.file.path}]] | ${entry.file.name} | ${entry.safeName} | Yes |`;
	});

	const tableRows = conflictTableRows.concat(renameTableRows);

	return `${summary}\n\n${tableHeading}\n${tableRows.join("\n")}`;
}

export async function getFilesToRename(
	allFiles: TFile[],
	additionalCharacters: string,
	forceLowercase: boolean,
): Promise<FileRenameResult> {
	const pathMap = PathMap.fromFiles(allFiles);

	let filesToRename: FileRenameInfo[] = [];
	let conflictingFiles: FileConflictInfo[] = [];

	allFiles.forEach((file) => {
		const safeName = getSafeName(
			file.name,
			additionalCharacters,
			forceLowercase,
		);
		const isAlreadySafe = file.name === safeName;

		if (isAlreadySafe) {
			return;
		}

		const newPath = Path.forRenamedFile(file, safeName);
		const conflictingPath = pathMap.getRenameConflictPath({
			currentPath: Path.fromFile(file),
			newPath,
		});
		if (conflictingPath === undefined) {
			filesToRename.push({
				safeName,
				file,
			});
		} else {
			conflictingFiles.push({
				safeName,
				file,
				conflictingPath,
			});
		}
	});

	return {
		filesToRename,
		conflictingFiles,
		pathMap,
	};
}

export type FileRenameResult = {
	filesToRename: FileRenameInfo[];
	conflictingFiles: FileConflictInfo[];
	pathMap: PathMap;
};

export type FileRenameInfo = {
	safeName: string;
	file: TFile;
};

export type FileConflictInfo = FileRenameInfo & {
	conflictingPath: Path;
};
