import { Tag } from '@/components/atoms/Tag';

/** "En retard" badge for overdue tasks (Spec 1C AC-25). */
export function OverdueChip() {
  return <Tag tone="danger">En retard</Tag>;
}

/** "À échéance" badge for due reminders (Spec 1C AC-27). */
export function DueChip() {
  return <Tag tone="warning">À échéance</Tag>;
}
