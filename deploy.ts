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

function close_ftp() : boolean {
  console.log("Closing FTP connection...");
  let result = ftp.close();

  if (result) {
    console.log("FTP connection closed.");
  } else {
    console.log("Unable to close FTP connection: " + ftp.errors());
  }

  return result;
}

process.exit(0); // for now, let's leave FTP alone.
if (!ftp.connect(ftpHost, ftpUser, ftpPass)) {
  throw new Error("Unable to connect to FTP host: " + ftp.errors());
} else {
  console.log("Connected to FTP host.");

  console.log("Removing dir: ");
  if (!ftp.rmdir(ftpRoot)) {
    console.log("Error removing directory: " + ftp.errors());
  } else console.log("Directory removed!");

  console.log("Changing to remote root directory...");
  if (!ftp.chdir(ftpRoot)) {
    close_ftp()
    throw new Error("Unable to change to FTP remote deploy directory: " + ftp.errors());
  }

  console.log("Fetching git-ftp hash...")
  let git_ftp_handle = ftp.get_instr(".git-ftp.log");
  let last_commit_hash = "";
  if (git_ftp_handle.success) {
    if (git_ftp_handle.contents.length != 41 &&
       !git_ftp_handle.contents.match(/^[a-f0-9]{41}$/)) {
      console.log("Got inconsistent commit hash (length: " + git_ftp_handle.contents.length + "). Ignoring it.");
    } else {
      last_commit_hash = git_ftp_handle.contents.trim();
      console.log("Got commit hash: " + last_commit_hash);
    }
  } else {
    console.log("Error getting file: " + ftp.errors());
  }

  console.log("Script finished without fatal issues.");
  close_ftp();
}

ftp.close(); // just to be sure, else app will lock down.