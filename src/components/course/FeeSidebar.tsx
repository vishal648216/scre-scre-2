import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee } from "lucide-react";

type Props = {
  courseFee: string;
  admissionFee?: string;
  examFee?: string;
  shareUrl?: string;
};

const FeeSidebar = ({ courseFee, admissionFee = "₹300", examFee = "₹500", shareUrl = "" }: Props) => {
  return (
    <Card className="border-border rounded-xl shadow-sm lg:sticky lg:top-20">
      <CardHeader className="pb-3 bg-[#F47C20]/10">
        <CardTitle className="text-base font-black tracking-tight text-[#0B2C48]">Fee Structure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Course Fee</span>
          <span className="inline-flex items-center gap-1 font-heading font-bold text-primary">
            <IndianRupee className="w-4 h-4" />
            {courseFee}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Admission Fee</span>
          <span className="font-heading font-bold">{admissionFee}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Exam Fee</span>
          <span className="font-heading font-bold">{examFee}</span>
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Total Amount</span>
            <span className="font-heading font-extrabold text-foreground">{courseFee}</span>
          </div>
          <div className="mt-1 text-[11px] text-[#16A34A] font-semibold">EMI Options Available</div>
        </div>

        <div className="space-y-2">
          <a href="/admission" className="block w-full rounded-full bg-[#0B2C48] text-white text-sm font-heading font-bold py-2.5 text-center transition-all hover:opacity-90">
            Apply Now
          </a>
          <a href="/#contact" className="block w-full rounded-full border border-[#0B2C48] text-[#0B2C48] text-sm font-heading font-bold py-2.5 text-center transition-all hover:bg-[#0B2C48]/5">
            Enquire Now
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Course details: ${shareUrl}`)}`}
            target="_blank"
            rel="noopener"
            className="block w-full rounded-full bg-[#16A34A] text-white text-sm font-heading font-bold py-2.5 text-center transition-all hover:opacity-90"
          >
            Share on WhatsApp
          </a>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeeSidebar;
