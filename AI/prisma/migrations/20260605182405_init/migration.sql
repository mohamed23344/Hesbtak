-- CreateTable
CREATE TABLE "workflow_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_sessions_pkey" PRIMARY KEY ("id")
);
