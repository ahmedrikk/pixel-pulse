import { useEffect, useRef } from "react";

export function useScrollDepth(pageKey: string, onDepth: (depth: 50 | 90) => void) {
  const fired50 = useRef(false);
  const fired90 = useRef(false);

  useEffect(() => {
    fired50.current = false;
    fired90.current = false;

    const sentinel50 = document.createElement("div");
    const sentinel90 = document.createElement("div");
    sentinel50.style.cssText = "position:absolute;top:50%;height:1px;width:1px;pointer-events:none";
    sentinel90.style.cssText = "position:absolute;top:90%;height:1px;width:1px;pointer-events:none";
    document.body.appendChild(sentinel50);
    document.body.appendChild(sentinel90);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === sentinel50 && !fired50.current) {
            fired50.current = true;
            onDepth(50);
          }
          if (entry.target === sentinel90 && !fired90.current) {
            fired90.current = true;
            onDepth(90);
          }
        }
      },
      { threshold: 0 }
    );

    observer.observe(sentinel50);
    observer.observe(sentinel90);

    return () => {
      observer.disconnect();
      sentinel50.remove();
      sentinel90.remove();
    };
  }, [pageKey]);
}
