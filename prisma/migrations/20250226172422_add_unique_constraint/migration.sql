/*
  Warnings:

  - A unique constraint covering the columns `[referrer_id,referred_user_id]` on the table `Referrals` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Referrals_referrer_id_referred_user_id_key" ON "Referrals"("referrer_id", "referred_user_id");
