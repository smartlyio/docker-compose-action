import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {Context} from './context';



export class ComposeError extends Error {
  containerId: string | null;

  constructor(message: string, containerId: string | null) {
    super(message);

    this.containerId = containerId;
  }
}

export async function runCompose(
  command: string,
  args: string[],
  context: Context,
  execOptions?: exec.ExecOptions
): Promise<void> {
  const composeArgs = ['-f', context.composeFile, '-p', context.projectName];
  for (const part of command.trim().split(/\s+/)) {
    composeArgs.push(part);
  }
  for (const part of args) {
    composeArgs.push(part);
  }
  await exec.exec('docker-compose', composeArgs, execOptions);
}

export async function getContainerId(context: Context): Promise<string|null> {
  let stdout = '';
  const options: exec.ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      }
    }
  };
  try {
    await runCompose('ps', ['-q', context.serviceName], context, options);
  } catch (e) {
    core.warning(
      'Error running `docker-compose ps`, not returning a container ID'
    );
    return null;
  }
  return stdout.trim();
}

export async function runAction(context: Context): Promise<string | null> {
  await runCompose('pull', [context.serviceName], context);
  if (context.build) {
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
  try {
    await runCompose(context.composeCommand, args, context);
  } catch (e) {
    const containerId = await getContainerId(context);
    throw new ComposeError(e.message, containerId);
  }

  const containerId = await getContainerId(context);
  return containerId;
}

export async function runCleanup(context: Context): Promise<void> {
  const errors: string[] = [];
  if (context.push) {
    try {
      await runCompose('push', [context.serviceName], context);
    } catch (e) {
      errors.push(e.message);
    }
  }

  for (const command of context.postCommand) {
    try {
      await runCompose(command, [], context);
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}
