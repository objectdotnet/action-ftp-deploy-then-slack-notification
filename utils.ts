import * as fs from "fs";
import { spawnSync } from "child_process";

let errorMessages: string[] = [];
let commandOutput: string[] = [];

function empty(what : string, minlen = 1) : boolean {
  return what.length < minlen;
}

function errors(clear = true) : string {
  let errorList = errorMessages.join("\n");

  if (clear) errorMessages = [];

  return errorList;
}

function fetchGitFtp() : boolean {
  let gfUrl = "https://raw.githubusercontent.com/git-ftp/git-ftp/1.6.0/git-ftp";
  let gfPath = "/usr/local/bin/git-ftp";

  if (runcmd("git", [ "ftp", "version" ])) {
    console.log("- git-ftp already installed.");
    if (!fs.existsSync(gfPath) && fs.existsSync("/usr/bin/git-ftp")) {
      console.log("- existing git-ftp installation is at /usr/bin.")
      gfPath = "/usr/bin/git-ftp";
    }
  } else {
    console.log("- git-ftp not found, attempting to install it.")
    // we are going to just ignore the error caused by trying to run git-ftp
    pop_last_error();

    if (!runcmd("sudo", [ "curl", "--silent", gfUrl, "--output", gfPath ])) {
      log_err("Unable to fetch git-ftp from github: " + pop_last_error());
      console.log("- git-ftp couldn't be downloaded using curl.")
      return false;
    }

    if (!runcmd("sudo", [ "chmod", "a+x", gfPath ])) {
      log_err("Unable to make fetched git-ftp executable: " + pop_last_error());
      console.log("- downloaded git-ftp couldn't be made executable.")
      return false;
    }

    if (!runcmd("git", [ "ftp", "version" ])) {
      log_err("Unable to execute git-ftp after installing: " + pop_last_error());
      console.log("- git-ftp still not runnable after installation and deployment.")
      return false;
    } else {
      console.log("- git-ftp installed successfully.");
    }
  }

  console.log("- checking if git-ftp needs the remote-delete fix (git-ftp/git-ftp#541)...");
  if (runcmd("grep", [ "--extended-regexp", "--quiet", "^REMOTE_DELETE_CMD=\"-\\*DELE \"$", gfPath ])) {
    console.log("- git-ftp has the bug. Fixing...");
    if (runcmd("sudo", [ "sed", "-Ei", "s/^(REMOTE_DELETE_CMD=\")-\\*(DELE \")$/\\1\\2/", gfPath ])) {
      console.log("- issue fixed.");
    } else {
      console.log("- unable to fix git-ftp issue; sudo+sed returned non-zero exit status.");
      log_err("Unable to fix issue git-ftp/git-ftp#541 from git-ftp. The sudo + sed command " +
        "returned non-zero exit status: " + pop_last_error()
      )
      return false;
    }
  } else {
    console.log("- installed git-ftp is not affected by the issue.");
  }

  return true;
}

function log_err(message: string) {
  errorMessages.push(message);
}

function pop_last_cmd() : string {
  return commandOutput.pop() ?? "";
}

function pop_last_error() : string {
  return errorMessages.pop() ?? "";
}

function runcmd(command: string, args : string[]) : boolean {
  let result = spawnSync(command, args);

  let cmdInfo = "\n- Command: " + command + // (could expose sensitive info) // " " + args.join(" ") + "\n" +
    "\n- " + (!result.stdout ? "No stdout data." : "Command output (stdout): \n---\n" + result.stdout + "\n---") +
    "\n- " + (!result.stderr ? "No stderr data." : "Command output (stderr): \n---\n" + result.stderr + "\n---" ) +
    "\n- " + (!result.error ? "No general error data." : "General failure: \n---\n" + result.error + "\n---" );

  if (result.status == null) {
    if (result.signal == null) {
      log_err("Unable to execute command." + cmdInfo);
    } else {
      log_err("Command interrupted by signal: " + result.signal + cmdInfo);
    }
    return false;
  } else if (result.status != 0) {
    log_err("Command returned non-zero exit status: exit(" + result.status + ")" + cmdInfo);
    return false;
  } else {
    commandOutput.push(cmdInfo);
    return true;
  }
}

function trimSlashes(what: string) {
  if (what.startsWith("/")) what = what.replace(/^\/+/, "");
  if (what.endsWith("/")) what = what.replace(/\/+$/, "");

  return what;
}

class FileReader {
  #rd_fd: number = -1;
  #rd_eof: boolean = true;

  open(path: string) : boolean {
    if (!fs.existsSync(path)) {
      log_err("Unable to fetch log for current git HEAD.");
      return false;
    }

    this.#rd_fd = fs.openSync(path, "r");
    this.#rd_eof = false;

    return true;
  };

  constructor(path : string = "") {
    if (path.length > 0) this.open(path);
  }

  read() : string {
    let char: string;
    let char1b: string;
    let buf = Buffer.allocUnsafe(1);
    let line = "";
    let rawline = Buffer.allocUnsafe(8192);
    let tmpbuf : Buffer;
    let idx = 0;
    let eof = true;

    if (this.#rd_fd < 0) {
      log_err("Unable to read next line: no file is open.");
      return "";
    }

    while (fs.readSync(this.#rd_fd, buf, 0, buf.length, null)) {
      char = buf.toString();

      if (char == "\r") continue;
      if (char == "\n") {
        eof = false;
        break;
      } else {
        // Allocate more buffer space if full.
        if (idx >= rawline.length) {
          tmpbuf = Buffer.allocUnsafe(rawline.length + 8192);
          rawline.copy(tmpbuf);
          rawline = tmpbuf;
        }

        buf.copy(rawline, idx);
        idx += buf.length;
      }
    }

    if (rawline.length > 0) {
      tmpbuf = Buffer.allocUnsafe(idx - buf.length + 1);
      rawline.copy(tmpbuf, 0, 0, idx - buf.length + 1);
      line = tmpbuf.toString();
    }

    if (eof) this.#rd_eof = true;

    return line;
  }

  eof() : boolean {
    return this.#rd_eof;
  }

  close() : boolean {
    if (this.#rd_fd < 0) {
      log_err("Unable to finish file reading: no file is open.");
      return false;
    }

    fs.closeSync(this.#rd_fd);

    return true;
  }
}

export { empty, errors, fetchGitFtp, FileReader, log_err, pop_last_cmd, pop_last_error, runcmd, trimSlashes };