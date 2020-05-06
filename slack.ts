import * as http from "@actions/http-client";
import * as util from "./utils";

let slackhost = "https://hooks.slack.com/services";

interface ISlackMessengerParams {
  from : string;
  to : string;
  portrait_emoji : string
}

function ghBranchLink(owner : string, repo : string, branch : string) {
  return slackLink(
    ghRepoUrl(owner, repo) + "/tree/" + branch,
    "branch " + branch
  );
}
function ghDeployLink(owner : string, repo : string, id : string, count : string) : string {
  return slackLink(
    ghRepoUrl(owner, repo) + "/runs/" + id,
    "Deployment #" + count
  );
}

function ghRepoLink(owner : string, repo : string) : string {
  if (repo.match(/f/) !== null) {
    return slackLink(ghRepoUrl(owner, repo), owner + "/" + repo);
  } else {
    return repo;
  }
}

function ghRepoUrl(owner : string, repo : string) : string {
  return "https://github.com/" + owner + "/" + repo;
}

function slackLink(url : string, desc : string) : string {
  return "<" + url + "|" + desc + ">";
}

function invalidWebHook(hash : string) : boolean {
  return hash.match(/^T[A-Z0-9]{8}\/B[A-Z0-9]{8}\/[A-Za-z0-9]{24}$/) == null;
}

class Messenger {
  #webhook = "";
  #username = "";
  #channel = "";
  #portrait = ":pager:";
  #client : http.HttpClient;

  constructor(params : ISlackMessengerParams, webHook : string) {
    if (!this.setWebHook(webHook)) {
      throw new Error("Unable to bind webhook provided to Slack.Messenger: " + util.pop_last_error());
    }

    this.#username = params.from;
    this.#channel = params.to;

    if (!util.empty(params.portrait_emoji, 3))
      this.#portrait = params.portrait_emoji;

    this.#client = new http.HttpClient("ftp-and-slack-notify HTTP client / 1.0")
  };

  async send(message : string, from : string = this.#username, to : string = this.#channel) : Promise<boolean> {
    if (invalidWebHook(this.#webhook)) {
      util.log_err("Invalid Slack WebHook provided to SlackMSG module.");
      return false;
    }

    try {
      let response = await this.#client.postJson(slackhost + "/" + this.#webhook, {
        username: from,
        channel: to,
        text: message,
        icon_emoji: this.#portrait
      });

      if (response.statusCode != 200) {
        util.log_err("Slack message HTTP submission returned status " + response.statusCode + ".\n" +
          "HTTP response:\n" + response.result);
        return false;
      }
    } catch (err) {
      util.log_err("Slack message HTTP submission attempt resulted in error: " + err);
      return false;
    }

    return true;
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

export { ghBranchLink, ghDeployLink, ghRepoLink, ISlackMessengerParams, Messenger }