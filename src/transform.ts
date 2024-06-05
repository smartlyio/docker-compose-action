import * as exec from '@actions/exec';

export const DOCKERHUB_PREFIXES = ['node:', 'redis:', 'postgres:', 'bitnami/'];

export function composeImageYqTransform(
  dockerhubImageExpression: string,
  registry: string
): string {
  return `[.[] | (select(.value.image | test("^${dockerhubImageExpression}"))) |= (. | .value.image = "${registry}/" + .value.image)]`;
}

export async function transformComposeFile(
  composeFilePath: string,
  registry: string
): Promise<number> {
  const transforms = DOCKERHUB_PREFIXES.map(image =>
    composeImageYqTransform(image, registry)
  );
  const yqPipeline = `with(.services; (to_entries | ${transforms.join(
    ' | '
  )} | from_entries))`;
  const command = ['--inplace', composeFilePath, yqPipeline];

  return await exec.exec('qa', command);
}

export async function transformDockerFiles(registry: string): Promise<number> {
  const transforms = DOCKERHUB_PREFIXES.map(
    image => `s/^\\(FROM\\) \\(${image}\\)/\\1 ${registry}\\/\\2/`
  );
  const commandArgs = [
    '.',
    '-type',
    'f',
    '-name',
    'Dockerfile*',
    '-exec',
    'sed',
    '-i',
    '-e',
    ...transforms,
    '{}',
    '+'
  ];
  return await exec.exec('find', commandArgs);
}
