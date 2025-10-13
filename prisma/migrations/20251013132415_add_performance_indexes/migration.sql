-- CreateIndex
CREATE INDEX "JoinRequest_meetupId_idx" ON "public"."JoinRequest"("meetupId");

-- CreateIndex
CREATE INDEX "JoinRequest_senderId_idx" ON "public"."JoinRequest"("senderId");

-- CreateIndex
CREATE INDEX "Meetup_createdBy_idx" ON "public"."Meetup"("createdBy");

-- CreateIndex
CREATE INDEX "Meetup_category_idx" ON "public"."Meetup"("category");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "public"."User"("referredById");
