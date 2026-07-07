/**
 * CodeBox Client for secure code execution.
 * Interacts with a Judge0-compatible self-hosted CodeBox server.
 */

const CODEBOX_URL = process.env.CODEBOX_URL || "http://localhost:3000";
const CODEBOX_TOKEN = process.env.CODEBOX_TOKEN || "dev-token";

export interface CodeBoxSubmissionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number; // in seconds
  memory_limit?: number; // in KB
}

export interface CodeBoxResult {
  status: {
    id: number;
    description: string;
  };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null; // execution time in seconds
  memory: number | null; // memory in KB
  message: string | null;
}

export const SUPPORTED_LANGUAGES = [
  { id: 71, name: "Python (3.8)", monacoKey: "python", defaultStarter: `import sys\n\ndef main():\n    # Read input from stdin and print result\n    line = sys.stdin.read().strip()\n    if line:\n        print(f"Hello, {line}!")\n\nif __name__ == "__main__":\n    main()` },
  { id: 63, name: "JavaScript (Node 18)", monacoKey: "javascript", defaultStarter: `const readline = require('readline');\n\nconst rl = readline.createInterface({\n    input: process.stdin,\n    output: process.stdout\n});\n\nrl.on('line', (line) => {\n    // Read input from stdin and print result\n    console.log(\`Hello, \${line}!\`);\n    process.exit(0);\n});` },
  { id: 54, name: "C++ (GCC 9)", monacoKey: "cpp", defaultStarter: `#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    // Read input from stdin and print result\n    string name;\n    if (cin >> name) {\n        cout << "Hello, " << name << "!" << endl;\n    }\n    return 0;\n}` },
  { id: 50, name: "C (GCC 9)", monacoKey: "c", defaultStarter: `#include <stdio.h>\n\nint main() {\n    // Read input from stdin and print result\n    char name[100];\n    if (scanf("%99s", name) == 1) {\n        printf("Hello, %s!\\n", name);\n    }\n    return 0;\n}` },
  { id: 62, name: "Java (OpenJDK 17)", monacoKey: "java", defaultStarter: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Read input from stdin and print result\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNext()) {\n            String name = scanner.next();\n            System.out.println("Hello, " + name + "!");\n        }\n        scanner.close();\n    }\n}` }
];

/**
 * Execute a single code submission on CodeBox.
 */
export async function executeSubmission(req: CodeBoxSubmissionRequest): Promise<CodeBoxResult> {
  const url = new URL(`${CODEBOX_URL}/submissions`);
  url.searchParams.set("wait", "true");

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": CODEBOX_TOKEN,
      },
      body: JSON.stringify({
        source_code: req.source_code,
        language_id: req.language_id,
        stdin: req.stdin || "",
        expected_output: req.expected_output || "",
        cpu_time_limit: req.cpu_time_limit ?? 5,
        memory_limit: req.memory_limit ?? 128000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: { id: 13, description: `CodeBox API error: ${response.status} ${response.statusText}` },
        stdout: null,
        stderr: errorText,
        compile_output: null,
        time: null,
        memory: null,
        message: `HTTP error ${response.status}`,
      };
    }

    return await response.json();
  } catch (err: any) {
    return {
      status: { id: 13, description: "Internal execution connection failed" },
      stdout: null,
      stderr: err.message || String(err),
      compile_output: null,
      time: null,
      memory: null,
      message: "Could not connect to CodeBox API server.",
    };
  }
}

/**
 * Check if the stdout matches expected output (ignoring line ending differences and whitespace)
 */
export function checkOutputsMatch(stdout: string | null, expected: string): boolean {
  const normStdout = (stdout || "").replace(/\r\n/g, "\n").trim();
  const normExpected = expected.replace(/\r\n/g, "\n").trim();
  return normStdout === normExpected;
}
