import { describe, expect, test } from "@jest/globals";
import { Path } from "./path";

describe("Path", () => {
	test("output is equal to the input", () => {
		const input = "this/is/a/path";
		const path = Path.fromString(input);
		expect(path.toRelativeString()).toBe(input);
	});

	test("empty path stays empty", () => {
		const input = "";
		const path = Path.fromString(input);
		expect(path.toRelativeString()).toBe(input);
	});

	test("empty segments are removed", () => {
		const input = "just//one";
		const path = Path.fromString(input);
		expect(path.toRelativeString()).toBe("just/one");
	});

	describe(".equals()", () => {
		test("detects equal siblings", () => {
			const path1 = Path.fromString("same");
			const path2 = Path.fromString("same");
			expect(path1.equals(path2)).toBe(true);
		});

		test("distinguishes different sibling", () => {
			const path1 = Path.fromString("first");
			const path2 = Path.fromString("second");
			expect(path1.equals(path2)).toBe(false);
		});

		test("distinguishes same file in different folders", () => {
			const path1 = Path.fromString("first/same");
			const path2 = Path.fromString("second/same");
			expect(path1.equals(path2)).toBe(false);
		});
	});

	describe(".parent()", () => {
		test("returns the parent path", () => {
			const input = "folder/file";
			const path = Path.fromString(input);
			const parent = path.parent();
			expect(parent.toRelativeString()).toBe("folder");
		});

		test("does not modify the original path", () => {
			const input = "this/is/a/path";
			const path = Path.fromString(input);
			path.parent();
			expect(path.toRelativeString()).toBe(input);
		});

		test("the parent of root is root", () => {
			const input = "rootFile";
			const path = Path.fromString(input);
			const parent = path.parent();
			expect(parent.toRelativeString()).toBe("");
		});
	});

	describe(".lastSegment()", () => {
		test("returns the last segment of a root path", () => {
			const input = "file";
			const path = Path.fromString(input);
			const lastSegment = path.lastSegment();
			expect(lastSegment).toBe("file");
		});

		test("returns the last segment of a nested path", () => {
			const input = "folder/file";
			const path = Path.fromString(input);
			const lastSegment = path.lastSegment();
			expect(lastSegment).toBe("file");
		});

		test("return empty string for root", () => {
			const input = "";
			const path = Path.fromString(input);
			const lastSegment = path.lastSegment();
			expect(lastSegment).toBe("");
		});
	});
});
