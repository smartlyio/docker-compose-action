# Docker Compose Action

This action provides support for running docker compose with enforced cleanup after the job finished.

## Requirements

Requires `docker-compose` to be installed and available on the `PATH`.

## Environment variables

Uses the following github context environment variables to generate unique docker-compose project names:
- `GITHUB_REPOSITORY`
- `GITHUB_RUN_ID`
- `GITHUB_RUN_NUMBER`

## Inputs

| Name     | default  | required | description |
|----------|----------|----------|-------------|
| composeFile | `docker-compose.yml` | no | The path to the docker-compose file to use, realtive to the workspace. |
| serviceName | | yes | The name of the service to use defined in the compose file. |
| composeCommand | `up` | no | One of `up` or `run` as the main compose command to execute. |
| composeArguments | `--abort-on-container-exit` | no | Option flags passed to the compose command. |
| runCommand | | no | Command to run in the container when composeCommand is 'run'; ignored otherwise. |
| build | false | no | Explicitly build the service image before running. Implies pull before build. |
| push | on:push | no | When to push the built image to the registry. 'on:push' means when the trigger event it a push to the branch. Otherwise true/false.  Only runs if 'build' is true. |


## Example usage

```yaml
name: Test with compose

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test with docker-compose
        uses: smartlyio/docker-compose-action@v1
        with:
          composeFile: docker-compose.ci.yml
          serviceName: test
          build: true
          push: "on:push"
```

## Development

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

Run the tests :heavy_check_mark:  
```bash
$ npm test

 PASS  ./compose.test.js
  ✓ ...

...
```
