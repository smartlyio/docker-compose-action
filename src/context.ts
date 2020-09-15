import * as core from '@actions/core';

export function isPost(): boolean {
  // Will be false if the environment variable doesn't exist; true if it does.
  return !!process.env['STATE_isPost'];
}

export interface Context {
  // Action inputs
  composeFile: string;
  serviceName: string;
  composeCommand: string;
  composeArguments: string[];
  runCommand: string[];
  build: boolean;
  // Derived context
  push: boolean;
  postCommand: string[];
  projectName: string;
  isPost: boolean;
}

export function toBoolean(value: string): boolean {
  const regexp = new RegExp(/^(true|1|on|yes)$/i);
  return regexp.test(value.trim());
}

export function parseArray(value: string): string[] {
  if (!value.trim()) {
    return [];
  }
  return value.trim().split(/\s+/);
}

export function createProjectName(): string {
  const githubRepository: string = process.env['GITHUB_REPOSITORY'] || '';
  const runId = process.env['GITHUB_RUN_ID'] || '';
  const runNumber = process.env['GITHUB_RUN_NUMBER'] || '';
  if (!githubRepository || !runId || !runNumber) {
    throw new Error(
      'Unexpectedly missing Github context GITHUB_REPOSITORY, GITHUB_RUN_ID, or GITHUB_RUN_NUMBER!'
    );
  }
  const repoName = githubRepository.split('/').join('-');
  return `${repoName}-${runId}-${runNumber}`;
}

export function parsePushOption(pushOption: string, build: boolean): boolean {
  if (build && toBoolean(pushOption)) {
    return true;
  }
  if (
    build &&
    pushOption === 'on:push' &&
    process.env['GITHUB_EVENT_NAME'] === 'push'
  ) {
    return true;
  }
  return false;
}

export async function getContext(): Promise<Context> {
  const build: boolean = toBoolean(core.getInput('build'));
  const pushOption: string = core.getInput('push');
  const push: boolean = parsePushOption(pushOption, build);
  const post: boolean = isPost();

  const composeCommand = core.getInput('composeCommand');
  if (composeCommand !== 'up' && composeCommand !== 'run') {
    throw new Error('composeCommand not in [up|run]');
  }

  const context: Context = {
    composeFile: core.getInput('composeFile'),
    serviceName: core.getInput('serviceName', {required: true}),
    composeCommand,
    composeArguments: parseArray(core.getInput('composeArguments')),
    runCommand: parseArray(core.getInput('runCommand')),
    build,
    // Derived context
    postCommand: ['down --remove-orphans --volumes', 'rm -f'],
    projectName: createProjectName(),
    push,
    isPost: post
  };

  core.saveState('isPost', post);
  core.saveState('composeFile', context.composeFile);
  core.saveState('serviceName', context.serviceName);
  core.saveState('composeCommand', context.composeCommand);
  core.saveState('composeArguments', context.composeArguments);
  core.saveState('runCommand', context.runCommand);
  core.saveState('build', context.build);
  core.saveState('postCommand', context.postCommand);
  core.saveState('projectName', context.projectName);
  core.saveState('push', context.push);

  return context;
}

export async function loadState(): Promise<Context> {
  const post: boolean = isPost();
  const context: Context = {
    composeFile: core.getState('composeFile'),
    serviceName: core.getState('serviceName'),
    composeCommand: core.getState('composeCommand'),
    composeArguments: JSON.parse(core.getState('composeArguments')),
    runCommand: JSON.parse(core.getState('runCommand')),
    build: toBoolean(core.getState('build')),
    postCommand: JSON.parse(core.getState('postCommand')),
    projectName: core.getState('projectName'),
    push: toBoolean(core.getState('push')),
    isPost: post
  };
  return context;
}