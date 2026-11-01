import { TAbstractFile } from "obsidian";

export class Path {
	private constructor(private segments: string[]) {}

	static fromFile(file: TAbstractFile): Path {
		return Path.fromString(file.path);
	}

	static fromString(path: string): Path {
		return new Path(Path.getSegments(path));
	}

	static forRenamedFile(file: TAbstractFile, newFilename: string): Path {
		const originalPath = this.fromFile(file);
		const folderPath = originalPath.parent();
		folderPath.append(newFilename);
		return folderPath;
	}

	parent(): Path {
		const newSegments = structuredClone(this.segments);
		newSegments.pop();
		return new Path(newSegments);
	}

	/**
	 * @returns The last segment, or `""` if the path is root.
	 */
	lastSegment(): string {
		if (this.segments.length > 0) {
			return this.segments[this.segments.length - 1];
		} else {
			return "";
		}
	}

	append(path: string) {
		const newSegments = Path.getSegments(path);
		this.segments = this.segments.concat(newSegments);
	}

	/**
	 *
	 * @returns The relative path. Root is `""`.
	 */
	toRelativeString(): string {
		return this.segments.join("/");
	}

	private static getSegments(raw: string): string[] {
		return raw.split("/").filter((part) => part.length !== 0) || [];
	}
}
