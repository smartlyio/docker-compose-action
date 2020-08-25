import * as exec from '@actions/exec';
import { Context } from './context'

export async function runCompose(command: string, args: string[], context: Context): Promise<void> {
  const composeArgs = [
    '-p',
    context.projectName
  ];
  for (const part of command.trim().split(/\s+/)) {
    composeArgs.push(part);
  }
  for (const part of args) {
    composeArgs.push(part);
  }
  await exec.exec('docker-compose', composeArgs);
}

export async function runAction(context: Context): Promise<void> {
  if (context.build) {
    await runCompose('pull', [context.serviceName], context);
    await runCompose('build', [context.serviceName], context);
  }
  const args: string[] = [];
  for (const part of context.composeArguments) {
    args.push(part);
  }
  args.push(context.serviceName);
  if (context.composeCommand === 'run') {
    for (const part of context.runCommand) {
      args.push(part);
    }
  }
  await runCompose(context.composeCommand, args, context);
}

export async function runCleanup(context: Context): Promise<void> {
  // FIXME: Don't abort on error here
  if (context.push) {
    await runCompose('push', [context.serviceName], context);
  }

  for (const command of context.postCommand) {
    await runCompose(command, [], context);
  }
}
