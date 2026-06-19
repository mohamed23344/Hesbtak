import CreateInvoiceWithUpload from "@/components/CreateInvoiceWithUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: "sales" | "purchases" | "expenses";
  documentId?: string;
  onCreated: () => void | Promise<void>;
};

export default function CreateInvoiceDialog({
  open,
  onOpenChange,
  title,
  type,
  documentId,
  onCreated,
}: Props) {
  const { dir } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="localized-entry-form max-w-5xl max-h-[92vh] overflow-y-auto text-start">
        <DialogHeader>
          <DialogTitle>{documentId ? `Edit ${title}` : title}</DialogTitle>
        </DialogHeader>
        <CreateInvoiceWithUpload
          title={title}
          type={type}
          documentId={documentId}
          onDone={() => {
            onOpenChange(false);
            void onCreated();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
