import CreateInvoiceWithUpload from "@/components/CreateInvoiceWithUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: "sales" | "purchases" | "expenses";
  onCreated: () => void | Promise<void>;
};

export default function CreateInvoiceDialog({
  open,
  onOpenChange,
  title,
  type,
  onCreated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <CreateInvoiceWithUpload
          title={title}
          type={type}
          onDone={() => {
            onOpenChange(false);
            void onCreated();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
