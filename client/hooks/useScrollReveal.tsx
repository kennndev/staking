import { useEffect } from "react";

export default function useScrollReveal(opts?: {
  rootMargin?: string;
  threshold?: number | number[];
}) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal--visible");
            // once visible, unobserve for performance
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: opts?.rootMargin ?? "0px 0px -10% 0px",
        threshold: opts?.threshold ?? 0.1,
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [opts?.rootMargin, opts?.threshold]);
}
