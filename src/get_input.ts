import * as core from '@actions/core';
import { type Inputs } from './lib';

export function showInputs(i: Inputs): void {
  let authMethod = '';
  if (i.DeployKey) {
    authMethod = 'Deploy key';
  } else if (i.GithubToken) {
    authMethod = 'GitHub token';
  } else if (i.PersonalAccessToken) {
    authMethod = 'Personal access token';
  }
  core.info(`\
[INFO]: ${authMethod}: true
[INFO]: Publish branch: ${i.PublishBranch}
[INFO]: Publish directory: ${i.PublishDir}
[INFO]: Destination directory: ${i.DestDir}
[INFO]: External repository: ${i.ExternalRepository}
[INFO]: Allow empty commit: ${i.AllowEmptyCommit}
[INFO]: Keep files: ${i.KeepFiles}
[INFO]: Force orphan: ${i.ForceOrphan}
[INFO]: User name: ${i.UserName}
[INFO]: User email: ${i.UserEmail}
[INFO]: Commit message: ${i.CommitMessage}
[INFO]: Full commit message: ${i.FullCommitMessage}
[INFO]: Tag name: ${i.TagName}
[INFO]: Tag message: ${i.TagMessage}
[INFO]: Enable Jekyll (Disable nojekyll): ${i.DisableNojekyll}
[INFO]: CNAME: ${i.CNAME}
[INFO]: Exclude assets: ${i.ExcludeAssets}
`);
}

export function getInputs(): Inputs {
  let useBuiltinjekyll = false;
  const isBoolean = (param: string): boolean => (param || 'false').toUpperCase() === 'TRUE';
  const enableJekyll = isBoolean(core.getInput('enable_jekyll'));
  const disableNojekyll = isBoolean(core.getInput('disable_nojekyll'));
  if (enableJekyll && disableNojekyll) {
    throw new Error('Use either of enable_jekyll or disable_nojekyll');
  } else if (enableJekyll || disableNojekyll) {
    useBuiltinjekyll = true;
  }
  return {
    DeployKey: core.getInput('deploy_key'),
    GithubToken: core.getInput('github_token'),
    PersonalAccessToken: core.getInput('personal_access_token'),
    PublishBranch: core.getInput('publish_branch'),
    PublishDir: core.getInput('publish_dir'),
    DestDir: core.getInput('dest_dir'),
    ExternalRepository: core.getInput('external_repository'),
    AllowEmptyCommit: isBoolean(core.getInput('allow_empty_commit')),
    KeepFiles: isBoolean(core.getInput('keep_files')),
    ForceOrphan: isBoolean(core.getInput('force_orphan')),
    UserName: core.getInput('user_name'),
    UserEmail: core.getInput('user_email'),
    CommitMessage: core.getInput('commit_message'),
    FullCommitMessage: core.getInput('full_commit_message'),
    TagName: core.getInput('tag_name'),
    TagMessage: core.getInput('tag_message'),
    DisableNojekyll: useBuiltinjekyll,
    CNAME: core.getInput('cname'),
    ExcludeAssets: core.getInput('exclude_assets'),
  };
}
