"use client";

import React, { useState } from 'react';
import { FolderDown, FileCode, CheckCircle, AlertCircle, Loader2, Download, Info } from 'lucide-react';

const IGNORE_DIRS = new Set(['.git', 'node_modules', '.next', 'out', 'build', 'dist', 'coverage', '.turbo']);
const IGNORE_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store']);
const SECRETS_FILES = new Set(['.env', '.env.local', '.env.development', '.env.production']);
const ALLOWED_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md', '.html', '.mjs', '.cjs'];

export default function App() {
  const [status, setStatus] = useState('idle'); // idle, scanning, reading, done, error
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFile: '' });
  const [resultText, setResultText] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  React.useEffect(() => {
    // Cek dukungan File System Access API (Umumnya Chrome/Edge/Brave/Opera)
    if (!window.showDirectoryPicker) {
      setIsSupported(false);
    }
  }, []);

  const isAllowedFile = (filename: string) => {
    if (IGNORE_FILES.has(filename)) return false;
    if (SECRETS_FILES.has(filename)) return false; // Abaikan file .env demi keamanan
    return ALLOWED_EXTS.some(ext => filename.endsWith(ext));
  };

  // Tahap 1: Pindai direktori untuk mendapatkan semua file yang valid
  const scanDirectory = async (dirHandle: FileSystemDirectoryHandle, currentPath: string = ''): Promise<Array<{ handle: FileSystemFileHandle; path: string; name: string; }>> => {
    let files: Array<{ handle: FileSystemFileHandle; path: string; name: string; }> = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        if (!IGNORE_DIRS.has(entry.name)) {
          const nestedFiles = await scanDirectory(entry, `${currentPath}${entry.name}/`);
          files = files.concat(nestedFiles);
        }
      } else if (entry.kind === 'file') {
        if (isAllowedFile(entry.name)) {
          files.push({
            handle: entry,
            path: `${currentPath}${entry.name}`,
            name: entry.name
          });
        }
      }
    }
    return files;
  };

  // Membuat representasi visual struktur folder (Tree)
  const generateTreeString = (filePaths: string[]): string => {
    let treeStr = "================================================================================\n";
    treeStr += "STRUKTUR DIREKTORI PROYEK (File yang relevan saja)\n";
    treeStr += "================================================================================\n\n";

    // Sort alphabetis
    const sortedPaths = [...filePaths].sort();
    sortedPaths.forEach(path => {
      treeStr += `├── ${path}\n`;
    });

    return treeStr + "\n\n";
  };

  const handleSelectFolder = async () => {
    try {
      setErrorMsg('');
      setResultText('');

      const dirHandle = await window.showDirectoryPicker({
        mode: 'read'
      });

      setStatus('scanning');
      const allFiles = await scanDirectory(dirHandle);

      if (allFiles.length === 0) {
        throw new Error("Tidak ada file kode yang ditemukan, atau folder kosong.");
      }

      setStatus('reading');
      setProgress({ current: 0, total: allFiles.length, currentFile: '' });

      // Sortir file agar urutannya rapi saat digabungkan
      allFiles.sort((a, b) => a.path.localeCompare(b.path));

      const pathsOnly = allFiles.map(f => f.path);
      let combinedContent = generateTreeString(pathsOnly);

      combinedContent += "================================================================================\n";
      combinedContent += "ISI FILE PROYEK\n";
      combinedContent += "================================================================================\n\n";

      // Tahap 2: Baca isi setiap file
      for (let i = 0; i < allFiles.length; i++) {
        const fileObj = allFiles[i];
        setProgress({ current: i + 1, total: allFiles.length, currentFile: fileObj.path });

        try {
          const fileData = await fileObj.handle.getFile();
          const text = await fileData.text();

          combinedContent += `// ==========================================\n`;
          combinedContent += `// File: ${fileObj.path}\n`;
          combinedContent += `// ==========================================\n\n`;
          combinedContent += text;
          combinedContent += `\n\n`;
        } catch (readErr) {
          console.warn(`Gagal membaca file: ${fileObj.path}`, readErr);
          combinedContent += `// [GAGAL MEMBACA ISI FILE INI]\n\n`;
        }
      }

      setResultText(combinedContent);
      setStatus('done');

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle'); // User membatalkan pemilihan folder
        return;
      }
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses folder.');
      console.error(err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nextjs-project-code-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full border border-red-100">
          <div className="flex items-center space-x-3 text-red-600 mb-4">
            <AlertCircle size={28} />
            <h2 className="text-xl font-bold">Browser Tidak Didukung</h2>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            Browser Anda tidak mendukung <span className="font-semibold">File System Access API</span> yang diperlukan untuk membaca folder secara lokal.
          </p>
          <p className="text-slate-600 text-sm bg-slate-100 p-3 rounded-lg">
            Mohon gunakan <strong>Google Chrome, Microsoft Edge, Brave, atau Opera</strong> di desktop untuk menggunakan alat ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-start md:items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
              <FileCode size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Project Code Combiner</h1>
              <p className="text-slate-500 mt-1">
                Gabungkan seluruh file proyek Next.js Anda menjadi satu file teks untuk dianalisa AI.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start space-x-3 text-sm text-blue-800">
            <Info size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Penting:</p>
              <ul className="list-disc pl-4 space-y-1 opacity-90">
                <li>Folder berat seperti <code className="bg-blue-100 px-1 rounded">node_modules</code> dan <code className="bg-blue-100 px-1 rounded">.next</code> otomatis diabaikan.</li>
                <li>File kredensial seperti <code className="bg-blue-100 px-1 rounded">.env</code> otomatis <strong>tidak disertakan</strong> demi keamanan Anda.</li>
                <li>Hanya mengekstrak file kode (.js, .ts, .jsx, .tsx, .css, .json, dll).</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSelectFolder}
              disabled={status === 'scanning' || status === 'reading'}
              className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'scanning' || status === 'reading' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <FolderDown size={20} />
              )}
              <span>
                {status === 'idle' || status === 'done' || status === 'error'
                  ? 'Pilih Folder Proyek'
                  : status === 'scanning' ? 'Memindai Folder...' : 'Membaca File...'}
              </span>
            </button>

            {status === 'done' && (
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-6 rounded-xl font-medium transition-colors shadow-sm"
              >
                <Download size={20} />
                <span>Unduh File Gabungan (.txt)</span>
              </button>
            )}
          </div>

          {/* Progress / Status Area */}
          <div className="mt-6">
            {(status === 'scanning' || status === 'reading') && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>{status === 'scanning' ? 'Mencari file yang relevan...' : 'Membaca isi file...'}</span>
                  {status === 'reading' && <span>{progress.current} / {progress.total}</span>}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: status === 'scanning' ? '100%' : `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-400 truncate mt-1">
                  {progress.currentFile || 'Menyiapkan...'}
                </p>
              </div>
            )}

            {status === 'done' && (
              <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <CheckCircle size={20} />
                <span className="font-medium">Selesai! Berhasil menggabungkan {progress.total} file.</span>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Preview Area */}
        {status === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
              <h3 className="font-semibold text-slate-700">Preview Kode (Awal File)</h3>
              <span className="text-xs font-medium text-slate-400 bg-slate-200 px-2 py-1 rounded-md">
                {(resultText.length / 1024).toFixed(1)} KB
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-900 text-slate-300">
              <pre className="font-mono text-sm whitespace-pre-wrap break-all">
                {resultText.substring(0, 3000)}
                {resultText.length > 3000 && '\n\n... [KODE TERPOTONG DI PREVIEW, SILAKAN UNDUH UNTUK MELIHAT SELURUHNYA] ...'}
              </pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}