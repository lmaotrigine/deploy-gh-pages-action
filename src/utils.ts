import * as core from '@actions/core';
import * as io from '@actions/io';
import path from 'path';
import fs from 'fs';

export function getHomeDir(): string {
  let homeDir = '';
  if (process.platform === 'win32') {
    homeDir = process.env['USERPROFILE'] || 'C:\\';
  } else {
    homeDir = `${process.env.HOME}`;
  }
  core.debug(`homeDir: ${homeDir}`);
  return homeDir;
}

export function getWorkDirName(unixTime: string): string {
  const homeDir = getHomeDir();
  return path.join(homeDir, `deploy_gh_pages_action_${unixTime}`);
}

export async function createDir(dirPath: string): Promise<void> {
  await io.mkdirP(dirPath);
  core.debug(`Created directory ${dirPath}`);
}

export function addNoJekyll(workDir: string, disableNojekyll: boolean): void {
  if (disableNojekyll) return;
  const filepath = path.join(workDir, '.nojekyll');
  fs.open(filepath, 'w', (err, fd) => {
    if (err) {
      if (err.code === 'EEXIST') {
        return;
      }
      throw err;
    }
    fs.close(fd, (err) => {
      if (err) throw err;
    });
  });
}

export function addCNAME(workDir: string, content: string): void {
  if (content === '') return;
  const filepath = path.join(workDir, 'CNAME');
  fs.open(filepath, 'w', (err, fd) => {
    if (err) {
      if (err.code === 'EEXIST') {
        core.info(`CNAME already exists, skip adding CNAME`);
        return;
      }
      throw err;
    }
    try {
      fs.write(fd, content + '\n', (err) => {
        if (err) throw err;
      });
    } finally {
      fs.close(fd, (err) => {
        if (err) throw err;
      });
    }
  })
}

export function skipOnFork(isFork: boolean, githubToken: string, deployKey: string, PersonalAccessToken: string): boolean {
  if (isFork) {
    if (githubToken === '' && deployKey === '' && PersonalAccessToken === '') {
      return true;
    }
  }
  return false;
}
