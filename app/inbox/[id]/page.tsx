"use client";

import { useParams } from "next/navigation";
import { ConversationDetail } from "@/components/conversation-detail";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();

  return <ConversationDetail id={params.id} />;
}