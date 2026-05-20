-- CreateIndex
CREATE INDEX "system_logs_createdAt_idx" ON "system_logs"("createdAt");

-- CreateIndex
CREATE INDEX "system_logs_userId_idx" ON "system_logs"("userId");

-- CreateIndex
CREATE INDEX "system_logs_action_idx" ON "system_logs"("action");
