ALTER TABLE `bills`
  ADD COLUMN `is_posted` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否入账' AFTER `is_shared`;

CREATE INDEX `idx_bills_family_posted` ON `bills` (`family_id`, `is_posted`);
CREATE INDEX `idx_bills_user_posted` ON `bills` (`user_id`, `is_posted`);
