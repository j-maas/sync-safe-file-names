import { describe, expect, test } from "@jest/globals";
import { PathMap } from "./report";
import { Path } from "./path";

describe("PathMap", () => {
	test("a free path in the root folder is available", () => {
		const allFilePaths = ["file1", "file2"].map((path) =>
			Path.fromString(path),
		);
		const pathMap = PathMap.fromPaths(allFilePaths);
		const result = pathMap.isPathAvailable(Path.fromString("file3"));
		expect(result).toBe(true);
	});

	test("a free path in the same folder is available", () => {
		const allFilePaths = ["folder/file1", "folder/file2"].map((path) =>
			Path.fromString(path),
		);
		const pathMap = PathMap.fromPaths(allFilePaths);
		const result = pathMap.isPathAvailable(Path.fromString("folder/file3"));
		expect(result).toBe(true);
	});

	test("a free path in a different folder is available", () => {
		const allFilePaths = ["folder1/file1", "folder2/file2"].map((path) =>
			Path.fromString(path),
		);
		const pathMap = PathMap.fromPaths(allFilePaths);
		const result = pathMap.isPathAvailable(
			Path.fromString("folder3/file3"),
		);
		expect(result).toBe(true);
	});

	test("a path that matches an existing is not avaiable", () => {
		const allFilePaths = ["existing"].map((path) => Path.fromString(path));
		const pathMap = PathMap.fromPaths(allFilePaths);
		const result = pathMap.getConflictingPath(Path.fromString("existing"));
		expect(result).toStrictEqual(Path.fromString("existing"));
	});

	test("a path that uses different letter casing to an existing is conflicting", () => {
		const allFilePaths = ["EXISTING"].map((path) => Path.fromString(path));
		const pathMap = PathMap.fromPaths(allFilePaths);
		const result = pathMap.getConflictingPath(Path.fromString("existing"));
		expect(result).toStrictEqual(Path.fromString("EXISTING"));
	});

	test("a path that conflicts in a different folder is available", () => {
		const allFilePaths = ["existing", "folder/different"].map((path) =>
			Path.fromString(path),
		);
		const pathMap = PathMap.fromPaths(allFilePaths);
		const result = pathMap.isPathAvailable(
			Path.fromString("folder/existing"),
		);
		expect(result).toBe(true);
	});
});
