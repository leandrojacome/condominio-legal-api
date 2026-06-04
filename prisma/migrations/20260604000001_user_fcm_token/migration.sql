-- Add fcmToken to User for push notification delivery (ARD §3.6)
ALTER TABLE "User" ADD COLUMN "fcmToken" TEXT;
