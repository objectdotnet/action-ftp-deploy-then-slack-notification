import * as http from "@actions/http-client";
import * as util from "./utils";

let slackhost = "https://hooks.slack.com/services";

interface ISlackMessengerParams {
  from : string,
  to : string,
  portraitEmoji : string,
  noticePrefix: string
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
  #portrait = "";
  #msgNoticePfx = "";
  #client : http.HttpClient;

  constructor(params : ISlackMessengerParams, webHook : string) {
    if (!this.setWebHook(webHook)) {
      throw new Error("Unable to bind webhook provided to Slack.Messenger: " + util.pop_last_error());
    }

    if (!util.empty(params.from)) this.setUser(params.from);
    if (!util.empty(params.to)) this.setChan(params.to);

    if (!util.empty(params.portraitEmoji)) this.setPortrait(params.portraitEmoji);

    if (!util.empty(params.noticePrefix)) {
      this.#msgNoticePfx = params.noticePrefix;
    }

    this.#client = new http.HttpClient("ftp-and-slack-notify HTTP client / 1.0")
  };

  async errorNotice(message : string, error : string) : Promise<boolean> {
    // Slack has a message length limit of around 12,000 characters.
    if (error.length > 11000) {
      error = error.substr(0, 11000) + "\n\n*** output too long -- truncated ***\n";
    }

    if (!util.empty(error)) {
      error = "\n*Error details:*\n```\n" + error + "```";
    }

    return await this.send(this.#msgNoticePfx + ": " + message + "." + error);
  }

  async notice(message : string) : Promise<boolean> {
    return await this.send(this.#msgNoticePfx + ": " + message + ".");
  }

  async send(message : string, from : string = this.#username, to : string = this.#channel) : Promise<boolean> {
    if (invalidWebHook(this.#webhook)) {
      util.log_err("Invalid Slack WebHook provided to SlackMSG module.");
      return false;
    }

    try {
      let response = await this.#client.postJson(slackhost + "/" + this.#webhook, {
        username: util.empty(from) ? undefined : from,
        channel: util.empty(to) ? undefined : to,
        text: message,
        icon_emoji: util.empty(this.#portrait) ? undefined : this.#portrait
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

  setUser(which : string) : boolean {
    if (util.empty(which)) {
      util.log_err("Attempt to assign an invalid/empty Slack nickname: " + which);
      return false;
    }

    this.#username = which;
    return true;
  }

  setChan(which : string) : boolean {
    if (util.empty(which, 2)) {
      util.log_err("Attempt to assign an invalid/empty Slack channel: " + which);
      return false;
    }

    this.#channel = which;
    return true;
  }

  setPortrait(which : string) : boolean {
    if (util.empty(which, 3)) {
      util.log_err("Attempt to assign an invalid/empty Slack icon: " + which);
      return false;
    }

    this.#portrait = util.empty(which, 3) ? "" : which;
    return true;
  }

  setWebHook(hash : string) : boolean {
    if (invalidWebHook(hash)) {

      // Strips leading webhook host if that's the case.
      if (hash.startsWith(slackhost + "/")) {
        let trimmed_hash = hash.substr(slackhost.length + 1);
        if (!invalidWebHook(trimmed_hash)) {
          this.#webhook = trimmed_hash;
          return true;
        }
      }

      util.log_err("Invalid webhook provided.");
      return false;
    }

    this.#webhook = hash;
    return true;
  }
}

export { ghBranchLink, ghDeployLink, ghRepoLink, ISlackMessengerParams, Messenger }