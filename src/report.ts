import { TFile } from "obsidian";
import { Path } from "./utils/path";
import { getSafeName } from "./safe-name";
import { PathMap } from "./utils/pathMap";

export async function getRenameReport(
	allFiles: TFile[],
	additionalCharacters: string,
	forceLowercase: boolean,
): Promise<string> {
	const filesToRename = await getFilesToRename(
		allFiles,
		additionalCharacters,
		forceLowercase,
	);
	const pathMap = PathMap.fromFiles(allFiles);

	if (filesToRename.length === 0) {
		return "All files are already sync-safe.";
	}

	filesToRename.sort((left, right) =>
		left.file.path.localeCompare(right.file.path),
	);
	const checkedFiles = filesToRename.map((entry) => {
		const newPath = Path.forRenamedFile(entry.file, entry.safeName);
		const conflictingPath = pathMap.getConflictingPath(newPath);
		return {
			conflictingPath,
			...entry,
		};
	});

	const conflictCount = checkedFiles.filter(
		(file) => file.conflictingPath !== undefined,
	).length;

	let summary = `${filesToRename.length} files should be renamed to be sync-safe:`;
	if (conflictCount > 0) {
		summary = `${filesToRename.length} files should be renamed to be sync-safe (${conflictCount} cannot be renamed due to an existing file):`;
	}

	const tableHeading =
		"| Current path| Current name | Safe name | Rename possible |\n|---|---|---|---|";
	const tableRows = checkedFiles.map((entry) => {
		const renamePossible =
			entry.conflictingPath === undefined
				? "Yes"
				: `No, already exists: [[${entry.conflictingPath?.toRelativeString()}]]`;
		return `| [[${entry.file.path}]] | ${entry.file.name} | ${entry.safeName} | ${renamePossible} |`;
	});

	return `${summary}\n\n${tableHeading}\n${tableRows.join("\n")}`;
}

export async function getFilesToRename(
	allFiles: TFile[],
	additionalCharacters: string,
	forceLowercase: boolean,
): Promise<{ isAlreadySafe: boolean; safeName: string; file: TFile }[]> {
	return allFiles
		.map((file) => {
			const safeName = getSafeName(
				file.name,
				additionalCharacters,
				forceLowercase,
			);
			const isAlreadySafe = file.name === safeName;
			return {
				isAlreadySafe,
				safeName,
				file,
			};
		})
		.filter((entry) => !entry.isAlreadySafe);
}
