import { describe, expect, test } from "@jest/globals";
import { getNewAliases, getSafeName } from "./safe-name";
import { failure, success } from "./result";

describe("getSafeName", () => {
	test("returns safe name unchanged", () => {
		const input = "This is a valid filename";
		const result = getSafeName(input);
		expect(result).toBe(input);
	});

	test("replaces unsafe characters", () => {
		const input = "This is not valid?";
		const result = getSafeName(input);
		expect(result).toBe("This is not valid-");
	});

	test("trims outer whitespace", () => {
		const input = " There is whitespace";
		const result = getSafeName(input);
		expect(result).toBe("There is whitespace");
	});

	test("allows additional characters", () => {
		const input = "Fancy (exotic) Ž?";
		const result = getSafeName(input, "(Ž");
		expect(result).toBe("Fancy (exotic- Ž-");
	});

	describe("lowercase", () => {
		test("lowercases ASCII uppercase when forceLowercase is true", () => {
			const input = "My File Name";
			const result = getSafeName(input, "", true);
			expect(result).toBe("my file name");
		});

		test("lowercases non-ASCII letters that are in additionalCharacters", () => {
			const input = "Ärger";
			const result = getSafeName(input, "ä", true);
			expect(result).toBe("ärger");
		});

		test("preserves case when forceLowercase is omitted", () => {
			const input = "My File Name";
			const result = getSafeName(input);
			expect(result).toBe("My File Name");
		});

		test("forceLowercase still trims and replaces unsafe characters", () => {
			const input = " Bad?Name ";
			const result = getSafeName(input, "", true);
			expect(result).toBe("bad-name");
		});
	});
});

describe("insertAliasInFrontmatter", () => {
	test("adds new alias to existing aliases", () => {
		const newAlias = "insertMe";
		const existingAliases = ["existingAlias"];
		const result = getNewAliases(existingAliases, newAlias);

		expect(result).toStrictEqual(success(["existingAlias", newAlias]));
	});

	test("does not add alias redundantly if already present", () => {
		const newAlias = "alreadyExists";
		const existingAliases = ["alreadyExists"];
		const result = getNewAliases(existingAliases, newAlias);

		expect(result).toStrictEqual(success(["alreadyExists"]));
	});

	test("does not mutate the original array", () => {
		const newAlias = "insertMe";
		const existingAliases = ["existingAlias"];
		getNewAliases(existingAliases, newAlias);

		expect(existingAliases).toStrictEqual(["existingAlias"]);
	});

	test("when aliases is missing, it creates an array with new alias", () => {
		const newAlias = "insertMe";
		const existingAliases = undefined;
		const result = getNewAliases(existingAliases, newAlias);

		expect(result).toStrictEqual(success([newAlias]));
	});

	test("aborts when aliases is not an array", () => {
		const newAlias = "insertMe";
		const existingAliases = "just a string, not an array";
		const result = getNewAliases(existingAliases, newAlias);

		expect(result).toStrictEqual(
			failure({
				code: "not-array",
				data: {
					type: "string",
					content: '"just a string, not an array"',
				},
			}),
		);
	});
});
