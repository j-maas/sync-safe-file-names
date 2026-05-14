import { describe, expect, test } from "@jest/globals";
import { getSafeName } from "./safe-name";

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

	test("lowercases ASCII uppercase when forceLowercase is true", () => {
		const input = "My File Name";
		const result = getSafeName(input, "", true);
		expect(result).toBe("my file name");
	});

	test("lowercases non-ASCII letters that are in additionalCharacters", () => {
		const input = "Ärger";
		const result = getSafeName(input, "Ää", true);
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
