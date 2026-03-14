import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ActivityEventInput = {
  workspaceId: string;
  actorUserId: string;
  type: string;
  payloadJson?: Prisma.InputJsonValue;
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
      payloadJson,
    },
  });
}
