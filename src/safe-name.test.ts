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
});
