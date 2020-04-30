import * as fs from "fs";
import * as ftp from "./ftp";
import * as util from "./utils";

let params = process.argv.slice(2);

let repoRoot = params[0];
let ftpHost = params[1];
let ftpRoot = params[2];
let ftpUser = params[3];
let ftpPass = params[4];
let slackHook = params[5];

if (util.empty(repoRoot, 2)) {
  throw new Error("Local repository root directory not specified.")
}

repoRoot = util.trimSlashes(repoRoot);

if (repoRoot.match(/^(|[^\/]+\/)\.\.(|\/[^\/]+)$/)) {
  throw new Error("Arbitrary relative paths not allowed (\"/../\") in: " + repoRoot)
}

if (! fs.existsSync(repoRoot)) {
  throw new Error("Unable to locate local root directory to deploy: " + repoRoot)
}

if (util.empty(ftpHost, 2)) {
  throw new Error("FTP host address not specified.")
} if (ftpHost.match(/[^a-zA-Z0-9\._-]+$/)) {
  throw new Error("FTP host has invalid characters: " + ftpHost);
}

if (util.empty(ftpRoot, 2)) {
  throw new Error("FTP root directory not specified.")
}
ftpRoot = util.trimSlashes(ftpRoot);

if (util.empty(ftpUser)) {
  throw new Error("FTP username not specified.")
}

if (util.empty(ftpPass)) {
  throw new Error("FTP password not specified.")
}

if (util.empty(slackHook, 2)) {
  throw new Error("Slack webhook hash not specified.")
}

if (!slackHook.match(/[a-zA-Z0-9\/]{44}/)) {
  throw new Error("Slack webhook hash is in unsupported format.")
}

console.log("This script shall deploy the files to ftp://" + ftpUser + ":passwd@" + ftpHost + "/" + ftpRoot);

if (!ftp.connect(ftpHost, ftpUser, ftpPass)) {
  throw new Error("Unable to connect to FTP host: " + ftp.errors());
} else {
  console.log("Connected to FTP host.");
  console.log("Closing FTP connection...");
  if (!ftp.close()) {
    throw new Error("Unable to close FTP connection: " + ftp.errors());
  }
  console.log("FTP connection closed.");
}

if (fs.existsSync(".")) {
  console.log("Current directory exists. ;)")
}

ftp.close(); // just to be sure, else app will lock down.