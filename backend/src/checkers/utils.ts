export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function spawn(
  cmd: string[],
  timeoutMs = 10000
): Promise<SpawnResult> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => {
      proc.kill();
      reject(new Error("timeout"));
    }, timeoutMs)
  );

  try {
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]),
      timeout,
    ]);
    return { stdout, stderr, exitCode };
  } catch (err) {
    if ((err as Error).message === "timeout") {
      return { stdout: "", stderr: "timeout", exitCode: -1 };
    }
    throw err;
  }
}

export function now(): number {
  return Date.now();
}
