import { TFile } from "obsidian";
import { Path } from "./path";
import { getSafeName } from "./safe-name";

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

	const tableHeading =
		"| Current path| Current name | Safe name | Rename possible |\n|---|---|---|---|";
	const tableRows = checkedFiles.map((entry) => {
		const renamePossible =
			entry.conflictingPath === undefined
				? "Yes"
				: `No, already exists: [[${entry.conflictingPath?.toRelativeString()}]]`;
		return `| [[${entry.file.path}]] | ${entry.file.name} | ${entry.safeName} | ${renamePossible} |`;
	});
	return `${filesToRename.length} files should be renamed to be sync-safe:\n\n${tableHeading}\n${tableRows.join("\n")}`;
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

/**
 * Builds a map of all the file paths in the vault to enable checking whether a path is available for a rename.
 *
 * Checking whether a file exists at the desired path is not enough, since most operating systems do not allow different casing. E.g. if I want to creat "Test.md", but "test.md" already exists, then checking for "Test.md" seems fine, but creating it leads to an error, because the name conflicts with "test.md".
 *
 * Since we do not want to create files just to check whether the path is available, we instead cache each existing file in the vault and consult this map for whether paths are avaiable.
 */
export class PathMap {
	private constructor(private map: Map<string, Map<string, Path>>) {}

	static empty(): PathMap {
		return new PathMap(new Map());
	}

	static fromFiles(allFiles: TFile[]): PathMap {
		return PathMap.fromPaths(allFiles.map((file) => Path.fromFile(file)));
	}

	static fromPaths(allPaths: Path[]): PathMap {
		const map = PathMap.empty();

		allPaths.forEach((path) => {
			map.addPath(path);
		});

		return map;
	}

	addFile(file: TFile) {
		this.addPath(Path.fromFile(file));
	}

	addPath(path: Path) {
		const folder = path.parent().toRelativeString();
		const file = path.lastSegment().toLocaleLowerCase();

		let existingFiles = this.map.get(folder);
		if (existingFiles === undefined) {
			existingFiles = new Map();
		}

		existingFiles.set(file, path);
		this.map.set(folder, existingFiles);
	}

	isPathAvailable(newPath: Path): boolean {
		return this.getConflictingPath(newPath) === undefined;
	}

	/**
	 * @param newPath The path to check for availability.
	 * @returns `undefined` if newPath is available, otherwise a Path to the conflicting file.
	 */
	getConflictingPath(newPath: Path): Path | undefined {
		const folder = newPath.parent().toRelativeString();
		const file = newPath.lastSegment().toLocaleLowerCase();

		const existingFiles = this.map.get(folder);
		if (existingFiles === undefined) {
			return undefined;
		}
		const potentialConflict = existingFiles.get(file);
		if (potentialConflict === undefined) {
			return undefined;
		} else {
			return potentialConflict;
		}
	}
}
