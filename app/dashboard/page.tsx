import { WorkspacePlaceholderPage } from "@/components/workspace/WorkspacePlaceholderPage";

export default function DashboardPage() {
  return (
    <WorkspacePlaceholderPage
      activeItem="dashboard"
      title="Dashboard is connected"
      description="The new workspace flow can open the dashboard after goal setup. This route is ready for the next UI pass while the Agent Workspace remains the primary surface."
    />
  );
}
