/**
 * Load Razorpay checkout.js once; use only on pages that open a payment.
 * Browser console may show "Unrecognized feature: web-share" from Razorpay’s script — harmless.
 */
let loadPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve(true);
  }
  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }
  return loadPromise;
}
