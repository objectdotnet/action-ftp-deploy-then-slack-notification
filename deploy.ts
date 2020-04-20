let params = process.argv.slice(2);

let repoRoot = params[0];
let ftpHost = params[1];
let ftpRoot = params[2];
let ftpUser = params[3];
let ftpPass = params[4];
let slackHook = params[5];

if (repoRoot.length < 2) {
  throw new Error("Local repository root directory not specified.")
} else if (repoRoot.startsWith("/")) {
  repoRoot = repoRoot.substring(1); // drop first character of local path if it starts with a slash.
}
// TODO: check if root folder exists
// else if (File.exists)
if (ftpHost.length < 2) {
  throw new Error("FTP host address not specified.")
}
if (ftpRoot.length < 2) {
  throw new Error("FTP root directory not specified.")
}
if (ftpUser.length < 2) {
  throw new Error("FTP username not specified.")
}
if (ftpPass.length < 2) {
  throw new Error("FTP password not specified.")
}
if (slackHook.length < 2) {
  throw new Error("Slack web hook hash not specified.")
}

console.log("This script shall deploy the files to ftp://" + ftpUser + ":passwd@" + ftpHost + "/" + ftpRoot);
