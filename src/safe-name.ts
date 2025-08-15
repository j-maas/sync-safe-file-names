export function getSafeName(rawFileName: string): string {
    const german = "ÄäÖöÜüß"
    const french = "ÀàÉéÈèÇçÂâÊêËëÏïÎîÔôŒœÆæ"
    const additional = german.concat(french)
    const regexp = new RegExp(`[^-a-zA-Z0-9&+'"().,_ ${additional}]`, "g")
    return rawFileName
        // Replace dashes with hyphen.
        .replace(/[–—]/g, "-")
        // Replace apostrophe with single quote.
        .replace(/’/g, "'")
        // Replace curled quotes with straight quotes.
        .replace(/“”/g, "\"")
        // Replace unkown characters.
        .replace(regexp, "-").trim()
}