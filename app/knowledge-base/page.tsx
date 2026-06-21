"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * 旧的品类知识库页面已改造为产品库。
 * 自动重定向到 /product-library
 */
export default function KnowledgeBaseRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/product-library");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">
          品类知识库已升级为产品库，正在跳转...
        </p>
      </div>
    </div>
  );
}
