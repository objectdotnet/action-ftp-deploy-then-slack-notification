import * as bf from "basic-ftp";
import { Writable } from "stream";
import * as util from "./utils";

let ftp_client = new bf.Client();
let ftp_connected = false;

interface IFileGetStringResult {
  success: boolean,
  contents: string
}

function chdir(path: string) : boolean {
  if (!connected()) {
    util.log_err("Attempt to chdir() without active FTP connection.");
    return false;
  }

  return util.sync_call(ftp_client.cd(path));
}

function close() : boolean {
  return ftp_close();
}

function connect(host: string, user = "anonymous", pass="anonymous@email.address") : boolean {
  return ftp_access(host, user, pass);
}

function connected() : boolean {
  return !ftp_client.closed;
}

function dele(file: string) : boolean {
  util.log_err("dele() is not implemented.");
  return false;
}

function get(remote_file: string, local_file : string) : boolean {
  return util.sync_call(
    ftp_client.downloadTo(local_file, remote_file)
  );
}

function get_instr(remote_file: string) : IFileGetStringResult {
  let partial_contents = "";
  let data = new Writable({
    write(chunk, encoding, next) {
      partial_contents += chunk.toString();
      next();
    }
  });

  // TODO: add a "guard" for too big files (as whole contents will be stored in memory)
  let size = util.sync_call_numeric(
    ftp_client.size(remote_file)
  )

  if (size < 0) {
    util.log_err("Unable to fetch remote file '" + remote_file + "': " + util.pop_last_error());
    return { success: false, contents: ""};
  } else if (size > 134217728) {
    util.log_err("File size too big to store in string: >= 128MB.");
    return { success: false, contents: "" };
  }

  let result = util.sync_call(
    ftp_client.downloadTo(data, remote_file)
  );

  if (!data.writableEnded) console.log("Data write not ended!");
  if (!data.writableFinished) console.log("Data write not finished!");

  return {
    success: result,
    contents: result ? partial_contents : ""
   };
}

function mkdir(path: string) : boolean {
  return util.sync_call(
    ftp_client.send("MKD \"" + path + "\"")
  );
}

function rmdir(path: string) : boolean {
  return util.sync_call(
    ftp_client.send("RMD \"" + path + "\"")
  );
}

function send(file: string) : boolean {
  util.log_err("send() is not implemented.");
  return false;
}

function ftp_access(host: string, user: string, pass: string) : boolean {
  if (connected()) {
    util.log_err("Attempt to connect() while already connected. Please close current connection first.");
    return false;
  }

  return util.sync_call(
    ftp_client.access({
      host: host,
      user: user,
      password: pass,
      secure: false
    })
  );
}

function ftp_close() : boolean {
  if (ftp_client == null || ftp_client.closed) return true;

  // FIXME: when should this return false at all?
  ftp_client.close();

  return true;
}

export { chdir, close, connect, dele, get, get_instr, mkdir, rmdir, send }