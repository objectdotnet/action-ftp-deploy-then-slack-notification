import * as fs from "fs";
import * as gac from "@actions/core";
import * as gag from "@actions/github";
import * as slack from "./slack";
import * as util from "./utils";

let params = process.argv.slice(2);
let ftpProto="ftp";

let repoRoot = gac.getInput("repo-root");
let ftpHost = gac.getInput("ftp-host");
let ftpRoot = gac.getInput("ftp-root");
let ftpUser = gac.getInput("ftp-user");
let ftpPass = gac.getInput("ftp-pass");
let slackHook = gac.getInput("slack-webhook");
let slackChan = gac.getInput("slack-to");
let slackNick = gac.getInput("slack-nick");
let slackIcon = gac.getInput("slack-icon");

if (process.env.CI === undefined) {
  console.log("- Script not running from GitHub Actions environment. Stubbing out info.");
}

let ga = {
  workflow: gag.context.workflow,
  runId: process.env.GITHUB_RUN_ID ?? "-1",
  runCount: process.env.GITHUB_RUN_NUMBER ?? "-1",
  starter: process.env.GITHUB_ACTOR ?? "nobody",
  repo: gag.context.repo.repo,
  repo_owner: gag.context.repo.owner,
  branch: gag.context.ref
};

function fail(message : string, failStat : number = 1) {
  gac.setFailed(message);
  console.error("Aborting: " + message);
  process.exit(failStat);
}

console.log("- Checking provided arguments.");
if (util.empty(repoRoot, 2)) {
  fail("Local repository root directory not specified.")
}

repoRoot = util.trimSlashes(repoRoot);

if (repoRoot.match(/^(|[^\/]+\/)\.\.(|\/[^\/]+)$/)) {
  fail("Arbitrary relative paths not allowed (\"/../\") in: " + repoRoot)
}

if (! fs.existsSync(repoRoot)) {
  fail("Unable to locate local root directory to deploy: " + repoRoot)
}

if (util.empty(ftpHost, 2)) {
  fail("FTP host address not specified.")
}

let ftpHostPrefix = ftpHost.match(/^(ftp(|s|es)|sftp):\/\//);
if (ftpHostPrefix !== null) {
  ftpProto = ftpHost.substr(0, ftpHostPrefix[0].length - 3)
  ftpHost = ftpHost.substr(ftpHostPrefix[0].length);
}

if (ftpHost.match(/[^a-zA-Z0-9\._-]+$/) !== null) {
  fail("FTP host has invalid characters: " + ftpHost);
}

if (util.empty(ftpRoot, 2)) {
  fail("FTP root directory not specified.")
}
ftpRoot = util.trimSlashes(ftpRoot);

if (util.empty(ftpUser)) {
  fail("FTP username not specified.")
}

if (util.empty(ftpPass)) {
  fail("FTP password not specified.")
}

if (util.empty(slackHook, 2)) {
  fail("Slack webhook hash not specified.")
}

if (!slackHook.match(/[a-zA-Z0-9\/]{44}/)) {
  fail("Slack webhook hash is in unsupported format.")
}

if (util.empty(slackChan)) {
  fail("Slack target channel name not specified.");
}

if (util.empty(slackNick)) {
  slackNick = "GitHub Deploy Service";
}

if (util.empty(slackIcon)) {
  slackIcon = "";
}

let sp : slack.ISlackMessengerParams = {
  from: slackNick,
  to: slackChan,
  portrait_emoji: slackIcon
};

let msger = new slack.Messenger(sp, slackHook);

async function main() {
  let noticePrefix =
    slack.ghDeployLink(ga.repo_owner, ga.repo, ga.runId, ga.runCount) +
    "for " +
    slack.ghBranchLink(ga.repo_owner, ga.repo, ga.branch.split(/\//)[2]) + " at " +
    slack.ghRepoLink(ga.repo_owner, ga.repo);
  console.log("Sending Slack notification: " + noticePrefix + " started.");
  if (await msger.send(noticePrefix + " started.")) {
    console.log("Slack Notification sent.");
  } else {
   fail("Error trying to send slack message: " + util.errors());
  }

  let cmd_success = util.runcmd("git", [
    "ftp", "push", "--force", "--auto-init", "--verbose",
    "--syncroot", repoRoot,
    "--remote-root", ftpRoot,
    "--user", ftpUser,
    "--passwd", ftpPass,
    ftpProto + "://" + ftpHost
  ]);

  if (cmd_success) {
    console.log("Sending Slack notification: " + noticePrefix + " completed successfully.");
    if (await msger.send(noticePrefix + " completed successfully.")) {
      console.log("Slack Notification sent.");
    } else {
      // do not fail the whole deploy process if just the notification couldn't
      // be sent after the process completed.
      console.error("- WARNING: completion notice couldn't be sent to slack: " + util.pop_last_error());
    }
  } else {
    let error_details = util.errors(false);

    if (!util.empty(error_details)) {
      error_details = "\\n*Error details:*\\n```\\n" + error_details + "\\n```";
    }

    if (await msger.send(noticePrefix + " failed." + error_details)) {
      console.log("Slack Notification sent.");
    } else {
      // do not fail the whole deploy process if just the notification couldn't
      // be sent after the process completed.
      console.error("- WARNING: failure notice couldn't be sent to slack: " + util.pop_last_error());
    }

    fail("git-ftp command did not complete successfully: " + util.errors());
  }
}

main();