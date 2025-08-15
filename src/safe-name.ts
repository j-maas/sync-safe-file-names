export const baseCharacters = "-a-zA-Z0-9._ ";

export function getSafeName(rawFileName: string, additionalCharacters = ""): string {
    const safeAdditionalCharacters = additionalCharacters.replace(/[[\]]/g, "")
    const regexp = new RegExp(`[^${baseCharacters}${safeAdditionalCharacters}]`, "g")

    return rawFileName
        // Replace dashes with hyphen.
        .replace(/[–—]/g, "-")
        // Replace apostrophe with single quote.
        .replace(/’/g, "'")
        // Replace curled quotes with straight quotes.
        .replace(/[“”]/g, "\"")
        // Replace unkown characters.
        .replace(regexp, "-").trim()
}
