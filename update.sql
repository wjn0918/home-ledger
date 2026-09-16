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


--- 为所有已有家庭补充“未分类”，并避免重复插入

INSERT INTO cook_categories (family_id, name, icon, created_at)
SELECT f.id, '未分类', '', now()
FROM families f
LEFT JOIN cook_categories c
  ON c.family_id = f.id
 AND c.name = '未分类'
WHERE c.id IS NULL;