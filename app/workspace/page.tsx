import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";

export default function WorkspacePage() {
  return (
    <RequireAuth>
      <WorkspaceLayout />
    </RequireAuth>
  );
}
