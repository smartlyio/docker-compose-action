import {Context} from '../src/context';
import {runCompose, runAction, runCleanup} from '../src/compose';
import {mocked} from 'ts-jest/utils';
import {exec} from '@actions/exec';

jest.mock('@actions/exec', () => ({
  exec: jest.fn()
}));

const OLD_ENV = process.env;
beforeEach(() => {
  process.env = {...OLD_ENV};
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe('run docker-compose', () => {
  test('basic command', async () => {
    const command = 'build';
    const projectName = 'test-name';
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: true,
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCompose(command, [], context);

    const mockExec = mocked(exec);
    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(1);
    const expectedArgs: string[] = ['-p', projectName, command];
    expect(mockExec).toHaveBeenCalledWith('docker-compose', expectedArgs);
  });

  test('whitespace separate commands and args', async () => {
    const command = '\n\n\ndown \n --remove-orphans  --volumes  ';
    const projectName = 'test-name';
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: true,
      push: false,
      postCommand: [command, 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCompose(command, [], context);

    const mockExec = mocked(exec);
    const expectedArgs: string[] = [
      '-p',
      projectName,
      'down',
      '--remove-orphans',
      '--volumes'
    ];
    expect(mockExec).toHaveBeenCalledWith('docker-compose', expectedArgs);
  });

  test('separate command and args', async () => {
    const command = 'down';
    const args = ['--remove-orphans', '--volumes'];
    const projectName = 'test-name';
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: true,
      push: false,
      postCommand: [command, 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCompose(command, args, context);

    const mockExec = mocked(exec);
    const expectedArgs: string[] = [
      '-p',
      projectName,
      'down',
      '--remove-orphans',
      '--volumes'
    ];
    expect(mockExec).toHaveBeenCalledWith('docker-compose', expectedArgs);
  });
});

describe('Main action entrypoint', () => {
  test('run action with build', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: ['ignored'],
      build: true,
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runAction(context);

    const mockExec = mocked(exec);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(3);
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-p', projectName, 'pull', serviceName]
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      ['-p', projectName, 'build', serviceName]
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      ['-p', projectName, 'up', '--abort-on-container-exit', serviceName]
    ]);
  });

  test('run action with compose run', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const runCommand = ['bash', './run-my-script.sh'];
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName,
      composeCommand: 'run',
      composeArguments: ['--custom-arg'],
      runCommand,
      build: false,
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runAction(context);

    const mockExec = mocked(exec);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(1);
    const expectedArgs = [
      '-p',
      projectName,
      'run',
      '--custom-arg',
      serviceName,
      runCommand[0],
      runCommand[1]
    ];
    expect(mockExec).toHaveBeenCalledWith('docker-compose', expectedArgs);
  });
});

describe('Post-action entrypoint', () => {
  test('run action with build & push', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--custom-arg'],
      runCommand: [],
      build: true,
      push: true,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCleanup(context);

    const mockExec = mocked(exec);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(3);
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-p', projectName, 'push', serviceName]
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      ['-p', projectName, 'down', '--remove-orphans', '--volumes']
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      ['-p', projectName, 'rm', '-f']
    ]);
  });

  test('run action without push', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--custom-arg'],
      runCommand: [],
      build: true,
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCleanup(context);

    const mockExec = mocked(exec);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-p', projectName, 'down', '--remove-orphans', '--volumes']
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      ['-p', projectName, 'rm', '-f']
    ]);
  });

  test("post-action cleanup doens't abort on first error", async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFile: 'docker-compose.ci.yml',
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--custom-arg'],
      runCommand: [],
      build: true,
      push: true,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    const mockExec = mocked(exec);
    const errorText = 'this was an error';
    mockExec.mockImplementationOnce(async () => {
      throw new Error(errorText);
    });
    mockExec.mockImplementation(async () => {
      return 0;
    });

    await expect(runCleanup(context)).rejects.toThrowError(errorText);

    // All cleanup calls are still invoked, even though the first might fail.
    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(3);
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-p', projectName, 'push', serviceName]
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      ['-p', projectName, 'down', '--remove-orphans', '--volumes']
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      ['-p', projectName, 'rm', '-f']
    ]);
  });
});
