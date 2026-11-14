/**
 * Canonical mapping between language IDs and display names / Monaco editor keys.
 * Synchronized with Codebox runner (Judge0-compatible IDs).
 */

export interface LanguageInfo {
  id: number;
  name: string;
  monacoKey: string;
  extension: string;
}

export const SUPPORTED_LANGUAGES_MAP: Record<number, LanguageInfo> = {
  71: { id: 71, name: "Python 3.8", monacoKey: "python", extension: "py" },
  63: { id: 63, name: "JavaScript (Node 18)", monacoKey: "javascript", extension: "js" },
  54: { id: 54, name: "C++ (GCC 9)", monacoKey: "cpp", extension: "cpp" },
  50: { id: 50, name: "C (GCC 9)", monacoKey: "c", extension: "c" },
  62: { id: 62, name: "Java (OpenJDK 17)", monacoKey: "java", extension: "java" },
};

export function getLanguageInfo(languageId?: number | null): LanguageInfo {
  if (languageId && SUPPORTED_LANGUAGES_MAP[languageId]) {
    return SUPPORTED_LANGUAGES_MAP[languageId];
  }
  return {
    id: languageId ?? 0,
    name: languageId ? `Language #${languageId}` : "Text / MCQ",
    monacoKey: "plaintext",
    extension: "txt",
  };
}
