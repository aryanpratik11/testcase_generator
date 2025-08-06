import { useState } from "react";
import axios from "axios";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [language, setLanguage] = useState("");
  const [generatedCases, setGeneratedCases] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const extToLang = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cs: "csharp",
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
      setIsLoading(true);
      const res = await axios.get(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/main?recursive=1`
      );
      const fileList = res.data.tree.filter(
        (item) =>
          item.type === "blob" &&
          /\.(js|jsx|ts|tsx|py|java|cs)$/i.test(item.path)
      );
      setFiles(fileList);
    } catch (err) {
      console.error("Error fetching files:", err);
      alert("Could not fetch files from GitHub");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileToggle = (path) => {
    setSelectedFiles((prev) => {
      const newSelection = prev.includes(path)
        ? prev.filter((f) => f !== path)
        : [...prev, path];

      // Auto-detect language
      if (newSelection.length > 0) {
        const extCounts = {};
        newSelection.forEach((file) => {
          const ext = file.split(".").pop();
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
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    );
    const content = atob(res.data.content); // decode base64
    return { path, content };
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

    setIsLoading(true);
    try {
      // Fetch full contents of selected files
      const fileContents = await Promise.all(
        selectedFiles.map((path) =>
          fetchFileContent(parsed.owner, parsed.repo, path)
        )
      );

      const res = await fetch("http://localhost:5000/api/generate", {
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
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-500 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl">
        <header className="mb-8 border-b border-green-800 pb-4">
          <h1 className="text-4xl font-bold text-green-400 flex items-center">
            <span className="mr-2">⚡</span> Test Case Generator
          </h1>
          <p className="text-green-600 mt-2">
            Generate test case summaries from your GitHub project
          </p>
        </header>

        {/* GitHub Repo Input */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Enter GitHub repo URL (e.g. https://github.com/user/repo)"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="flex-1 p-3 rounded bg-gray-900 border border-green-700 text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleLoadFiles}
            disabled={isLoading || !repoUrl.trim()}
            className={`px-4 py-3 rounded font-bold transition-all ${
              isLoading || !repoUrl.trim()
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-black hover:bg-green-500"
            }`}
          >
            {isLoading ? "Loading..." : "Load Files"}
          </button>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="bg-gray-900 p-4 rounded border border-green-800 mb-4 max-h-60 overflow-y-auto">
            {files.map((file) => (
              <label
                key={file.path}
                className="flex items-center gap-2 text-green-400 hover:text-green-300"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.path)}
                  onChange={() => handleFileToggle(file.path)}
                  className="accent-green-500"
                />
                {file.path}
              </label>
            ))}
          </div>
        )}

        {/* Detected Language Info */}
        <div className="mb-6 text-green-400 font-mono">
          {language
            ? `Detected Language: ${language}`
            : "Select files to detect language"}
        </div>

        {/* Generate Button */}
        <div className="flex justify-end mb-8">
          <button
            onClick={handleGenerate}
            disabled={isLoading || selectedFiles.length === 0}
            className={`px-6 py-3 rounded font-bold transition-all ${
              isLoading || selectedFiles.length === 0
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-black hover:bg-green-500"
            }`}
          >
            {isLoading ? "Generating..." : "Generate Test Cases"}
          </button>
        </div>

        {/* Generated Output */}
        <div>
          <h2 className="text-xl font-semibold text-green-400 mb-3">
            Generated Test Case Summaries
          </h2>
          <div className="bg-gray-900 p-5 rounded border border-green-800 overflow-x-auto min-h-40">
            {generatedCases.length > 0 ? (
              <pre className="text-green-400 font-mono text-sm">
                {JSON.stringify(generatedCases, null, 2)}
              </pre>
            ) : (
              <div className="text-green-800 text-center py-10">
                {isLoading
                  ? "Generating summaries..."
                  : "Summaries will appear here"}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-4 border-t border-green-800 text-center text-green-700 text-sm">
          <p>© Aryan Pratik</p>
        </footer>
      </div>
    </div>
  );
}
