import { TFile } from "obsidian";
import { Path } from "./path";

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

	/**
	 * @param newPath The path to check for availability.
	 * @param currentPath The path the file currently occupies. This allows us to detect renames and prevent false conflicts.
	 * @returns true if newPath is available, otherwise false.
	 */
	isRenameAvailable(paths: { currentPath: Path; newPath: Path }): boolean {
		return this.getRenameConflictPath(paths) === undefined;
	}

	/**
	 * @param newPath The path to check for availability.
	 * @param currentPath The path the file currently occupies. This allows us to detect renames and prevent false conflicts.
	 * @returns `undefined` if newPath is available, otherwise a Path to the conflicting file.
	 */
	getRenameConflictPath(paths: {
		currentPath: Path;
		newPath: Path;
	}): Path | undefined {
		const { newPath, currentPath } = paths;

		const folder = newPath.parent().toRelativeString();
		const file = newPath.lastSegment().toLocaleLowerCase();

		const existingFiles = this.map.get(folder);
		if (existingFiles === undefined) {
			return undefined;
		}
		const potentialConflict = existingFiles.get(file);
		if (potentialConflict === undefined) {
			return undefined;
		} else if (potentialConflict.equals(currentPath)) {
			return undefined;
		} else {
			return potentialConflict;
		}
	}
}
