import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { ximoMallAgent } from "./agents/ximo-mall-agent";

export const mastra = new Mastra({
  agents: { ximoMallAgent },
  storage: new LibSQLStore({
    id: "agent-memory-store",
    url: "file:./storage/agent-memory.db",
  }),
});
