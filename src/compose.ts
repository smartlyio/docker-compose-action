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
): Promise<number> {
  const composeArgs = [];
  for (const part of context.composeFiles) {
    composeArgs.push('-f', part);
  }
  composeArgs.push('-p', context.projectName);
  for (const part of command.trim().split(/\s+/)) {
    composeArgs.push(part);
  }
  for (const part of args) {
    composeArgs.push(part);
  }
  return await exec.exec('docker-compose', composeArgs, execOptions);
}

export async function getContainerId(context: Context): Promise<string | null> {
  let stdout = '';
  const options: exec.ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      }
    }
  };
  try {
    await runCompose(
      'ps',
      ['-aq'].concat(serviceNameArgsArray(context)),
      context,
      options
    );
  } catch (e) {
    core.warning(
      'Error running `docker-compose ps`, not returning a container ID'
    );
    return null;
  }
  return stdout.trim();
}

function serviceNameArgsArray(context: Context): string[] {
  if (context.serviceName) {
    return [context.serviceName];
  } else {
    return [];
  }
}

export async function runAction(context: Context): Promise<string | null> {
  const serviceNameArgs = serviceNameArgsArray(context);
  await runCompose('pull', serviceNameArgs, context);
  if (context.build) {
    await runCompose(
      'build',
      [...context.buildArgs, ...serviceNameArgs],
      context
    );
  }
  let args: string[] = [];
  for (const part of context.composeArguments) {
    args.push(part);
  }
  args = args.concat(serviceNameArgs);
  if (context.composeCommand === 'run') {
    for (const part of context.runCommand) {
      args.push(part);
    }
  }
  try {
    const exitCode = await runCompose(context.composeCommand, args, context);
    if (exitCode !== 0) {
      throw new ComposeError(`docker-compose exited with code ${exitCode}`, null);
    }
  } catch (e) {
    const containerId = await getContainerId(context);
    throw new ComposeError(`${e}`, containerId);
  }

  const containerId = await getContainerId(context);
  return containerId;
}

export async function runCleanup(context: Context): Promise<void> {
  const errors: string[] = [];
  if (context.push) {
    try {
      await runCompose('push', serviceNameArgsArray(context), context);
    } catch (e) {
      errors.push('ERROR: docker-compose push failed');
      errors.push(`${e}`);
    }
  }

  for (const command of context.postCommand) {
    try {
      await runCompose(command, [], context);
    } catch (e) {
      errors.push(`ERROR: docker-compose ${command} failed`);
      errors.push(`${e}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}
