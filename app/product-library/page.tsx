"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Package,
  Image as ImageIcon,
  ArrowRight,
  Loader2,
  Plus,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageCount: number;
  knowledgeCount: number;
  status: string;
  createdAt: string;
}

export default function ProductLibraryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const response = await fetch("/api/product-library");
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || data || []);
      }
    } catch (error) {
      console.error("加载产品库失败:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("请输入产品名称");
      return;
    }
    setCreating(true);
    try {
      const response = await fetch("/api/product-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message || "创建失败");
      }
      toast.success("产品已创建");
      setDialogOpen(false);
      setNewName("");
      setNewDescription("");
      router.push(`/product-library/${payload.data.slug}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">产品知识库</h1>
          <p className="text-muted-foreground">
            录入产品信息，AI 自动识别并构建可检索的产品知识库
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              添加产品
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加产品</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>产品名称 *</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如：红烧牛肉面、螺蛳粉"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label>产品描述</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="简要描述产品特征"
                />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                创建产品
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有产品</h3>
            <p className="text-muted-foreground mb-6">点击上方"添加产品"按钮，创建第一个产品条目</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              添加产品
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/product-library/${product.slug}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="text-4xl">📦</div>
                    <Badge variant={product.knowledgeCount > 0 ? "default" : "outline"}>
                      {product.knowledgeCount > 0 ? `${product.knowledgeCount} 条知识` : "待录入"}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{product.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {product.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      <span>{product.imageCount} 张图片</span>
                    </div>
                    {product.knowledgeCount > 0 && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        <span>{product.knowledgeCount} 条知识</span>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" className="w-full mt-4 justify-between">
                    进入产品
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
