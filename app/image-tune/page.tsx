import { ImageTuneWorkspace } from "@/components/image-tune/image-tune-workspace";

export const dynamic = "force-dynamic";

export default function ImageTunePage() {
  return (
    <div className="space-y-6">
      <ImageTuneWorkspace />
    </div>
  );
}
