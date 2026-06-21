const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const command = process.argv[2];

if (command === "dev" || command === "build") {
  const nextCacheDir = path.join(projectRoot, ".next");
  if (fs.existsSync(nextCacheDir)) {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
  }
}

// 将 TMP/TEMP 重定向到项目所在磁盘的临时目录，避免系统 C 盘满导致 SQLite "disk full" 错误
const projectTmp = path.join(projectRoot, "..", "tmp");
if (!fs.existsSync(projectTmp)) fs.mkdirSync(projectTmp, { recursive: true });

const env = { ...process.env, TMP: projectTmp, TEMP: projectTmp };

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
