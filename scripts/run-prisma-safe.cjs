const { spawn } = require("child_process");
const path = require("path");

const { ensureSafeWorkdir } = require("./safe-workdir.cjs");

const projectRoot = path.resolve(__dirname, "..");
const safeCwd = ensureSafeWorkdir(projectRoot);
const prismaBin = path.join(safeCwd, "node_modules", "prisma", "build", "index.js");

// 将 TMP/TEMP 重定向到项目所在磁盘的临时目录，避免系统 C 盘满导致 SQLite "disk full" 错误
const fs = require("fs");
const projectTmp = path.join(projectRoot, "..", "tmp");
if (!fs.existsSync(projectTmp)) fs.mkdirSync(projectTmp, { recursive: true });

const child = spawn(process.execPath, [prismaBin, ...process.argv.slice(2)], {
  cwd: safeCwd,
  stdio: "inherit",
  env: { ...process.env, TMP: projectTmp, TEMP: projectTmp },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
