import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import launcher from "../../scripts/sentiment.cjs";

const { findPython } = launcher;
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
  assert.match(result.stdout, /dependencies and the trained model file are available/);
});
