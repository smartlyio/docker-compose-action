import {Context} from '../src/context';
import {runCompose, runAction, runCleanup, ComposeError} from '../src/compose';
import {mocked} from 'jest-mock';
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
      composeFiles: ['docker-compose.ci.yml'],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: true,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCompose(command, [], context);

    const mockExec = mocked(exec);
    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(1);
    const expectedArgs: string[] = [
      '-f',
      context.composeFiles[0],
      '-p',
      projectName,
      command
    ];
    expect(mockExec).toHaveBeenCalledWith(
      'docker-compose',
      expectedArgs,
      undefined
    );
  });

  test('with two docker-compose files', async () => {
    const command = 'build';
    const projectName = 'test-name';
    const context: Context = {
      composeFiles: ['docker-compose.yml', 'docker-compose.ci.yml'],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: true,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCompose(command, [], context);

    const mockExec = mocked(exec);
    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(1);
    const expectedArgs: string[] = [
      '-f',
      context.composeFiles[0],
      '-f',
      context.composeFiles[1],
      '-p',
      projectName,
      command
    ];
    expect(mockExec).toHaveBeenCalledWith(
      'docker-compose',
      expectedArgs,
      undefined
    );
  });

  test('whitespace separate commands and args', async () => {
    const command = '\n\n\ndown \n --remove-orphans  --volumes  ';
    const projectName = 'test-name';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: true,
      buildArgs: [],
      push: false,
      postCommand: [command, 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCompose(command, [], context);

    const mockExec = mocked(exec);
    const expectedArgs: string[] = [
      '-f',
      context.composeFiles[0],
      '-p',
      projectName,
      'down',
      '--remove-orphans',
      '--volumes'
    ];
    expect(mockExec).toHaveBeenCalledWith(
      'docker-compose',
      expectedArgs,
      undefined
    );
  });

  test('separate command and args', async () => {
    const command = 'down';
    const args = ['--remove-orphans', '--volumes'];
    const projectName = 'test-name';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: true,
      buildArgs: [],
      push: false,
      postCommand: [command, 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    await runCompose(command, args, context);

    const mockExec = mocked(exec);
    const expectedArgs: string[] = [
      '-f',
      context.composeFiles[0],
      '-p',
      projectName,
      'down',
      '--remove-orphans',
      '--volumes'
    ];
    expect(mockExec).toHaveBeenCalledWith(
      'docker-compose',
      expectedArgs,
      undefined
    );
  });
});

describe('Main action entrypoint', () => {
  test('run action with build', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: ['ignored'],
      build: true,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };
    const containerId = 'abc123';

    const mockExec = mocked(exec);
    mockExec.mockImplementation(async (cmd, args, options): Promise<number> => {
      if (options && options.listeners && options.listeners.stdout) {
        options.listeners.stdout(new Buffer(`${containerId}\n`));
      }
      return 0;
    });

    const output = await runAction(context);

    expect(output).toEqual(containerId);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(4);
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'pull', serviceName],
      undefined
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'build', serviceName],
      undefined
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'up',
        '--abort-on-container-exit',
        serviceName
      ],
      undefined
    ]);
    const expectedOptions = expect.objectContaining({
      listeners: expect.objectContaining({
        stdout: expect.anything()
      })
    });
    expect(calls[3]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'ps',
        '-aq',
        serviceName
      ],
      expectedOptions
    ]);
  });

  test('run action with build and build args', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: ['ignored'],
      build: true,
      buildArgs: ['--build-arg', 'TEST_ARG=1', '--build-arg', 'TEST_ARG_2=2'],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };
    const containerId = 'abc123';

    const mockExec = mocked(exec);
    mockExec.mockImplementation(async (cmd, args, options): Promise<number> => {
      if (options && options.listeners && options.listeners.stdout) {
        options.listeners.stdout(new Buffer(`${containerId}\n`));
      }
      return 0;
    });

    const output = await runAction(context);

    expect(output).toEqual(containerId);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(4);
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'pull', serviceName],
      undefined
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'build',
        context.buildArgs,
        serviceName
      ].flat(),
      undefined
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'up',
        '--abort-on-container-exit',
        serviceName
      ],
      undefined
    ]);
    const expectedOptions = expect.objectContaining({
      listeners: expect.objectContaining({
        stdout: expect.anything()
      })
    });
    expect(calls[3]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'ps',
        '-aq',
        serviceName
      ],
      expectedOptions
    ]);
  });

  test('run action without serviceName', async () => {
    const projectName = 'test-name';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName: null,
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: ['ignored'],
      build: true,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };
    const containerId = 'abc123';

    const mockExec = mocked(exec);
    mockExec.mockImplementation(async (cmd, args, options): Promise<number> => {
      if (options && options.listeners && options.listeners.stdout) {
        options.listeners.stdout(new Buffer(`${containerId}\n`));
      }
      return 0;
    });

    const output = await runAction(context);

    expect(output).toEqual(containerId);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(4);
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'pull'],
      undefined
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'build'],
      undefined
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'up',
        '--abort-on-container-exit'
      ],
      undefined
    ]);
    const expectedOptions = expect.objectContaining({
      listeners: expect.objectContaining({
        stdout: expect.anything()
      })
    });
    expect(calls[3]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'ps', '-aq'],
      expectedOptions
    ]);
  });

  test('run action with compose run', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const runCommand = ['bash', './run-my-script.sh'];
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName,
      composeCommand: 'run',
      composeArguments: ['--custom-arg'],
      runCommand,
      build: false,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    const mockExec = mocked(exec);
    mockExec.mockImplementation(async (cmd, args, options): Promise<number> => {
      if (options && options.listeners && options.listeners.stdout) {
        throw new Error("Container doesn't exist?");
      }
      return 0;
    });

    const output = await runAction(context);
    expect(output).toBe(null);

    const calls = mockExec.mock.calls;
    expect(calls.length).toBe(3);
    const expectedArgs = [
      '-f',
      context.composeFiles[0],
      '-p',
      projectName,
      'run',
      '--custom-arg',
      serviceName,
      runCommand[0],
      runCommand[1]
    ];
    expect(calls[0]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'pull', serviceName],
      undefined
    ]);
    expect(calls[1]).toEqual(['docker-compose', expectedArgs, undefined]);
    const expectedOptions = expect.objectContaining({
      listeners: expect.objectContaining({
        stdout: expect.anything()
      })
    });
    expect(calls[2]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'ps',
        '-aq',
        serviceName
      ],
      expectedOptions
    ]);
  });

  test('get containerId after failed compose run', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const runCommand = ['bash', './run-my-script.sh'];
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName,
      composeCommand: 'run',
      composeArguments: ['--custom-arg'],
      runCommand,
      build: false,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName: projectName
    };

    const mockExec = mocked(exec);
    mockExec
      .mockImplementationOnce(async (cmd, args, options): Promise<number> => {
        return 0;
      })
      .mockImplementationOnce(async (cmd, args, options): Promise<number> => {
        throw new Error('Container failed');
      })
      .mockImplementationOnce(async (cmd, args, options): Promise<number> => {
        if (options && options.listeners && options.listeners.stdout) {
          options.listeners.stdout(Buffer.from('container-id'));
        }
        return 0;
      });

    await expect(runAction(context)).rejects.toThrow(
      new ComposeError('Error: Container failed', 'container-id')
    );
  });
});

describe('Post-action entrypoint', () => {
  test('run action with build & push', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--custom-arg'],
      runCommand: [],
      build: true,
      buildArgs: [],
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
      ['-f', context.composeFiles[0], '-p', projectName, 'push', serviceName],
      undefined
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'down',
        '--remove-orphans',
        '--volumes'
      ],
      undefined
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'rm', '-f'],
      undefined
    ]);
  });

  test('run action without push', async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--custom-arg'],
      runCommand: [],
      build: true,
      buildArgs: [],
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
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'down',
        '--remove-orphans',
        '--volumes'
      ],
      undefined
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'rm', '-f'],
      undefined
    ]);
  });

  test("post-action cleanup doesn't abort on first error", async () => {
    const projectName = 'test-name';
    const serviceName = 'test-service';
    const context: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName,
      composeCommand: 'up',
      composeArguments: ['--custom-arg'],
      runCommand: [],
      build: true,
      buildArgs: [],
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
      ['-f', context.composeFiles[0], '-p', projectName, 'push', serviceName],
      undefined
    ]);
    expect(calls[1]).toEqual([
      'docker-compose',
      [
        '-f',
        context.composeFiles[0],
        '-p',
        projectName,
        'down',
        '--remove-orphans',
        '--volumes'
      ],
      undefined
    ]);
    expect(calls[2]).toEqual([
      'docker-compose',
      ['-f', context.composeFiles[0], '-p', projectName, 'rm', '-f'],
      undefined
    ]);
  });
});
