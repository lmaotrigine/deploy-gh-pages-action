import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import * as io from '@actions/io';
import path from 'path';
import fs from 'fs';
import type {Inputs} from './lib';
import { getHomeDir } from './utils';
import { getServerUrl } from './git';

export async function setSSHKey(i: Inputs, publishRepo: string): Promise<string> {
  core.info(`[INFO]: setup SSH deploy key`);
  const homeDir = getHomeDir();
  const sshDir = path.join(homeDir, '.ssh');
  await io.mkdirP(sshDir);
  await exec.exec('chmod', ['700', sshDir]);
  const knownHosts = path.join(sshDir, 'known_hosts');
  // ssh-keyscan -t ed25519 github.com or serverUrl >> ~/.ssh/known_hosts
  const cmdSSHKeyscanOutput = `\
# github.com:22 SSH-2.0-babeld-f8b1fc6c
${getServerUrl().host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
`;
  fs.writeFile(knownHosts, cmdSSHKeyscanOutput + '\n', (err) => {
    if (err) throw err;
  });
  core.info(`[INFO]: wrote ${knownHosts}`);
  await exec.exec('chmod', ['600', knownHosts]);
  const idEd25519 = path.join(sshDir, 'github');
  fs.writeFile(idEd25519, i.DeployKey + '\n', (err) => {
    if (err) throw err;
  });
  core.info(`[INFO]: wrote ${idEd25519}`);
  await exec.exec('chmod', ['600', idEd25519]);
  const sshConfigPath = path.join(sshDir, 'config');
  const sshConfigContent = `\
Host ${getServerUrl().host}
  HostName ${getServerUrl().host}
  IdentityFile ~/.ssh/github
  User git
`;
  fs.writeFile(sshConfigPath, sshConfigContent + '\n', (err) => {
    if (err) throw err;
  });
  core.info(`[INFO]: wrote ${sshConfigPath}`);
  await exec.exec('chmod', ['600', sshConfigPath]);
  if (process.platform === 'win32') {
    core.error(`[ERROR]: Currently, deploy_key is not supported on Windows. Soon:tm:`);
    throw new Error(`Currently, deploy_key is not supported on Windows. Please use github_token or personal_access_token instead.`);
  }
  await exec.exec('ssh-agent', ['-a', '/tmp/ssh-auth.sock']);
  core.exportVariable('SSH_AUTH_SOCK', '/tmp/ssh-auth.sock');
  await exec.exec('ssh-add', [idEd25519]);
  return `git@${getServerUrl().host}:${publishRepo}.git`;
}

export function setGithubToken(githubToken: string, publishRepo: string, publishBranch: string, externalRepository: string, ref: string, eventName: string): string {
  core.info(`[INFO]: setup GitHub token`);
  core.debug(`ref: ${ref}`);
  core.debug(`eventName: ${eventName}`);
  let isProhibitedBranch = false;
  if (externalRepository) {
    throw new Error(`\
The generated GITHUB_TOKEN (github_token) does not support pushing to external repositories.
Use the deploy_key or personal_access_token input instead.
`);
  }
  if (eventName === 'push') {
    isProhibitedBranch = ref.match(new RegExp(`^refs/heads/${publishBranch}$`)) !== null;
    if (isProhibitedBranch) {
      throw new Error(`
You are trying to deploy from ${publishBranch} to ${publishBranch}.
This operation is not permitted because you obviously did not intend to do this.
`);
    }
  }
  return `https://x-access-token:${githubToken}@${getServerUrl().host}/${publishRepo}.git`;
}

export function setPersonalAccessToken(personalAccessToken: string, publishRepo: string): string {
  core.info(`[INFO]: setup Personal access token`);
  return `https://x-access-token:${personalAccessToken}@${getServerUrl().host}/${publishRepo}.git`;
}

export function getPublishRepo(externalRepository: string, owner: string, repo: string): string {
  if (externalRepository) return externalRepository;
  return `${owner}/${repo}`;
}

export async function setTokens(i: Inputs): Promise<string> {
  try {
    const publishRepo = getPublishRepo(i.ExternalRepository, github.context.repo.owner, github.context.repo.repo);
    if (i.DeployKey) return await setSSHKey(i, publishRepo);
    else if (i.GithubToken) {
      const context = github.context;
      const ref = context.ref;
      const eventName = context.eventName;
      return setGithubToken(i.GithubToken, publishRepo, i.PublishBranch, i.ExternalRepository, ref, eventName);
    }
    else if (i.PersonalAccessToken) {
      return setPersonalAccessToken(i.PersonalAccessToken, publishRepo);
    } else {
      throw new Error('no deploy key or tokens specified');
    }
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(err.message);
    } else {
      throw new Error(`unexpected error: ${err}`);
    }
  }
}
