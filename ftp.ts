import * as bf from "basic-ftp";
import * as dasync from "deasync";

let errorMessages: string[] = [];
let ftp_client = new bf.Client();
let ftp_connected = false;

function log_err(message: string) {
  errorMessages.push(message);
}

function chdir(path: string) : boolean {
  log_err("chdir() is not implemented.");
  return false;
}

function close() : boolean {
  return ftp_close();
}

function connect(host: string, user = "anonymous", pass="anonymous@email.address") : boolean {
  return ftp_access(host, user, pass);
}

function dele(file: string) : boolean {
  log_err("");
  return false;
}

function get(file: string) : string {
  log_err("get() is not implemented.");
  return "";
}

function mkdir(path: string) : boolean {
  log_err("mkdir() is not implemented.");
  return false;
}

function send(file: string) : boolean {
  log_err("send() is not implemented.");
  return false;
}

function errors() : string {
  return errorMessages.join("\n");
}

function ftp_access(host: string, user: string, pass: string) : boolean {
  let result = false;
  let finished = false;

  ftp_client.access({
    host: host,
    user: user,
    password: pass,
    secure: false
  })
    .then(() => { result = true })
    .catch(error => { errorMessages.push(error) })
    .finally(function () { finished = true });

  dasync.loopWhile(() => !finished);

  return result;
}

function ftp_close() : boolean {
  if (ftp_client == null || ftp_client.closed) return true;

  // FIXME: when should this return false at all?
  ftp_client.close();

  dasync.loopWhile(() => !ftp_client.closed);
  return true;
}

export { chdir, close, connect, dele, errors, get, mkdir, send }