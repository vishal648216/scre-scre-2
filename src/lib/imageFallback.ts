import React from "react";

export function getCategoryFallbackImage(name?: string): string {
  const n = (name || "").toLowerCase().trim();
  if (n.includes("yoga")) return "/images/categories/yoga.svg";
  if (n.includes("vermi") || n.includes("compost") || n.includes("organic") || n.includes("agri")) {
    return "/images/categories/vermicompost.svg";
  }
  if (
    n.includes("computer") ||
    n.includes("dca") ||
    n.includes("adca") ||
    n.includes("it") ||
    n.includes("hardware") ||
    n.includes("network") ||
    n.includes("tally") ||
    n.includes("software") ||
    n.includes("web") ||
    n.includes("programming")
  ) {
    return "/images/categories/computer.svg";
  }
  if (n.includes("mehndi") || n.includes("henna") || n.includes("art")) {
    return "/images/categories/mehndi.svg";
  }
  if (n.includes("fashion") || n.includes("textile") || n.includes("dress") || n.includes("tailor") || n.includes("designing")) {
    return "/images/categories/fashion.svg";
  }
  if (n.includes("beautician") || n.includes("beauty") || n.includes("makeup") || n.includes("salon") || n.includes("cosmet")) {
    return "/images/categories/beautician.svg";
  }
  if (n.includes("intern") || n.includes("practical") || n.includes("training")) {
    return "/images/categories/internship.svg";
  }
  return "/images/categories/default.svg";
}

export function getHeroSlideFallbackImage(index: number = 0): string {
  const heroImages = [
    "/images/icc-1.jpg",
    "/images/icc-2.jpg",
    "/images/icc-3.jpg",
    "/images/background.jpeg",
  ];
  return heroImages[Math.abs(index) % heroImages.length];
}

export function getCourseFallbackImage(title?: string, index: number = 0): string {
  if (title) {
    const catFallback = getCategoryFallbackImage(title);
    if (catFallback !== "/images/categories/default.svg") {
      return catFallback;
    }
  }
  const courseImages = [
    "/images/icc-1.jpg",
    "/images/icc-2.jpg",
    "/images/icc-3.jpg",
    "/images/categories/computer.svg",
    "/images/categories/default.svg",
  ];
  return courseImages[Math.abs(index) % courseImages.length];
}

export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackSrc: string
) {
  const target = e.currentTarget;
  if (!target.dataset.fallbackApplied) {
    target.dataset.fallbackApplied = "true";
    target.src = fallbackSrc;
  }
}
