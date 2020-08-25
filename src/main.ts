import * as core from '@actions/core';
import { isPost, getContext, loadState, Context } from './context';
import { runAction, runCleanup } from './compose';

async function run(): Promise<void> {
  try {
    const context: Context = getContext()
    await runAction(context);
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function cleanup(): Promise<void> {
  const context: Context = loadState();
  await runCleanup(context);
}

if (!isPost) {
  run()
} else {
  cleanup()
}
