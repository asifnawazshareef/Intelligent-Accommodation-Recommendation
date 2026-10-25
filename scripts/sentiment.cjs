const path = require("node:path");
const fs = require("node:fs");
const { spawn, spawnSync } = require("node:child_process");

const serviceDirectory = path.resolve(__dirname, "../sentiment-service");
const probe = "import json,sys; print(json.dumps({'version':list(sys.version_info[:2]),'base':getattr(sys,'_base_executable',sys.executable)}))";

function findPython({ env = process.env, platform = process.platform, run = spawnSync, needsPackages = true } = {}) {
  const binary = folder => path.join(serviceDirectory, folder, platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const candidates = env.SENTIMENT_PYTHON ? [[env.SENTIMENT_PYTHON, []]] : [
    [binary(".venv"), []], [binary("venv"), []],
    ...(platform === "win32" ? [["py.exe", ["-3.11"]], ["py.exe", ["-3.12"]]] : []),
    ["python3.11", []], ["python3.12", []], ["python", []], ["python3", []],
  ];
  let hasPython = false;
  for (const [command, args] of candidates) {
    const result = run(command, [...args, "-c", probe], { cwd: serviceDirectory, encoding: "utf8", timeout: 10000, windowsHide: true });
    if (result.status !== 0) continue;
    let info;
    try { info = JSON.parse(result.stdout.trim()); } catch { continue; }
    if (info.version?.[0] !== 3 || ![11, 12].includes(info.version[1])) continue;
    hasPython = true;
    if (needsPackages) {
      const packages = run(command, [...args, "-c", "import fastapi,uvicorn,joblib,sklearn,pandas"], { cwd: serviceDirectory, encoding: "utf8", timeout: 20000, windowsHide: true });
      if (packages.status !== 0) continue;
    }
    return { command, args, ...info };
  }
  throw new Error(hasPython
    ? "Python is installed, but sentiment packages are missing. Run npm.cmd run sentiment:setup from the project root."
    : "A working Python 3.11 or 3.12 installation was not found. Install Python, reopen the terminal, then run npm.cmd run sentiment:setup. Copied virtual environments cannot be reused on another PC.");
}

function setup() {
  const python = findPython({ needsPackages: false });
  const created = spawnSync(python.base, ["-m", "venv", path.join(serviceDirectory, ".venv")], { cwd: serviceDirectory, stdio: "inherit" });
  if (created.error || created.status !== 0) throw new Error("Could not create the local Python environment. Check the Python installation and folder permissions.");
  const localPython = path.join(serviceDirectory, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const installed = spawnSync(localPython, ["-m", "pip", "install", "-r", "requirements.txt"], { cwd: serviceDirectory, stdio: "inherit" });
  if (installed.error || installed.status !== 0) throw new Error("Sentiment dependency installation failed. Resolve the installation error above, then run sentiment:setup again.");
  console.log("Sentiment setup complete. Run npm.cmd run dev:seed to start all four services.");
}

function main(mode = "run") {
  if (mode === "setup") return setup();
  if (!["run", "check"].includes(mode)) throw new Error("Choose run, setup or check.");
  const python = findPython();
  if (!fs.existsSync(path.join(serviceDirectory, "models/sentiment_pipeline.joblib"))) throw new Error("The trained sentiment model is missing. Restore sentiment-service/models/sentiment_pipeline.joblib from the repository.");
  console.log(`Sentiment Python ${python.version.join(".")}: ${python.command}`);
  if (mode === "check") { console.log("Python dependencies and the trained model file are available."); return; }
  const child = spawn(python.command, [...python.args, "-m", "uvicorn", "app:app", "--reload", "--host", "0.0.0.0", "--port", "8000"], { cwd: serviceDirectory, stdio: "inherit" });
  child.on("error", error => { console.error(`Could not start the sentiment model: ${error.message}`); process.exitCode = 1; });
  child.on("close", code => { process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}

module.exports = { findPython, main };
if (require.main === module) {
  try { main(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
