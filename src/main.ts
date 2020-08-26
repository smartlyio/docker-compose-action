import * as core from '@actions/core';
import {isPost, getContext, loadState, Context} from './context';
import {runAction, runCleanup} from './compose';

async function run(): Promise<void> {
  try {
    const context: Context = await getContext();
    const containerId: string | null = await runAction(context);
    if (containerId) {
      core.setOutput('container_id', containerId);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function cleanup(): Promise<void> {
  const context: Context = await loadState();
  await runCleanup(context);
}

if (!isPost()) {
  run();
} else {
  cleanup();
}
