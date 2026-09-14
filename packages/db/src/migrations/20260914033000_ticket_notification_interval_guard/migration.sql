CREATE TRIGGER `tickets_notification_interval_insert_check`
BEFORE INSERT ON `tickets`
WHEN NEW.`notification_interval_minutes` NOT IN (5, 10, 15)
BEGIN
  SELECT RAISE(ABORT, 'tickets_notification_interval_check');
END;
--> statement-breakpoint
CREATE TRIGGER `tickets_notification_interval_update_check`
BEFORE UPDATE OF `notification_interval_minutes` ON `tickets`
WHEN NEW.`notification_interval_minutes` NOT IN (5, 10, 15)
BEGIN
  SELECT RAISE(ABORT, 'tickets_notification_interval_check');
END;
