import {
  Context,
  isPost,
  createProjectName,
  parsePushOption,
  toBoolean,
  parseArray,
  getContext,
  loadState
} from '../src/context';
import {mocked} from 'jest-mock';
import {
  getInput,
  getMultilineInput,
  saveState,
  getState,
  info
} from '@actions/core';
import {v4 as uuidv4} from 'uuid';

jest.mock('uuid', () => ({
  v4: jest.fn()
}));

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getMultilineInput: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  info: jest.fn()
}));

const OLD_ENV = process.env;
beforeEach(() => {
  process.env = {...OLD_ENV};
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe('isPost', () => {
  test('is true if env var is present', () => {
    process.env['STATE_isPost'] = 'true';
    expect(isPost()).toEqual(true);
  });
  test('is false if not present', () => {
    expect(isPost()).toEqual(false);
  });
});

describe('toBoolean', () => {
  describe('parsing true values', () => {
    test('true is truthy', () => {
      expect(toBoolean('true')).toEqual(true);
    });
    test('1 is truthy', () => {
      expect(toBoolean('1')).toEqual(true);
    });
    test('on is truthy', () => {
      expect(toBoolean('on')).toEqual(true);
    });
    test('yes is truthy', () => {
      expect(toBoolean('yes')).toEqual(true);
    });
  });

  describe('parsing false values', () => {
    test('0 is false', () => {
      expect(toBoolean('0')).toEqual(false);
    });
    test('other numbers are false', () => {
      expect(toBoolean('-2')).toEqual(false);
      expect(toBoolean('7')).toEqual(false);
      expect(toBoolean('25')).toEqual(false);
    });
    test('off is false', () => {
      expect(toBoolean('off')).toEqual(false);
    });
    test('no is false', () => {
      expect(toBoolean('no')).toEqual(false);
    });
    test('empty string is false', () => {
      expect(toBoolean('')).toEqual(false);
    });
  });
});

describe('parseArray', () => {
  test('empty string is empty array', () => {
    expect(parseArray('')).toEqual([]);
  });
  test('string of only spaces is empty array', () => {
    expect(parseArray('  ')).toEqual([]);
  });
  test('Command is trimmed and split', () => {
    expect(parseArray('run my command  ')).toEqual(['run', 'my', 'command']);
  });
  test('Successive spaces are collapsed', () => {
    expect(parseArray('run my   command  ')).toEqual(['run', 'my', 'command']);
  });
});

describe('create project name', () => {
  describe('missing environment variables', () => {
    test('GITHUB_REPOSITORY', () => {
      process.env['GITHUB_JOB'] = 'test-job';
      process.env['GITHUB_RUN_ID'] = '5';
      delete process.env['GITHUB_REPOSITORY'];
      expect(createProjectName).toThrowError(/Unexpectedly missing/);
    });

    test('GITHUB_JOB', () => {
      process.env['GITHUB_REPOSITORY'] = 'smartlyio/docker-compose-action';
      process.env['GITHUB_RUN_ID'] = '5';
      delete process.env['GITHUB_JOB'];
      expect(createProjectName).toThrowError(/Unexpectedly missing/);
    });

    test('GITHUB_RUN_ID', () => {
      process.env['GITHUB_REPOSITORY'] = 'smartlyio/docker-compose-action';
      process.env['GITHUB_JOB'] = 'test-job';
      delete process.env['GITHUB_RUN_ID'];
      expect(createProjectName).toThrowError(/Unexpectedly missing/);
    });
  });

  test('creates a unique project name', () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const job = 'test-job';
    const runId = 5;
    const uuid = 'bf9cd2a1-b794-45b8-8b27-da13aef90617';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = job;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${job}-${runId}-${uuid}`;
    expect(createProjectName()).toEqual(projectName);

    const callArgs = new RegExp(`${projectName}`);
    expect(mocked(info).mock.calls.length).toEqual(1);
    expect(mocked(info).mock.calls[0][0]).toMatch(callArgs);
  });
});

describe('parse push option', () => {
  describe('disabledbuild option overrides push', () => {
    test('on:push', () => {
      process.env['GITHUB_EVENT_NAME'] = 'push';
      const build = false;
      const pushOption = 'on:push';
      expect(parsePushOption(pushOption, build)).toEqual(false);
    });
    test('push is true', () => {
      process.env['GITHUB_EVENT_NAME'] = 'push';
      const build = false;
      const pushOption = 'true';
      expect(parsePushOption(pushOption, build)).toEqual(false);
    });
    test('push is false', () => {
      process.env['GITHUB_EVENT_NAME'] = 'push';
      const build = false;
      const pushOption = 'false';
      expect(parsePushOption(pushOption, build)).toEqual(false);
    });
  });

  describe('when build is enabled', () => {
    test('on:push', () => {
      process.env['GITHUB_EVENT_NAME'] = 'push';
      const build = true;
      const pushOption = 'on:push';
      expect(parsePushOption(pushOption, build)).toEqual(true);
    });
    test('other github event', () => {
      process.env['GITHUB_EVENT_NAME'] = 'pull_request';
      const build = true;
      const pushOption = 'on:push';
      expect(parsePushOption(pushOption, build)).toEqual(false);
    });
    test('push is true', () => {
      const build = true;
      const pushOption = 'true';
      expect(parsePushOption(pushOption, build)).toEqual(true);
    });
    test('push is false', () => {
      const build = true;
      const pushOption = 'false';
      expect(parsePushOption(pushOption, build)).toEqual(false);
    });
  });
});

describe('get input context', () => {
  test('test inputs and save/load state for post process', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const job = 'test-job';
    const runId = 5;
    const uuid = '9a122256-a422-47ab-b983-3bbcb06f418e';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = job;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${job}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: '--abort-on-container-exit',
      runCommand: '',
      build: 'false',
      push: 'on:push'
    };
    const savedState: Record<string, string> = {};
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });
    mocked(saveState).mockImplementation((name, value) => {
      if (typeof value === 'string') {
        savedState[name] = value;
      } else {
        savedState[name] = JSON.stringify(value);
      }
    });
    mocked(getState).mockImplementation(name => {
      return savedState[name];
    });

    const expectedContext: Context = {
      composeFiles: ['docker-compose.ci.yml'],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: false,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      isPost: false,
      projectName
    };

    const mainContext: Context = await getContext();
    expect(mainContext).toEqual(expectedContext);
    const postContext: Context = await loadState();
    expect(postContext).toEqual(expectedContext);
  });

  test('test inputs unexpected composeCommand', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const runId = 5;
    const uuid = 'e59e1dc3-3bca-4f84-8fc5-9ec3567e2316';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = 'test-job';
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'down',
      composeArguments: '--abort-on-container-exit',
      runCommand: '',
      build: 'false',
      push: 'on:push'
    };
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });

    await expect(getContext()).rejects.toThrowError(/composeCommand not in/);
  });

  test('test empty serviceName', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const job = 'test-job';
    const runId = 5;
    const uuid = '5cbc67f0-1b89-4402-90a1-6c40d19bd745';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = job;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${job}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: '',
      composeCommand: 'up',
      composeArguments: '--abort-on-container-exit',
      runCommand: '',
      build: 'false',
      push: 'on:push'
    };
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });

    const expected: Context = {
      composeFiles: [inputs.composeFile],
      serviceName: null,
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: false,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      projectName: projectName,
      isPost: false
    };
    expect(await getContext()).toEqual(expected);
  });

  test('test empty serviceName with composeCommand=run', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const runId = 5;
    const uuid = '3f59789f-ba47-4b55-8ac4-deef7090f806';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = 'test-job';
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: '',
      composeCommand: 'run',
      composeArguments: '--rm',
      runCommand: '',
      build: 'false',
      push: 'on:push'
    };
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });

    await expect(getContext()).rejects.toThrowError(
      'serviceName must be provided when composeCommand is "run"'
    );
  });

  test('test default composeArguments with compose run', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const job = 'test-job';
    const runId = 5;
    const uuid = '8f88c92b-72b5-4745-b81a-7a8f57a0c487';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = job;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${job}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'run',
      composeArguments: '--abort-on-container-exit',
      runCommand: '',
      build: 'false',
      push: 'on:push'
    };
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });

    const expected: Context = {
      composeFiles: [inputs.composeFile],
      serviceName: 'test',
      composeCommand: 'run',
      composeArguments: [],
      runCommand: [],
      build: false,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      projectName: projectName,
      isPost: false
    };
    expect(await getContext()).toEqual(expected);
  });
});

describe('parse docker build args', () => {
  test('test empty build args', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const job = 'test-job';
    const runId = 5;
    const uuid = '5cbc67f0-1b89-4402-90a1-6c40d19bd745';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = job;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${job}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: '--abort-on-container-exit',
      runCommand: '',
      build: 'false',
      'build-args': '',
      push: 'on:push'
    };
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });

    const expected: Context = {
      composeFiles: [inputs.composeFile],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: false,
      buildArgs: [],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      projectName: projectName,
      isPost: false
    };
    expect(await getContext()).toEqual(expected);
  });

  test('test single build arg', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const job = 'test-job';
    const runId = 5;
    const uuid = '5cbc67f0-1b89-4402-90a1-6c40d19bd745';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = job;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${job}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: '--abort-on-container-exit',
      runCommand: '',
      build: 'false',
      'build-args': 'ARG_NAME=some-value=more-stuff',
      push: 'on:push'
    };
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });

    const expected: Context = {
      composeFiles: [inputs.composeFile],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: false,
      buildArgs: ['--build-arg', 'ARG_NAME=some-value=more-stuff'],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      projectName: projectName,
      isPost: false
    };
    expect(await getContext()).toEqual(expected);
  });
  test('test multiple build args', async () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const job = 'test-job';
    const runId = 5;
    const uuid = '5cbc67f0-1b89-4402-90a1-6c40d19bd745';
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_JOB'] = job;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    mocked(uuidv4).mockReturnValue(uuid);
    const projectName = `${org}-${repo}-${job}-${runId}-${uuid}`;

    const inputs: Record<string, string> = {
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: '--abort-on-container-exit',
      runCommand: '',
      build: 'false',
      'build-args': 'ARG_NAME=some-value=more-stuff\nANOTHER_ARG=value',
      push: 'on:push'
    };
    mocked(getInput).mockImplementation(name => {
      return inputs[name];
    });
    mocked(getMultilineInput).mockImplementation(name => {
      return inputs[name].split('\n');
    });

    const expected: Context = {
      composeFiles: [inputs.composeFile],
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: false,
      buildArgs: [
        '--build-arg',
        'ARG_NAME=some-value=more-stuff',
        '--build-arg',
        'ANOTHER_ARG=value'
      ],
      push: false,
      postCommand: ['down --remove-orphans --volumes', 'rm -f'],
      projectName: projectName,
      isPost: false
    };
    expect(await getContext()).toEqual(expected);
  });
});
