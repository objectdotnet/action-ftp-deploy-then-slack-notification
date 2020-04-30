import * as bf from "basic-ftp";
import * as dasync from "deasync";
import { Writable } from "stream";

let errorMessages: string[] = [];
let ftp_client = new bf.Client();
let ftp_connected = false;

interface IFileGetStringResult {
  success: boolean,
  contents: string
}

function sync_call(what : Promise<any>) : boolean {
  let finished = false;
  let succeeded = false;
  what.then(() => { succeeded = true })
    .catch(log_err)
    .finally(() => { finished = true });

  dasync.loopWhile(() => !finished);

  return succeeded;
}

function sync_call_numeric(what : Promise<Number>) : Number {
  let finished = false;
  let result : Number = -1;
  what.then((value) => { result = value })
    .catch(log_err)
    .finally(() => { finished = true });

  dasync.loopWhile(() => !finished);

  return result;
}

function log_err(message: string) {
  errorMessages.push(message);
}

function chdir(path: string) : boolean {
  if (!connected()) {
    log_err("Attempt to chdir() without active FTP connection.");
    return false;
  }

  return sync_call(ftp_client.cd(path));
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
  log_err("");
  return false;
}

function get(remote_file: string, local_file : string) : boolean {
  return sync_call(
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
  let size = sync_call_numeric(
    ftp_client.size(remote_file)
  )

  if (size < 0) {
    log_err("Unable to fetch remote file '" + remote_file + "': " + errorMessages.pop());
    return { success: false, contents: ""};
  } else if (size > 134217728) {
    log_err("File size too big to store in string: >= 128MB.");
    return { success: false, contents: "" };
  }

  let result = sync_call(
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
  return sync_call(
    ftp_client.send("MKD \"" + path + "\"")
  );
}

function rmdir(path: string) : boolean {
  return sync_call(
    ftp_client.send("RMD \"" + path + "\"")
  );
}

function send(file: string) : boolean {
  log_err("send() is not implemented.");
  return false;
}

function errors(clear = true) : string {
  let errorList = errorMessages.join("\n");

  if (clear) errorMessages = [];

  return errorList;
}

function ftp_access(host: string, user: string, pass: string) : boolean {
  if (connected()) {
    log_err("Attempt to connect() while already connected. Please close current connection first.");
    return false;
  }

  return sync_call(
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

  dasync.loopWhile(() => !ftp_client.closed);
  return true;
}

export { chdir, close, connect, dele, errors, get, get_instr, mkdir, rmdir, send }