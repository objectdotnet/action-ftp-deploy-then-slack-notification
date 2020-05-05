import * as fs from "fs";
import * as slack from "./slack";
import * as util from "./utils";

let params = process.argv.slice(2);

let repoRoot = params[0];
let ftpHost = params[1];
let ftpRoot = params[2];
let ftpUser = params[3];
let ftpPass = params[4];
let slackHook = params[5];

let github_action = {
  workflow: process.env.GITHUB_WORKFLOW,
  runId: process.env.GITHUB_RUN_ID,
  runCount: process.env.GITHUB_RUN_NUMBER,
  starter: process.env.GITHUB_ACTOR,
  repo: process.env.GITHUB_REPOSITORY,
  branch: process.env.GITHUB_REF
}

if (process.env.CI === undefined) {
  github_action.workflow = "(unknown)";
  github_action.runId = "-1";
  github_action.runCount = "-1";
  github_action.starter = "nobody";
  github_action.repo = "(local run)";
  github_action.branch = "working directory";
}

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

let sp : slack.ISlackMessengerParams = {
  from: "GitHub Deploy Service",
  to: "U03LFAG3T"
};

let msger = new slack.Messenger(sp, slackHook);

if (msger.send("Deployment #" + github_action.runCount + " for branch \"" + github_action.branch + "\" <https://github.com/" + github_action.repo + "|" + github_action.repo + ">.")) {
  console.log("Message sent.");
} else {
  console.log("Message not sent.");
}

