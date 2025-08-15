import { describe, expect } from "@jest/globals"
import { test } from "@fast-check/jest"
import { getSafeName } from "./safe-name";

describe("getSafeName", () => {
    test("returns safe name unchanged", () => {
        const input = "This is a valid filename.md";
        const result = getSafeName(input);
        expect(result).toBe(input)
    });

    test("replaces unsafe characters", () => {
        const input = "This is not valid?.md"
        const result = getSafeName(input);
        expect(result).toBe("This is not valid-.md")
    });

    test("trims outer whitespace", () => {
        const input = " There is whitespace.md"
        const result = getSafeName(input)
        expect(result).toBe("There is whitespace.md")
    })

    test("allows additional characters", () => {
        const input = "Fancy (exotic) Ž?.md"
        const result = getSafeName(input, "(Ž")
        expect(result).toBe("Fancy (exotic- Ž-.md")
    })
});