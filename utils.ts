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

export { empty, errors, FileReader, log_err, pop_last_error, runcmd, trimSlashes };