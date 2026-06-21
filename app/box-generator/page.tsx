import { BoxGeneratorWorkspace } from "@/components/box-generator/box-generator-workspace";
export const dynamic = "force-dynamic";

export default function BoxGeneratorPage() {
  return (
    <div className="space-y-6">
      <BoxGeneratorWorkspace />
    </div>
  );
}
