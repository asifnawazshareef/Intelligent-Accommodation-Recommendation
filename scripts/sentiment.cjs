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

function pipOptions({ official = false, env = process.env, platform = process.platform } = {}) {
  if (!official) return { env: { ...env }, args: [] };
  // A repair uses PyPI only for this child process. Leave saved pip settings intact.
  const keep = new Set(["PIP_CERT", "PIP_CLIENT_CERT", "PIP_PROXY", "PIP_TIMEOUT", "PIP_RETRIES"]);
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !key.toUpperCase().startsWith("PIP_") || keep.has(key.toUpperCase())));
  clean.PIP_CONFIG_FILE = platform === "win32" ? "nul" : "/dev/null";
  return { env: clean, args: ["--index-url", "https://pypi.org/simple", "--no-cache-dir"] };
}

function checkModel(python, run = spawnSync) {
  const result = run(python.command, [...python.args, "-c", "from app import model; result=model.predict(['The room was clean and the staff were helpful.']); assert len(result)==1; print('Trained model loaded and prediction succeeded.')"], { cwd: serviceDirectory, stdio: "inherit", timeout: 60000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("The trained model could not run. Read the Python error above. Run npm.cmd run sentiment:repair if dependencies are damaged.");
}

function setup({ official = false, env = process.env, platform = process.platform, run = spawnSync } = {}) {
  const python = findPython({ needsPackages: false, env, platform, run });
  const created = run(python.base, ["-m", "venv", path.join(serviceDirectory, ".venv")], { cwd: serviceDirectory, stdio: "inherit", env });
  if (created.error || created.status !== 0) throw new Error("Could not create the local Python environment. Check the Python installation and folder permissions.");
  const localPython = path.join(serviceDirectory, ".venv", platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const pip = pipOptions({ official, env, platform });
  if (official) console.log("Repairing the local environment using https://pypi.org/simple. Saved pip configuration is unchanged.");
  const install = (packages, message) => {
    const result = run(localPython, ["-m", "pip", "install", ...pip.args, "--only-binary=:all:", ...packages], { cwd: serviceDirectory, stdio: "inherit", env: pip.env });
    if (result.error || result.status !== 0) throw new Error(message + (official
      ? " Check the download error above and access to pypi.org and files.pythonhosted.org. Do not start dev:seed until repair succeeds."
      : " Run npm.cmd run sentiment:repair to retry using the official PyPI source."));
  };
  install(["--upgrade", "pip>=25.1,<27"], "Could not update pip in the local environment.");
  install(["-r", "requirements.txt"], "Sentiment dependency installation failed.");
  const checked = run(localPython, ["-m", "pip", "check"], { cwd: serviceDirectory, stdio: "inherit", env: pip.env });
  if (checked.error || checked.status !== 0) throw new Error("Python dependency validation failed. Resolve the error above before starting the services.");
  checkModel({ command: localPython, args: [] }, run);
  console.log("Sentiment setup complete. Stop older app terminals, then run npm.cmd run dev:seed.");
}

function main(mode = "run") {
  if (["setup", "repair"].includes(mode)) return setup({ official: mode === "repair" });
  if (!["run", "check"].includes(mode)) throw new Error("Choose run, setup, repair or check.");
  const python = findPython();
  if (!fs.existsSync(path.join(serviceDirectory, "models/sentiment_pipeline.joblib"))) throw new Error("The trained sentiment model is missing. Restore sentiment-service/models/sentiment_pipeline.joblib from the repository.");
  console.log(`Sentiment Python ${python.version.join(".")}: ${python.command}`);
  if (mode === "check") { checkModel(python); return; }
  const child = spawn(python.command, [...python.args, "-m", "uvicorn", "app:app", "--reload", "--host", "0.0.0.0", "--port", "8000"], { cwd: serviceDirectory, stdio: "inherit" });
  child.on("error", error => { console.error(`Could not start the sentiment model: ${error.message}`); process.exitCode = 1; });
  child.on("close", code => { process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}

module.exports = { findPython, pipOptions, checkModel, setup, main };
if (require.main === module) {
  try { main(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
