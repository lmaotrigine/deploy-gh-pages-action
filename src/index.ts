import { context } from '@actions/github';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { showInputs, getInputs } from './get_input';
import { setTokens } from './set_tokens';
import { setRepo, setCommitAuthor, getCommitMessage, commit, push, pushTag } from './git';
import { getWorkDirName, addNoJekyll, addCNAME, skipOnFork } from './utils';

export async function run(): Promise<void> {
  try {
    core.info(`[INFO]: Starting deploy action`);
    const i = getInputs();
    core.startGroup('Dump inputs');
    showInputs(i);
    core.endGroup();
    if (core.isDebug()) {
      core.startGroup('[DEBUG]: dump context');
      console.log(context);
      core.endGroup();
    }
    const eventName = context.eventName;
    if (eventName === 'pull_request' || eventName === 'push') {
      const isFork = context.payload.repository?.fork ?? false;
      const isSkipOnFork = await skipOnFork(isFork, i.GithubToken, i.DeployKey, i.PersonalAccessToken);
      if (isSkipOnFork) {
        core.warning('This action is running on a fork and no PAT or deploy key was provided. Skipping deployment.');
        core.setOutput('skip', 'true');
        return;
      }
    }
    core.startGroup('Setup tokens');
    const remoteURL = await setTokens(i);
    core.debug(`remoteURL: ${remoteURL}`);
    core.endGroup();
    
    core.startGroup('Prepare publishing');
    const date = new Date();
    const unixTime = date.getTime();
    const workDir = await getWorkDirName(`${unixTime}`);
    await setRepo(i, remoteURL, workDir);
    addNoJekyll(workDir, i.DisableNojekyll);
    addCNAME(workDir, i.CNAME);
    core.endGroup();

    core.startGroup('Setup git config');
    try {
      await exec.exec('git', ['remote', 'rm', 'origin']);
    } catch (err) {
      if (err instanceof Error) {
        core.info(`[INFO]: ${err.message}`);
      } else {
        throw new Error(`unexpected error: ${err}`);
      }
    }
    await exec.exec('git', ['remote', 'add', 'origin', remoteURL]);
    await exec.exec('git', ['add', '--all']);
    await setCommitAuthor(i.UserName, i.UserEmail);
    core.endGroup();

    core.startGroup('Commit changes');
    const sha = `${process.env.GITHUB_SHA}`;
    const baseRepo = `${github.context.repo.owner}/${github.context.repo.repo}`;
    const commitMessage = getCommitMessage(i.CommitMessage, i.FullCommitMessage, i.ExternalRepository, baseRepo, sha);
    await commit(i.AllowEmptyCommit, commitMessage);
    core.endGroup();

    core.startGroup('Push changes');
    await push(i.PublishBranch, i.ForceOrphan);
    await pushTag(i.TagName, i.TagMessage);
    core.endGroup();

    core.info(`[INFO]: Finished deploy action`);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(err.message);
    } else {
      throw new Error(`unexpected error: ${err}`);
    }
  }
}
