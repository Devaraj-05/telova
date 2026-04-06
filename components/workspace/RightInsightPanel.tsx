import type {
  AgentActivityItem,
  ConnectedToolItem,
  CurrentGoalSummary,
  QuickActionItem,
} from "@/lib/workspace/types";
import { AgentActivityFeedCard } from "@/components/workspace/AgentActivityFeedCard";
import { ConnectedToolsCard } from "@/components/workspace/ConnectedToolsCard";
import { CurrentGoalCard } from "@/components/workspace/CurrentGoalCard";
import { QuickActionsCard } from "@/components/workspace/QuickActionsCard";

interface RightInsightPanelProps {
  activity: AgentActivityItem[];
  tools: ConnectedToolItem[];
  currentGoal: CurrentGoalSummary;
  actions: QuickActionItem[];
  onQuickAction: (action: QuickActionItem["action"]) => void;
}

export function RightInsightPanel({
  activity,
  tools,
  currentGoal,
  actions,
  onQuickAction,
}: RightInsightPanelProps) {
  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto p-5">
      <AgentActivityFeedCard items={activity} />
      <ConnectedToolsCard items={tools} />
      <CurrentGoalCard goal={currentGoal} />
      <QuickActionsCard items={actions} onAction={onQuickAction} />
    </aside>
  );
}
