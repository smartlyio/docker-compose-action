import * as core from '@actions/core';

// Will be false if the environment variable doesn't exist; true if it does.
export const isPost = !!process.env['STATE_isPost'];

export interface Context {
  // Action inputs
  composeFile: string;
  serviceName: string;
  composeCommand: string;
  build: boolean;
  // Derived context
  push: boolean;
  postCommand: string;
  projectName: string;
}

function createProjectName(): string {
  const repoName = process.env['GITHUB_RUN_ID'].replaceAll('/', '-');
  const runId = process.env['GITHUB_RUN_ID'];
  const runNumber = process.env['GITHUB_RUN_NUMBER'];
  return `${repoName}-${runId}-${runNumber}`;
}

function toBoolean(value: string): boolean {
  const regexp = new Regexp(/^(true|1|on)$/i);
  return regexp.test(value.trim());
}

function parsePushOption(pushOption: string, build: boolean): boolean {
  if (build && toBoolean(pushOption)) {
    return true;
  }
  if (build && pushOption === 'on:push' && process.env['GITHUB_EVENT_NAME'] === 'push') {
    return true;
  }
  return false;
}

export async function getContext(): Promise<Context> {
  const build: boolean = toBoolean(core.getInput('build'));
  const pushOption: string = core.getInput('push');
  const push: boolean = parsePushOption(pushOption);
  const context: Context = {
    composeFile: core.getInput('composeFile'),
    serviceName: core.getInput('serviceName', { 'required': true }),
    composeCommand: core.getInput('composeCommand'),
    build,
    // Derived context
    postCommand: ["down --remove-orphans --volumes", "rm -f"],
    projectName: createProjectName(),
    push,
    isPost
  };

  core.saveState('isPost', isPost);
  core.saveState('composeFile', context.composeFile);
  core.saveState('serviceName', context.serviceName);
  core.saveState('composeCommand', context.composeCommand);
  core.saveState('build', context.build);
  core.saveState('postCommand', context.postCommand);
  core.saveState('projectName', context.projectName)
  core.saveState('push', context.push);

  return context;
}

export async function loadState(): Promise<Context> {
  const context: Context = {
    composeFile: core.getState('composeFile'),
    serviceName: core.getState('serviceName'),
    composeCommand: core.getState('composeCommand'),
    build: toBoolean(core.getState('build')),
    postCommand: JSON.parse(core.getState('postCommand')),
    projectName: core.getState('projectName'),
    push: toBoolean(core.getState('push')),
    isPost: isPost
  };
  return context;
}

/*
docker-compose -p '<dirname>-<some-id>'

down --remove-orphans --volumes
rm -f
*/
