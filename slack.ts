import * as http from "@actions/http-client";
import * as util from "./utils";
import { Http2ServerResponse } from "http2";

let slackhost = "https://hooks.slack.com/services";

interface ISlackMessengerParams {
  from : string;
  to : string;
}

function invalidWebHook(hash : string) : boolean {
  return hash.match(/^T[A-Z0-9]{8}\/B[A-Z0-9]{8}\/[A-Za-z0-9]{24}$/) == null;
}

class Messenger {
  #webhook = "";
  #username = "";
  #channel = "";
  #client : http.HttpClient;

  constructor(params : ISlackMessengerParams, webHook : string) {
    if (!this.setWebHook(webHook)) {
      throw new Error("Unable to bind webhook provided to Slack.Messenger: " + util.pop_last_error());
    }

    this.#username = params.from;
    this.#channel = params.to;

    this.#client = new http.HttpClient("ftp-and-slack-notify HTTP client / 1.0")
  };

  send(message : string, from : string = this.#username, to : string = this.#channel) : boolean {
    if (invalidWebHook(this.#webhook)) {
      util.log_err("Invalid Slack WebHook provided to SlackMSG module.");
      return false;
    }

    // TODO: handle 404, 500 and other errors
    return util.sync_call(
      this.#client.postJson(slackhost + "/" + this.#webhook, {
        username: from,
        channel: to,
        text: message,
        icon_emoji: ":pager:"
      })
    );
  }

  setWebHook(hash : string) : boolean {
    if (invalidWebHook(hash)) {
      util.log_err("Invalid webhook provided.");
      return false;
    }

    this.#webhook = hash;
    return true;
  }
}

export { ISlackMessengerParams, Messenger }