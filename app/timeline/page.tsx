import { WorkspacePlaceholderPage } from "@/components/workspace/WorkspacePlaceholderPage";

export default function TimelinePage() {
  return (
    <WorkspacePlaceholderPage
      activeItem="timeline"
      title="Timeline view is reserved"
      description="The timeline route is in place so the workspace can deep-link into scheduled work after proposal confirmation."
    />
  );
}
