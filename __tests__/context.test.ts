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
import {mocked} from 'ts-jest/utils';
import {getInput, saveState, getState} from '@actions/core';

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn()
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
      process.env['GITHUB_RUN_ID'] = '5';
      process.env['GITHUB_RUN_NUMBER'] = '1';
      delete process.env['GITHUB_REPOSITORY'];
      expect(createProjectName).toThrowError(/Unexpectedly missing/);
    });

    test('GITHUB_RUN_ID', () => {
      process.env['GITHUB_REPOSITORY'] = 'smartlyio/docker-compose-action';
      process.env['GITHUB_RUN_NUMBER'] = '1';
      delete process.env['GITHUB_RUN_ID'];
      expect(createProjectName).toThrowError(/Unexpectedly missing/);
    });

    test('GITHUB_RUN_NUMBER', () => {
      process.env['GITHUB_REPOSITORY'] = 'smartlyio/docker-compose-action';
      process.env['GITHUB_RUN_ID'] = '5';
      delete process.env['GITHUB_RUN_NUMBER'];
      expect(createProjectName).toThrowError(/Unexpectedly missing/);
    });
  });

  test('creates a unique project name', () => {
    const org = 'smartlyio';
    const repo = 'docker-compose-action';
    const runId = 5;
    const runNumber = 1;
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    process.env['GITHUB_RUN_NUMBER'] = `${runNumber}`;
    expect(createProjectName()).toEqual(`${org}-${repo}-${runId}-${runNumber}`);
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
    const runId = 5;
    const runNumber = 1;
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    process.env['GITHUB_RUN_NUMBER'] = `${runNumber}`;
    const projectName = `${org}-${repo}-${runId}-${runNumber}`;

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
      composeFile: 'docker-compose.ci.yml',
      serviceName: 'test',
      composeCommand: 'up',
      composeArguments: ['--abort-on-container-exit'],
      runCommand: [],
      build: false,
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
    const runNumber = 1;
    process.env['GITHUB_REPOSITORY'] = `${org}/${repo}`;
    process.env['GITHUB_RUN_ID'] = `${runId}`;
    process.env['GITHUB_RUN_NUMBER'] = `${runNumber}`;
    const projectName = `${org}-${repo}-${runId}-${runNumber}`;

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

    await expect(getContext()).rejects.toThrowError(/composeCommand not in/);
  });
});
