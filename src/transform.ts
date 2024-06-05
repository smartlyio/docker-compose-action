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
  const yqPipeline = `.services = (.services | (to_entries | ${transforms.join(
    ' | '
  )} | from_entries))`;
  const command = ['--inplace', yqPipeline, composeFilePath];

  return await exec.exec('yq', command);
}

export async function transformDockerFiles(registry: string): Promise<number> {
  const transforms = DOCKERHUB_PREFIXES.map(
    image => ['-e', `s#^\\(FROM\\) \\(${image}\\)#\\1 ${registry}/\\2#`]
  ).flat();
  const commandArgs = [
    '.',
    '-type',
    'f',
    '-name',
    'Dockerfile*',
    '-exec',
    'sed',
    ...transforms,
    '-i',
    '{}',
    '+'
  ];
  return await exec.exec('find', commandArgs);
}
