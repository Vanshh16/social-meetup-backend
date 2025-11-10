-- CreateEnum
CREATE TYPE "public"."SuspensionAction" AS ENUM ('SUSPEND', 'UNSUSPEND');

-- CreateTable
CREATE TABLE "public"."SuspensionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "public"."SuspensionAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuspensionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuspensionLog_userId_idx" ON "public"."SuspensionLog"("userId");

-- CreateIndex
CREATE INDEX "SuspensionLog_adminId_idx" ON "public"."SuspensionLog"("adminId");

-- AddForeignKey
ALTER TABLE "public"."SuspensionLog" ADD CONSTRAINT "SuspensionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SuspensionLog" ADD CONSTRAINT "SuspensionLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
