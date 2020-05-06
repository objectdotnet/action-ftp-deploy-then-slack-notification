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
  portraitEmoji: slackIcon,
  noticePrefix: slack.ghDeployLink(ga.repo_owner, ga.repo, ga.runId, ga.runCount) +
    " for " +
    slack.ghBranchLink(ga.repo_owner, ga.repo, ga.branch.split(/\//)[2]) + " at " +
    slack.ghRepoLink(ga.repo_owner, ga.repo)
};

let msger = new slack.Messenger(sp, slackHook);

function noticeHandle(result : boolean, fatal : boolean, action : string = "") {
  if (action.length > 0) action = action + " ";

  if (result) {
    console.log("Slack " + action + "notification sent.");
  } else {
    if (fatal) {
      fail("Unable to send " + action + "slack message: " + util.errors());
    } else {
      console.error("- WARNING: Unable to send " + action + "slack message: " + util.pop_last_error());
    }
  }
}

async function main() {
  noticeHandle(await msger.notice("started"), true, "start");

  let cmd_success = util.runcmd("git", [
    "ftp", "push", "--force", "--verbose",
    "--syncroot", repoRoot,
    "--remote-root", ftpRoot,
    "--user", ftpUser,
    "--passwd", ftpPass,
    ftpProto + "://" + ftpHost
  ]);

  if (cmd_success) {
    noticeHandle(await msger.notice("completed successfully."), false, "completion");
  } else {
    let error_details = util.errors(false);

    if (!util.empty(error_details)) {
      // Check if all we need to do is init and retry
      if (error_details.match(/curl: \([0-9]+\) Server denied you to change to the given directory/) !== null) {
        console.log("Attempting to initialize FTP folder structure.");
        let notice_success = await msger.notice("FTP host needs intialization. Trying to initialize it..");
        noticeHandle(notice_success, false, "FTP folder structure initialization");
        cmd_success = util.runcmd("git", [
          "ftp", "init", "--force", "--verbose",
          "--syncroot", repoRoot,
          "--remote-root", ftpRoot,
          "--user", ftpUser,
          "--passwd", ftpPass,
          ftpProto + "://" + ftpHost
        ]);

        if (cmd_success) {
          notice_success = await msger.notice("Initialization and first upload completed successfully.");
          noticeHandle(notice_success, false, "initialization success");
        } else {
          noticeHandle(await msger.errorNotice("failed.", error_details), false, "failure");
          fail("git-ftp remote host initialization command failed: " + util.errors());
        }
      } else {
        noticeHandle(await msger.errorNotice("failed.", error_details), false, "failure");
        fail("git-ftp command failed: " + util.errors());
      }
    }
  }
}

main();