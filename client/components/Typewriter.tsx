import { useEffect, useState } from "react";

export default function Typewriter({
  words = ["NPC"],
  loop = true,
  typingSpeed = 180,
  deletingSpeed = 90,
  pause = 1600,
  className = "",
}: {
  words?: string[];
  loop?: boolean;
  typingSpeed?: number;
  deletingSpeed?: number;
  pause?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const blinkId = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(blinkId);
  }, []);

  useEffect(() => {
    if (!words.length) return;
    if (index >= words.length) {
      if (loop) setIndex(0);
      else return;
    }

    const current = words[index];

    if (!deleting && subIndex === current.length) {
      const t = setTimeout(() => setDeleting(true), pause);
      return () => clearTimeout(t);
    }

    if (deleting && subIndex === 0) {
      setDeleting(false);
      setIndex((i) => (i + 1) % words.length);
      return;
    }

    const timeout = setTimeout(
      () => {
        setSubIndex((s) => s + (deleting ? -1 : 1));
      },
      deleting ? deletingSpeed : typingSpeed,
    );

    return () => clearTimeout(timeout);
  }, [
    subIndex,
    index,
    deleting,
    words,
    typingSpeed,
    deletingSpeed,
    pause,
    loop,
  ]);

  const text = words[index]?.slice(0, subIndex) ?? "";

  return (
    <span className={className} aria-hidden>
      {text}
      <span
        className="inline-block w-[8px] ml-1 align-middle"
        style={{ opacity: blink ? 1 : 0 }}
      >
        |
      </span>
    </span>
  );
}
