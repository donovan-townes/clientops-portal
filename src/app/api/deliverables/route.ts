import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { logActivityEvent } from "@/lib/activity-events";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUploadFile, canViewTasksAndFiles } from "@/lib/rbac";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getActiveWorkspaceIdFromCookieHeader,
} from "@/lib/workspace-context";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".md",
  ".docx",
]);

const ALLOWED_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type ResolvedContext =
  | {
      ok: false;
      response: NextResponse<{ error: string }>;
    }
  | {
      ok: true;
      session: {
        user: {
          id: string;
        };
      };
      activeWorkspaceId: string;
      shouldPersistActiveWorkspace: boolean;
    };

function getContextErrorResponse() {
  return NextResponse.json(
    { error: "No active workspace. Create a workspace first." },
    { status: 400 },
  );
}

async function resolveContext(request: Request): Promise<ResolvedContext> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      ),
    };
  }

  const candidateWorkspaceId = getActiveWorkspaceIdFromCookieHeader(
    request.headers.get("cookie"),
  );

  const context = await resolveActiveWorkspaceForUser(
    session.user.id,
    candidateWorkspaceId,
  );

  if (!context.activeWorkspace) {
    return {
      ok: false,
      response: getContextErrorResponse(),
    };
  }

  return {
    ok: true,
    session,
    activeWorkspaceId: context.activeWorkspace.id,
    shouldPersistActiveWorkspace: context.shouldPersistActiveWorkspace,
  };
}

function getFileExtension(filename: string) {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return filename.slice(dotIndex).toLowerCase();
}

export async function GET(request: Request) {
  const resolved = await resolveContext(request);

  if (!resolved.ok) {
    return resolved.response;
  }

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: resolved.activeWorkspaceId,
        userId: resolved.session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canViewTasksAndFiles(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to view deliverables." },
      { status: 403 },
    );
  }

  const deliverables = await prisma.deliverable.findMany({
    where: {
      workspaceId: resolved.activeWorkspaceId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const response = NextResponse.json({
    deliverables,
    activeWorkspaceId: resolved.activeWorkspaceId,
  });

  if (resolved.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      resolved.activeWorkspaceId,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}

export async function POST(request: Request) {
  if (process.env.ENABLE_FILE_UPLOADS === "false") {
    return NextResponse.json(
      {
        error:
          "File uploads are disabled in this deployment. This feature is available in a self-hosted instance.",
      },
      { status: 503 },
    );
  }

  const resolved = await resolveContext(request);

  if (!resolved.ok) {
    return resolved.response;
  }

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: resolved.activeWorkspaceId,
        userId: resolved.session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canUploadFile(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to upload files." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const fileValue = formData.get("file");

  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const taskIdValue = formData.get("taskId");
  const taskId =
    typeof taskIdValue === "string" && taskIdValue.trim().length > 0
      ? taskIdValue.trim()
      : null;

  const filename = fileValue.name?.trim() || "upload.bin";
  const extension = getFileExtension(filename);
  const mimeType = fileValue.type?.trim().toLowerCase() ?? "";

  if (
    !ALLOWED_FILE_EXTENSIONS.has(extension) &&
    !ALLOWED_FILE_MIME_TYPES.has(mimeType)
  ) {
    return NextResponse.json(
      { error: "File type is not allowed" },
      { status: 400 },
    );
  }

  if (fileValue.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File size must be 5MB or less" },
      { status: 400 },
    );
  }

  const randomKey =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storageKey = `${resolved.activeWorkspaceId}/${randomKey}-${filename}`;

  const deliverable = await prisma.deliverable.create({
    data: {
      workspaceId: resolved.activeWorkspaceId,
      taskId,
      filename,
      storageKey,
      uploadedByUserId: resolved.session.user.id,
    },
  });

  await logActivityEvent({
    workspaceId: resolved.activeWorkspaceId,
    actorUserId: resolved.session.user.id,
    type: "FILE_UPLOADED",
    payloadJson: {
      deliverableId: deliverable.id,
      filename: deliverable.filename,
      taskId: deliverable.taskId,
    },
  });

  const response = NextResponse.json(
    {
      deliverable,
      activeWorkspaceId: resolved.activeWorkspaceId,
    },
    { status: 201 },
  );

  if (resolved.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      resolved.activeWorkspaceId,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}
