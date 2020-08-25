import * as exec from '@actions/exec';
import { Context } from './context'

export async function runCompose(command: string, context: Context): Promise<void> {
  const composeArgs = [
    '-p',
    context.projectName
  ];
  for (const part of command.trim().split(' ')) {
    composeArgs.push(part);
  }
  await exec.exec('docker-compose', composeArgs);
}

export async function runAction(context: Context): Promise<void> {
  if (context.build) {
    await runCompose('pull', context);
    await runCompose('build', context);
  }
  await runCompose(context.composeCommand, context);
}

export async function runCleanup(context: Context): Promise<void> {
  if (context.push) {
    await runCompose('push', context);
  }

  for (const command of context.postCommand) {
    await runCompose(command, context);
  }
}
