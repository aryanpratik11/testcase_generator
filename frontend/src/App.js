import { useState } from "react";
import axios from "axios";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [language, setLanguage] = useState("");
  const [generatedCases, setGeneratedCases] = useState([]);
  const [isLoading, setIsLoading] = useState({
    files: false,
    generating: false,
    codeGen: false
  });

  const extToLang = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cs: "csharp",
    rb: "ruby",
    go: "go",
    php: "php"
  };

  const parseRepoUrl = (url) => {
    try {
      const parts = url.split("/");
      const owner = parts[3];
      const repo = parts[4].replace(".git", "");
      return { owner, repo };
    } catch {
      return null;
    }
  };

  const handleLoadFiles = async () => {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      alert("Invalid GitHub repository URL");
      return;
    }

    try {
      setIsLoading(prev => ({ ...prev, files: true }));
      const res = await axios.get(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/main?recursive=1`
      );
      const fileList = res.data.tree.filter(
        (item) =>
          item.type === "blob" &&
          Object.keys(extToLang).some(ext =>
            item.path.toLowerCase().endsWith(`.${ext}`)
          )
      );
      setFiles(fileList);
    } catch (err) {
      console.error("Error fetching files:", err);
      alert("Could not fetch files from GitHub");
    } finally {
      setIsLoading(prev => ({ ...prev, files: false }));
    }
  };

  const handleFileToggle = (path) => {
    setSelectedFiles((prev) => {
      const newSelection = prev.includes(path)
        ? prev.filter((f) => f !== path)
        : [...prev, path];

      if (newSelection.length > 0) {
        const extCounts = {};
        newSelection.forEach((file) => {
          const ext = file.split(".").pop().toLowerCase();
          const lang = extToLang[ext];
          if (lang) extCounts[lang] = (extCounts[lang] || 0) + 1;
        });
        const detectedLang =
          Object.keys(extCounts).reduce((a, b) =>
            extCounts[a] > extCounts[b] ? a : b
          );
        setLanguage(detectedLang || "");
      } else {
        setLanguage("");
      }

      return newSelection;
    });
  };

  const fetchFileContent = async (owner, repo, path) => {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Accept: "application/vnd.github.v3.raw"
        }
      }
    );
    return { path, content: res.data };
  };

  const handleGenerate = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file");
      return;
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      alert("Invalid GitHub repository URL");
      return;
    }

    setIsLoading(prev => ({ ...prev, generating: true }));
    try {
      const fileContents = await Promise.all(
        selectedFiles.map((path) =>
          fetchFileContent(parsed.owner, parsed.repo, path)
        )
      );

      const res = await fetch("https://testcase-generator-backend-4js8.onrender.com/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileContents, language }),
      });

      const data = await res.json();
      setGeneratedCases(data.generatedCases || []);
    } catch (error) {
      console.error("Error generating test cases:", error);
      alert("Failed to generate test cases");
    } finally {
      setIsLoading(prev => ({ ...prev, generating: false }));
    }
  };

  const handleGenerateCode = async (summary) => {
    if (selectedFiles.length === 0) {
      alert("No files selected");
      return;
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      alert("Invalid GitHub repository URL");
      return;
    }

    setIsLoading(prev => ({ ...prev, codeGen: true }));

    try {
      const fileContents = await Promise.all(
        selectedFiles.map((path) =>
          fetchFileContent(parsed.owner, parsed.repo, path)
        )
      );

      const codeContext = fileContents
        .map(f => `File: ${f.path}\n${f.content}`)
        .join("\n\n");

      const res = await fetch("https://testcase-generator-backend-4js8.onrender.com/api/generateCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, language, codeContext }),
      });

      const data = await res.json();

      if (data.code) {
        const modal = document.createElement("div");
        modal.className =
          "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50";

        modal.innerHTML = `
        <div class="bg-gray-900 border-2 border-green-700 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div class="p-4 border-b border-green-800 flex justify-between items-center">
            <h3 class="text-lg font-bold text-green-400">Generated Test Code</h3>
            <button class="text-green-600 hover:text-green-400" id="close-modal">✕</button>
          </div>
          <pre class="flex-1 p-4 overflow-auto text-green-400 font-mono text-sm">${data.code}</pre>
          <div class="p-4 border-t border-green-800 flex justify-end gap-2">
            <button id="copy-code" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-black rounded">
              Copy Code
            </button>
            <button id="create-pr" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">
              Create PR
            </button>
          </div>
        </div>
      `;

        document.body.appendChild(modal);

        modal.querySelector("#close-modal").addEventListener("click", () => {
          document.body.removeChild(modal);
        });

        modal.querySelector("#copy-code").addEventListener("click", () => {
          navigator.clipboard.writeText(data.code);
          alert("Code copied to clipboard!");
        });

        modal.querySelector("#create-pr").addEventListener("click", async () => {
          const token = prompt("Enter your GitHub Personal Access Token");
          if (!token) return;

          try {
            const res = await fetch("https://testcase-generator-backend-4js8.onrender.com/api/create-pr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                owner: parsed.owner,
                repo: parsed.repo,
                filePath: `tests/generatedTest.spec.js`,
                fileContent: data.code,
                token
              })
            });

            const { prUrl } = await res.json();
            if (prUrl) {
              alert(`PR created: ${prUrl}`);
              window.open(prUrl, "_blank");
            } else {
              alert("Failed to create PR");
            }
          } catch (err) {
            console.error("PR creation failed:", err);
            alert("Error creating PR");
          }
        });
      } else {
        alert("No code was generated");
      }
    } catch (err) {
      console.error("Error generating full test case code:", err);
      alert("Failed to generate full test case code");
    } finally {
      setIsLoading(prev => ({ ...prev, codeGen: false }));
    }
  };


  return (
    <div className="min-h-screen bg-black text-green-500 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl">
        <header className="mb-8 border-b border-green-800 pb-4">
          <h1 className="text-4xl font-bold text-green-400 flex items-center">
            <span className="mr-2">⚡</span> GitHub Test Case Generator
          </h1>
          <p className="text-green-600 mt-2">
            Generate test cases directly from your GitHub repository
          </p>
        </header>

        <div className="mb-6 bg-gray-900 p-4 rounded border border-green-800">
          <h2 className="text-lg font-semibold text-green-400 mb-2">How to Use</h2>
          <ol className="list-decimal pl-6 space-y-2 text-green-300 text-sm">
            <li>Enter the URL of a public GitHub repository containing your code.</li>
            <li>Click <span className="text-green-400 font-bold">"Load Files"</span> to list all supported code files.</li>
            <li>Select one or more files to include in the test case analysis.</li>
            <li>The platform will auto-detect the programming language based on your file selection.</li>
            <li>Click <span className="text-green-400 font-bold">"Generate Test Cases"</span> to get scenario summaries.</li>
            <li>From the summaries, choose one and click <span className="text-green-400 font-bold">"Generate Code"</span> to produce full test case code.</li>
            <li>Use the <span className="text-green-400 font-bold">"Create PR"</span> button to push the test cases to GitHub.</li>
          </ol>
        </div>


        <div className="mb-6">
          <div className="flex gap-3 mb-2">
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="flex-1 p-3 rounded bg-gray-900 border border-green-700 text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleLoadFiles}
              disabled={isLoading.files || !repoUrl.trim()}
              className={`px-4 py-3 rounded font-bold transition-all ${isLoading.files || !repoUrl.trim()
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-black hover:bg-green-500"
                }`}
            >
              {isLoading.files ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-green-800 border-t-green-400 rounded-full animate-spin"></span>
                  Loading...
                </span>
              ) : (
                "Load Files"
              )}
            </button>
          </div>
          <p className="text-green-700 text-sm">
            Enter a public GitHub repository URL to analyze its code
          </p>
        </div>

        {files.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-green-400 font-medium">
                Select files to analyze ({selectedFiles.length} selected)
              </h3>
              {files.length > 10 && (
                <p className="text-green-700 text-sm">
                  Showing {files.length} code files
                </p>
              )}
            </div>

            <div className="bg-gray-900 p-4 rounded border border-green-800 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {files.map((file) => (
                  <label
                    key={file.path}
                    className={`flex items-center gap-2 p-2 rounded hover:bg-gray-800 ${selectedFiles.includes(file.path) ? "bg-gray-800" : ""
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.path)}
                      onChange={() => handleFileToggle(file.path)}
                      className="accent-green-500"
                    />
                    <span className="text-green-400 text-sm font-mono truncate">
                      {file.path}
                    </span>
                    <span className="ml-auto text-green-700 text-xs">
                      {file.path.split('.').pop()}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {language && (
          <div className="mb-6 p-3 bg-gray-900 rounded border border-green-800 flex items-center gap-3">
            <div className="flex-1">
              <h3 className="text-green-400 font-medium">Detected Language</h3>
              <p className="text-green-300 font-mono">{language}</p>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-gray-800 border border-green-700 text-green-400 p-2 rounded"
            >
              {Object.values(extToLang)
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="mb-8 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isLoading.generating || selectedFiles.length === 0}
            className={`px-6 py-3 rounded font-bold transition-all ${isLoading.generating || selectedFiles.length === 0
              ? "bg-gray-800 text-gray-500 cursor-not-allowed"
              : "bg-green-600 text-black hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
              }`}
          >
            {isLoading.generating ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-green-800 border-t-green-400 rounded-full animate-spin"></span>
                Generating...
              </span>
            ) : (
              "Generate Test Cases"
            )}
          </button>
        </div>

        <div className="mb-12">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-green-400">
              Test Case Summaries
            </h2>
            {generatedCases.length > 0 && (
              <span className="text-green-600 text-sm">
                {generatedCases.length} test cases
              </span>
            )}
          </div>

          <div className="bg-gray-900 rounded border border-green-800 overflow-hidden">
            {generatedCases.length > 0 ? (
              <ul className="divide-y divide-green-800">
                {generatedCases.map((testCase, index) => (
                  <li key={index} className="p-4 hover:bg-gray-800/50">
                    <div className="flex flex-col gap-3">
                      <p className="text-green-400">
                        {testCase
                          .replace(/```(?:json|javascript)?/g, '')
                          .replace(/^\[|\]$/g, '')
                          .trim()}
                      </p>

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleGenerateCode(testCase)}
                          disabled={isLoading.codeGen}
                          className={`px-3 py-1 rounded text-sm ${isLoading.codeGen
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-green-700 hover:bg-green-600 text-black"
                            }`}
                        >
                          {isLoading.codeGen ? "Generating..." : "Generate Full Test Code"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center">
                <p className="text-green-700">
                  {isLoading.generating
                    ? "Generating test cases..."
                    : "No test cases generated yet"}
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-8 pt-4 border-t border-green-800 text-center text-green-700 text-sm">
          <p>GitHub Test Case Generator • Aryan Pratik</p>
        </footer>
      </div>
    </div>
  );
}