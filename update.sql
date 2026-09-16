ALTER TABLE `bills`
  ADD COLUMN `is_posted` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否入账' AFTER `is_shared`;

CREATE INDEX `idx_bills_family_posted` ON `bills` (`family_id`, `is_posted`);
CREATE INDEX `idx_bills_user_posted` ON `bills` (`user_id`, `is_posted`);

ALTER TABLE `cook_menu_images`
  MODIFY COLUMN `image_url` LONGTEXT NOT NULL;

ALTER TABLE `cook_bills`
  ADD COLUMN `cooked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `menu_id`;

CREATE INDEX `idx_cook_bills_family_cooked_at`
  ON `cook_bills` (`family_id`, `cooked_at`);
