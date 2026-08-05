"use client";

import type { LucideIcon } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";

export default function StubPage({
  title,
  subtitle,
  icon,
  emptyTitle,
  emptyText,
  action,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyText: string;
  action?: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <Card>
          <EmptyState
            icon={icon}
            title={emptyTitle}
            text={emptyText}
            action={action}
          />
        </Card>
      </div>
    </>
  );
}
