import { failure, Result, success } from "./utils/result";

export const baseCharacters = "-a-zA-Z0-9._ ";

export function getSafeName(
	rawFileName: string,
	additionalCharacters = "",
	forceLowercase = false,
): string {
	const safeAdditionalCharacters = additionalCharacters.replace(/[[\]]/g, "");
	const regexp = new RegExp(
		`[^${baseCharacters}${safeAdditionalCharacters}]`,
		"g",
	);

	let result = rawFileName;

	if (forceLowercase) {
		result = result.toLocaleLowerCase();
	}

	result = result
		// Replace dashes with hyphen.
		.replace(/[–—]/g, "-")
		// Replace apostrophe with single quote.
		.replace(/'/g, "'")
		// Replace curled quotes with straight quotes.
		.replace(/[""]/g, '"')
		// Replace unkown characters.
		.replace(regexp, "-")
		.trim();

	return result;
}

/**
 * Mutates the frontmatter.
 */
export function getNewAliases(
	existingAliases: unknown,
	newAlias: string,
): Result<string[], InsertAliasError> {
	let resultingAliases = [];

	if (Array.isArray(existingAliases)) {
		resultingAliases = structuredClone(existingAliases);
	} else if (
		typeof existingAliases === "undefined" ||
		existingAliases === null
	) {
		resultingAliases = [];
	} else {
		return failure({
			code: "not-array",
			data: {
				type: typeof existingAliases,
				// JSON.stringify can throw an exception when its input contains circular references or is a BigInt. I assume that those cannot happen in a frontmatter field.
				content: JSON.stringify(existingAliases),
			},
		});
	}

	// Prevent duplicate aliases
	if (!resultingAliases.includes(newAlias)) {
		resultingAliases.push(newAlias);
	}

	return success(resultingAliases);
}

export type InsertAliasError = {
	code: "not-array";
	data: { type: string; content: string };
};
