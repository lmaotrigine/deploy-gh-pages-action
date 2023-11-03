export interface Inputs {
  readonly DeployKey: string;
  readonly GithubToken: string;
  readonly PersonalAccessToken: string;
  readonly PublishBranch: string;
  readonly PublishDir: string;
  readonly DestDir: string;
  readonly ExternalRepository: string;
  readonly AllowEmptyCommit: boolean;
  readonly KeepFiles: boolean;
  readonly ForceOrphan: boolean;
  readonly UserName: string;
  readonly UserEmail: string;
  readonly CommitMessage: string;
  readonly FullCommitMessage: string;
  readonly TagName: string;
  readonly TagMessage: string;
  readonly DisableNojekyll: boolean;
  readonly CNAME: string;
  readonly ExcludeAssets: string;
}

export interface CommandResult {
  exitCode: number;
  output: string;
}
