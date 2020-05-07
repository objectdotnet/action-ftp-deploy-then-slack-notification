import * as fs from "fs";
import { spawnSync } from "child_process";

let errorMessages: string[] = [];

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

  let cmd_success = runcmd("git", [ "ftp", "version" ]);

  if (!cmd_success) {
    console.log("The git-ftp tool was not found, trying to download it using curl.")
    // we are going to just ignore the error caused by trying to run git-ftp
    pop_last_error();

    cmd_success = runcmd("sudo", [ "curl", "--silent", gfUrl, "--output", gfPath ]);

    if (!cmd_success) {
      log_err("Unable to fetch git-ftp from github: " + pop_last_error());
      return false;
    }

    cmd_success = runcmd("sudo", [ "chmod", "a+x", gfPath ]);

    if (!cmd_success) {
      log_err("Unable to make fetched git-ftp executable: " + pop_last_error());
      return false;
    }

    cmd_success = runcmd("git", [ "ftp", "version" ]);

    if (!cmd_success) {
      log_err("Unable to execute git-ftp after installing: " + pop_last_error());
      return false;
    }
  }

  return true;
}

function log_err(message: string) {
  errorMessages.push(message);
}

function pop_last_error() {
  return errorMessages.pop();
}

function runcmd(command: string, args : string[]) : boolean {
  let result = spawnSync(command, args);

  if (result.status == null) {
    log_err("Command interrupted by signal: " + result.signal);
    return false;
  } else if (result.status != 0) {
    log_err(
      "Command returned non-zero exit status: exit(" + result.status + ")\n" +
      "- Command: " + command + "\n" + // (could expose sensitive info) // " " + args.join(" ") + "\n" +
      "- Command output (stdout): \n---\n" + result.stdout + "\n---\n" +
      "- Command output (stderr): \n---\n" + result.stderr + "\n---\n"
    );
    return false;
  } else {
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

export { empty, errors, fetchGitFtp, FileReader, log_err, pop_last_error, runcmd, trimSlashes };