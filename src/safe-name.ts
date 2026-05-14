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
