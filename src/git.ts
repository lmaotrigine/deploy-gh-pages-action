import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as io from '@actions/io';
import path from 'path';
import fs from 'fs';
import {URL} from 'url';
import type {Inputs, CommandResult} from './lib';
import {createDir} from './utils';

export async function createBranchForce(branch: string): Promise<void> {
  await exec.exec('git', ['init']);
  await exec.exec('git', ['checkout', '--orphan', branch]);
}

export function getServerUrl(): URL {
  return new URL(process.env['GITHUB_SERVER_URL'] || 'https://github.com');
}

export async function deleteExcludedAssets(destDir: string, excludeAssets: string): Promise<void> {
  if (excludeAssets === '') return;
  core.info(`[INFO]: delete excluded assets`);
  const excludedAssetNames = excludeAssets.split(',');
  const excludedAssetPaths = ((): string[] => {
    const paths: string[] = [];
    for (const pattern of excludedAssetNames) {
      paths.push(path.join(destDir, pattern));
    }
    return paths;
  })();
  const globber = await glob.create(excludedAssetPaths.join('\n'));
  for await (const file of globber.globGenerator()) {
    core.info(`[INFO]: delete ${file}`);
    await io.rmRF(file);
  }
}

export async function copyAssets(publishDir: string, destDir: string, excludeAssets: string): Promise<void> {
  core.info(`[INFO]: prepare publishing assets`);
  if (!fs.existsSync(publishDir)) {
    core.info(`[INFO]: create ${publishDir}`);
    await createDir(publishDir);
  }

  const gitGitPath = path.join(publishDir, '.git');
  if (fs.existsSync(gitGitPath)) {
    core.info(`[INFO]: remove ${gitGitPath}`);
    await io.rmRF(gitGitPath);
  }
  core.info(`[INFO]: copy ${publishDir} to ${destDir}`);
  io.cp(publishDir, destDir, {recursive: true, force: true, copySourceDirectory: false});
  await deleteExcludedAssets(destDir, excludeAssets);
}

export async function setRepo(i: Inputs, remoteURL: string, workDir: string): Promise<void> {
  const publishDir = path.isAbsolute(i.PublishDir) ? i.PublishDir : path.join(`${process.env.GITHUB_WORKSPACE}`, i.PublishDir);
  if (path.isAbsolute(i.DestDir)) throw new Error('dest_dir must be a relative path');
  const destDir = ((): string => {
    if (i.DestDir === '') return workDir;
    return path.join(workDir, i.DestDir);
  })();
  core.info(`[INFO]: Force orphan: ${i.ForceOrphan}`);
  if (i.ForceOrphan) {
    await createDir(destDir);
    core.info(`[INFO]: chdir ${destDir}`);
    process.chdir(destDir);
    await createBranchForce(i.PublishBranch);
    await copyAssets(publishDir, destDir, i.ExcludeAssets);
    return;
  }
  const result: CommandResult = {
    exitCode: 0,
    output: '',
  };
  const options = {
    listeners: {
      stdout: (data: Buffer): void => {
        result.output += data.toString();
      }
    }
  };
  try {
    result.exitCode = await exec.exec('git', ['clone', '--depth=1', '--single-branch', '--branch', i.PublishBranch, remoteURL, workDir], options);
    if (result.exitCode === 0) {
      await createDir(destDir);
      if (i.KeepFiles) {
        core.info(`[INFO]: Keeping existing files`);
      } else {
        core.info(`[INFO]: clean up ${destDir}`);
        core.info(`[INFO]: chdir ${destDir}`);
        await exec.exec('git', ['rm', '-r', '--ignore-unmatch', '*']);
      }
      core.info(`[INFO]: chdir ${workDir}`);
      process.chdir(workDir);
      await copyAssets(publishDir, destDir, i.ExcludeAssets);
      return;
    } else {
      throw new Error(`Failed to clone remote branch ${i.PublishBranch}`);
    }
  } catch (err) {
    if (err instanceof Error) {
      core.info(`[INFO] first deployment, create new branch ${i.PublishBranch}`);
      core.info(`[INFO]: ${err.message}`);
      await createDir(destDir);
      core.info(`[INFO]: chdir ${destDir}`);
      process.chdir(destDir);
      await createBranchForce(i.PublishBranch);
      await copyAssets(publishDir, destDir, i.ExcludeAssets);
    } else {
      throw new Error(`unexpected error: ${err}`)
    }
  }
}

export function getUserName(userName: string): string {
  if (userName) return userName;
  return `${process.env.GITHUB_ACTOR}`;
}

export function getUserEmail(userEmail: string): string {
  if (userEmail) return userEmail;
  return `${process.env.GITHUB_ACTOR}@users.noreply.github.com`;
}

export async function setCommitAuthor(userName: string, userEmail: string): Promise<void> {
  if (userName && !userEmail) throw new Error('user_email is required if user_name is specified');
  if (!userName && userEmail) throw new Error('user_name is required if user_email is specified');
  await exec.exec('git', ['config', 'user.name', getUserName(userName)]);
  await exec.exec('git', ['config', 'user.email', getUserEmail(userEmail)]);
}

export function getCommitMessage(msg: string, fullMsg: string, extRepo: string, baseRepo: string, sha: string): string {
  const msgSha = ((): string => {
    if (extRepo) return `${baseRepo}@${sha}`;
    return sha;
  })();
  const subject = ((): string => {
    if (fullMsg) return fullMsg;
    else if (msg) return `${msg} ${msgSha}`;
    return `deploy: ${msgSha}`;
  })();
  return subject;
}

export async function commit(allowEmptyCommit: boolean, msg: string): Promise<void> {
  try {
    if (allowEmptyCommit) {
      await exec.exec('git', ['commit', '--allow-empty', '-m', `${msg}`]);
    } else {
      await exec.exec('git', ['commit', '-m', `${msg}`]);
    }
  } catch (err) {
    if (err instanceof Error) {
      core.info('[INFO]: skip commit');
      core.debug(`[DEBUG]: skip commit ${err.message}`);
    } else {
      throw new Error(`unexpected error: ${err}`);
    }
  }
}

export async function push(branch: string, forceOrphan: boolean): Promise<void> {
  if (forceOrphan) {
    await exec.exec('git', ['push', 'origin', '--force', branch]);
  } else {
    await exec.exec('git', ['push', 'origin', branch]);
  }
}

export async function pushTag(tagName: string, tagMessage: string): Promise<void> {
  if (tagName === '') return;
  const msg = tagMessage ? tagMessage : `Deployment ${tagName}`;
  await exec.exec('git', ['tag', '-a', `${tagName}`, '-m', `${msg}`]);
  await exec.exec('git', ['push', 'origin', `${tagName}`]);
}
