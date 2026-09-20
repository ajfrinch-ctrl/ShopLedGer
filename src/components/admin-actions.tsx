import { Pencil, Trash2 } from "lucide-react";

export function AdminActions({
  onEdit,
  onDelete,
  deleteLabel = "ডিলিট",
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  if (!onEdit && !onDelete) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label="সম্পাদনা"
          className="rounded-md p-2 text-primary hover:bg-mint-2"
        >
          <Pencil size={16} />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="rounded-md p-2 text-danger hover:bg-danger/10"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
    </div>
  );
}
