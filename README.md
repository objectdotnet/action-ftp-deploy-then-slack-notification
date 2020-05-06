# FTP deploy then send Slack notification

This action uses [git-ftp/git-ftp](https://github.com/git-ftp/git-ftp) to sync the repository with a FTP location. During the task, it uses [Slack's Incoming WebHooks](https://api.slack.com/legacy/custom-integrations/incoming-webhooks) to send progress notifications.

This is a part of [GitHub Actions](https://github.com/objectdotnet/github-actions) library created by [Object.NET](https://object.net/).

# Inputs

### `repo-root`

**Required** Repository's root folder to deploy. Default: `"."`.

### `ftp-host`

**Required** The hostname of the FTP server which files should be deployed to. No default value.

### `ftp-user`

**Required** The name of the person to greet. Default `"World"`. No default value.

### `ftp-pass`

**Required** The password to authenticate the FTP user with. No default value. *Note:* Remember to store this as a [repository secret](https://help.github.com/en/actions/configuring-and-managing-workflows/using-variables-and-secrets-in-a-workflow)!

### `ftp-root`

**Required** The remote FTP folder to deploy files to. No default value.

### `slack-webhook`

**Required** The Slack's Incoming WebHook hash to use to send messages. No default value.

### `slack-to`

The Slack's recipient to the message (a channel name or ID, or an user ID). Default: _empty_ (will use whatever is set up in Slack).

### `slack-nick`

The Slack's nickname to assign to the sender. Default: _empty_ (will use whatever is set up in Slack).

### `slack-icon`

The Slack's emoji to use as sender's portrait. Default: _empty_ (will use whatever is set up in Slack).

**Note:** You can use Slack's own emoji picker to check which ones are supported and what's the corresponding string expansion. [Custom emoji](https://slack.com/intl/en-br/help/articles/206870177-Add-custom-emoji) can be used as well. [Unofficial list of supported emoji in Slack from WebFX](https://www.webfx.com/tools/emoji-cheat-sheet/).

# Outputs

None. This action just returns success or failure depending whether the slack messages and FTP synchronization goes well.

Slack messages failing after the FTP sync succeeds won't trigger a failure to the action. But if the first slack message (announcing the action's start) fails, then the whole process will fail.

# Note on secrecy

You can use [repository secret](https://help.github.com/en/actions/configuring-and-managing-workflows/using-variables-and-secrets-in-a-workflow) words to keep sensitive data from being publicly displayed in your repository. FTP Hostname, root directories, username and password, as well as the slack's WebHook; being the latter two the most important ones to be concealed using this technique.

**Secrets disclosure warning:** if any exception or git-ftp command imprints sensitive data, **it may be sent through the Slack notification message**. Especially if `git-ftp` fails due to an incorrect parameter, the slack notice will include the command's output that may potentially disclose sensitive information. To avoid this, arguments passed to the `git-ftp` command (which includes the password) are suppressed from the Slack notification, but we can't guarantee `git-ftp` error output will consistently suppress passwords display.

# Further reading

All about GitHub Actions is documented at [GitHub Actions Documentation Page](https://help.github.com/en/actions/getting-started-with-github-actions)