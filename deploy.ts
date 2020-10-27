import * as fs from "fs";
import * as gac from "@actions/core";
import * as gag from "@actions/github";
import * as slack from "./slack";
import * as util from "./utils";

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

  console.error("*** Aborting: " + message);

  process.exit(failStat);
}

console.log("- Attempting to initialize Slack messages communication...");

// Try to ensure the slack messaging is up in the earliest
// So that it can issue descriptive error messages for the
// other issues.
if (util.empty(slackHook, 2)) {
  fail("Slack webhook hash not specified.");
}

let sp : slack.ISlackMessengerParams = {
  from: slackNick,
  to: slackChan,
  portraitEmoji: slackIcon,
  noticePrefix: "*" + ga.workflow + "* workflow: " +
    slack.ghDeployLink(ga.repo_owner, ga.repo, ga.runId, ga.runCount) +
    " for " +
    slack.ghBranchLink(ga.repo_owner, ga.repo, ga.branch.split(/\//)[2]) + " at " +
    slack.ghRepoLink(ga.repo_owner, ga.repo)
};

let msger = new slack.Messenger(sp, slackHook);

console.log("- Slack messaging initialized.");

function noticeHandle(result : boolean, fatal : boolean, action : string = "") {
  if (action.length > 0) {
    action = action + " ";
  }

  if (result) {
    console.log("- Slack " + action + "notification sent.");
  } else {
    if (fatal) {
      fail("Unable to send " + action + "slack message: " + util.errors());
    } else {
      console.error("- WARNING: Unable to send " + action + "slack message: " + util.pop_last_error());
    }
  }
}

async function configError(inputName : string, slackMsg : string, consoleMsg : string) {
  noticeHandle(
    await msger.notice("configuration error: `" + inputName + "` input value " + slackMsg + "."),
    true,
    "configuration issue"
  );

  fail(consoleMsg);
}

async function main() {
  repoRoot = util.trimSlashes(repoRoot);

  if (util.empty(repoRoot)) {
    repoRoot = "."
  }

  console.log("- Checking provided action parameters...");

  if (repoRoot.match(/^(|[^\/]+\/)\.\.(|\/[^\/]+)$/)) {
    await configError("repo-root", "cannot contain relative paths (`../`)", "Arbitrary relative paths not allowed (\"/../\") in: " + repoRoot);
  }

  if (! fs.existsSync(repoRoot)) {
    await configError("repo-root", "path not found in repository", "Unable to locate local root directory to deploy: " + repoRoot);
  }

  if (util.empty(ftpHost, 2)) {
    await configError("ftp-host", "not provided", "FTP host address not specified.");
  }

  let ftpHostPrefix = ftpHost.match(/^(ftp(|s|es)|sftp):\/\//);

  if (ftpHostPrefix !== null) {
    ftpProto = ftpHost.substr(0, ftpHostPrefix[0].length - 3)
    ftpHost = ftpHost.substr(ftpHostPrefix[0].length);
  }

  if (ftpHost.match(/[^a-zA-Z0-9\._-]+$/) !== null) {
    await configError("ftp-host", "is not valid", "FTP host has invalid characters: " + ftpHost);
  }

  if (util.empty(ftpRoot, 2)) {
    await configError("ftp-root", "not provided", "FTP root directory not specified.");
  }

  ftpRoot = util.trimSlashes(ftpRoot);

  if (util.empty(ftpUser)) {
    await configError("ftp-user", "not provided", "FTP username not specified.");
  }

  if (util.empty(ftpPass)) {
    await configError("ftp-pass", "not provided", "FTP password not specified.");
  }

  console.log("- Provided arguments looks right.");
  console.log("- Sending 'job started' message to slack...");

  noticeHandle(await msger.notice("started"), true, "start");

  console.log("- Checking git-ftp...");

  if (!util.fetchGitFtp()) {
    noticeHandle(await msger.errorNotice(
      "failed. The `git ftp` command is missing and unable to be installed.",
      util.errors(false)
    ), true, "failure");

    fail("Unable to set up git-ftp: " + util.errors());
  }

  console.log("- Running git-ftp to sync repository...");

  let cmd_success = util.runcmd("git", [
    "ftp", "push", "--force", "--verbose",
    "--syncroot", repoRoot,
    "--remote-root", ftpRoot,
    "--user", ftpUser,
    "--passwd", ftpPass,
    ftpProto + "://" + ftpHost
  ]);

  if (cmd_success) {
    console.log(util.pop_last_cmd());
    console.log("- Repository sync successful.");

    noticeHandle(await msger.notice("completed successfully"), false, "completion");
  } else {
    console.log("- Repository sync failed.")

    let error_details = util.errors(false);

    if (!util.empty(error_details)) {
      // Check if all we need to do is init and retry
      if (error_details.match(/fatal: Could not get last commit. (|Network down\? Wrong URL\? )Use 'git ftp init' for the initial push./) !== null) {
        console.log("- Error suggests non-initialized FTP structure. Attempting initialization...");

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
          console.log(util.pop_last_cmd());
          console.log("- FTP initialization successful. Files should be in sync now.");

          notice_success = await msger.notice("Initialization and first upload completed successfully");
          noticeHandle(notice_success, false, "initialization success");
        } else {
          noticeHandle(await msger.errorNotice("failed", error_details), false, "failure");
          fail("git-ftp remote host initialization command failed: " + util.errors());
        }
      } else {
        noticeHandle(await msger.errorNotice("failed", error_details), false, "failure");
        fail("git-ftp command failed: " + util.errors());
      }
    }
  }
}

main();