import { runCoder } from "./coder";
import { runDeployer } from "./deployer";
import { runTester } from "./tester";
import { runTutor } from "./tutor";
import type { ArenaEvent, AgentRole } from "../types/arena";

function emitAgentLifecycle(
  onEvent: (event: ArenaEvent) => void,
  agent: AgentRole,
  type: "agent_start" | "agent_complete",
  content: string
) {
  onEvent({
    type,
    agent,
    content,
  });
}

export async function runArena(
  prompt: string,
  onEvent: (event: ArenaEvent) => void
): Promise<void> {
  emitAgentLifecycle(onEvent, "tutor", "agent_start", prompt);
  const tutorOutput = await runTutor(
    prompt,
    (token) =>
      onEvent({
        type: "agent_stream",
        agent: "tutor",
        content: token,
      }),
    onEvent
  );
  emitAgentLifecycle(onEvent, "tutor", "agent_complete", tutorOutput);

  emitAgentLifecycle(onEvent, "coder", "agent_start", tutorOutput);
  const coderOutput = await runCoder(
    tutorOutput,
    (token) =>
      onEvent({
        type: "agent_stream",
        agent: "coder",
        content: token,
      }),
    onEvent
  );
  emitAgentLifecycle(onEvent, "coder", "agent_complete", coderOutput);

  emitAgentLifecycle(onEvent, "tester", "agent_start", coderOutput);
  const testerOutput = await runTester(
    coderOutput,
    (token) =>
      onEvent({
        type: "agent_stream",
        agent: "tester",
        content: token,
      }),
    onEvent
  );
  emitAgentLifecycle(onEvent, "tester", "agent_complete", testerOutput);

  emitAgentLifecycle(onEvent, "deployer", "agent_start", testerOutput);
  const deployerOutput = await runDeployer(
    {
      prompt,
      testReport: testerOutput,
    },
    (token) =>
      onEvent({
        type: "agent_stream",
        agent: "deployer",
        content: token,
      }),
    onEvent
  );
  emitAgentLifecycle(onEvent, "deployer", "agent_complete", deployerOutput);
}
