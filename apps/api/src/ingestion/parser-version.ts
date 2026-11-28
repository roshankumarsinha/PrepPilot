/**
 * Bump when parsing or chunking changes in a way that alters chunk text. A new version makes
 * the next sync re-parse every file; chunks whose text is unchanged keep their embeddings.
 */
export const PARSER_VERSION = 1;
