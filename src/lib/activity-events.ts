import { prisma } from "@/lib/prisma";
import type { JsonValue } from "@/lib/domain-types";

type ActivityEventInput = {
  workspaceId: string;
  actorUserId: string;
  type: string;
  payloadJson?: JsonValue;
};

export async function logActivityEvent({
  workspaceId,
  actorUserId,
  type,
  payloadJson,
}: ActivityEventInput) {
  await prisma.activityEvent.create({
    data: {
      workspaceId,
      actorUserId,
      type,
      ...(payloadJson !== undefined && payloadJson !== null
        ? { payloadJson }
        : {}),
    },
  });
}
