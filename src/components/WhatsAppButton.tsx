import { MessageCircle } from "lucide-react";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";

const WhatsAppButton = () => {
  const { data: settings } = usePublicSystemSettings();
  const phoneNumber = ((settings?.contact_phone as string) || "919466317100").replace(/\D/g, "");
  const message = encodeURIComponent("Hi! I'm interested in your courses. Please share more details.");

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all hover:scale-110"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-7 h-7" />
    </a>
  );
};

export default WhatsAppButton;
