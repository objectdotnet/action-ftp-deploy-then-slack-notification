import * as fs from "fs";
import * as util from "./utils";

let git_hash_pattern = /^[a-f0-9]{40}$/;

interface IHistoryEntry {
  hash: string,
  subject: string
}

interface IHashInHistory {
  failed: boolean,
  found: boolean,
  history: IHistoryEntry[],
  distance: number
}

function head() : string {
  let hash : string = "";
  let ref : string;
  let refpath : string;
  let githead = ".git/HEAD";

  if (!fs.existsSync(githead)) {
    util.log_err("Unable to locate git repository's 'HEAD' file.");
  } else {
    ref = fs.readFileSync(githead).toString().trim();
    if (ref.length == 41 && ref.match(git_hash_pattern)) {
      hash = ref;
    } else if (ref.startsWith("ref: ")) {
      refpath = ".git/" + ref.substr(5);

      if (!fs.existsSync(refpath)) {
        util.log_err("Ref not found: " + ref.substr(5));
      } else {
        hash = fs.readFileSync(refpath).toString().trim();

        if (!hash.match(git_hash_pattern)) {
          util.log_err("Unable to fetch commit hash from: " + ref);
          hash = "";
        }
      }
    } else {
      util.log_err("Unable to fetch current git HEAD.");
    }
  }

  return hash;
}

function log_until(hash : string) : IHashInHistory {
  let char: string;
  let line : string;

  let githead = ".git/logs/HEAD";
  let result : IHashInHistory = {
    failed: true,
    found: false,
    history: [],
    distance: 0
  };

  if (!fs.existsSync(githead)) {
    util.log_err("Unable to fetch log for current git HEAD.");
    return result;
  }

  var fr = new util.FileReader(githead);
  while (!fr.eof()) {
    // TODO: split line fields and interpret the commit hashes down until the
    //       specified one is found.
    line = fr.read();
    if (line.length > 0 ) console.log("line: [" + line + "]");
  }

  fr.close();

  return result;
}

export { head, log_until }