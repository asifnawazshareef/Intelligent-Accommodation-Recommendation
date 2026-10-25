import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import launcher from "../../scripts/sentiment.cjs";

const { findPython, pipOptions, setup } = launcher;
const info = JSON.stringify({ version: [3, 11], base: "C:\\Program Files\\Python311\\python.exe" });

test("Windows startup skips a copied environment and uses the installed Python launcher", () => {
  const attempts = [];
  const python = findPython({ env: {}, platform: "win32", run(command, args, options) {
    attempts.push(command); assert.equal(options.shell, undefined);
    return command === "py.exe" ? { status: 0, stdout: args.includes("import fastapi,uvicorn,joblib,sklearn,pandas") ? "" : info } : { status: 103, stdout: "" };
  } });
  assert.ok(attempts.some(command => /Scripts[\\/]python\.exe$/.test(command)));
  assert.equal(python.command, "py.exe"); assert.deepEqual(python.args, ["-3.11"]);
});

test("Python paths containing spaces are passed intact and missing dependencies have a repair command", () => {
  const executable = "C:\\Program Files\\Python311\\python.exe";
  const python = findPython({ env: { SENTIMENT_PYTHON: executable }, run(command, args) {
    assert.equal(command, executable); assert.equal(args[0], "-c");
    return { status: 0, stdout: args[1].startsWith("import json") ? info : "" };
  } });
  assert.equal(python.command, executable);
  assert.throws(() => findPython({ env: { SENTIMENT_PYTHON: executable }, run(command, args) {
    return args[1].startsWith("import json") ? { status: 0, stdout: info } : { status: 1, stdout: "" };
  } }), /npm\.cmd run sentiment:setup/);
  assert.throws(() => findPython({ env: {}, run: () => ({ status: 1 }) }), /working Python 3\.11 or 3\.12/);
});

test("startup check loads the installed Python dependencies and finds the trained artifact", { skip: !process.env.SEED_REAL_SENTIMENT_PYTHON }, () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../../scripts/sentiment.cjs", import.meta.url)), "check"], {
    env: { ...process.env, SENTIMENT_PYTHON: process.env.SEED_REAL_SENTIMENT_PYTHON }, encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Trained model loaded and prediction succeeded/);
});


test("official repair ignores package source overrides without changing saved configuration or certificates", () => {
  const env = { PATH: "bin", PIP_INDEX_URL: "https://mirror.invalid/simple", PIP_EXTRA_INDEX_URL: "https://extra.invalid", PIP_NO_INDEX: "1", PIP_FIND_LINKS: "old-wheels", PIP_CONFIG_FILE: "custom.ini", PIP_CONSTRAINT: "old.txt", PIP_TRUSTED_HOST: "mirror.invalid", PIP_CERT: "company.pem", HTTPS_PROXY: "https://proxy.invalid", pip_no_binary: ":all:" };
  const result = pipOptions({ official: true, env, platform: "win32" });
  assert.equal(result.env.PIP_CONFIG_FILE, "nul");
  assert.equal(result.env.PIP_CERT, "company.pem");
  assert.equal(result.env.HTTPS_PROXY, env.HTTPS_PROXY);
  for (const key of ["PIP_INDEX_URL", "PIP_EXTRA_INDEX_URL", "PIP_NO_INDEX", "PIP_FIND_LINKS", "PIP_CONSTRAINT", "PIP_TRUSTED_HOST", "pip_no_binary"]) assert.equal(result.env[key], undefined);
  assert.ok(result.args.includes("https://pypi.org/simple"));
  assert.equal(env.PIP_CONFIG_FILE, "custom.ini");
  assert.deepEqual(pipOptions({ env }).env, env);
});

test("setup stops at a failed download and repair validates dependencies and a real prediction", () => {
  const calls = [];
  let fail = true;
  const options = { official: true, env: { SENTIMENT_PYTHON: "python" }, run(command, args, options) {
    calls.push({ command, args, options });
    if (args.includes("import json,sys; print(json.dumps({'version':list(sys.version_info[:2]),'base':getattr(sys,'_base_executable',sys.executable)}))")) return { status: 0, stdout: info };
    if (args.includes("requirements.txt") && fail) return { status: 1 };
    return { status: 0 };
  } };
  assert.throws(() => setup(options), /Do not start dev:seed until repair succeeds/);
  assert.equal(calls.some(call => call.args.includes("check")), false);
  assert.equal(calls.some(call => call.args.some(arg => arg.includes("from app import model"))), false);
  calls.length = 0; fail = false;
  setup(options);
  assert.ok(calls.some(call => call.args.includes("check")));
  assert.ok(calls.some(call => call.args.some(arg => arg.includes("from app import model"))));
  const download = calls.find(call => call.args.includes("requirements.txt"));
  assert.ok(download.args.includes("--only-binary=:all:"));
  assert.equal(download.options.shell, undefined);
});
