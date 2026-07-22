import { useEffect, useRef } from "react";

// Interaction concept adapted from gokuscraper/Eyes-Follow-Mouse-Login-Website
// (Apache-2.0). Reimplemented as a React/CSS component for this dashboard.

export function LoginMascots({
  mode,
}: {
  mode: "idle" | "typing" | "secret";
}) {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = (event: PointerEvent) => {
      const scene = sceneRef.current;
      if (!scene || mode === "secret") return;
      for (const character of scene.querySelectorAll<HTMLElement>("[data-character]")) {
        const rect = character.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 3;
        const deltaX = event.clientX - centerX;
        const deltaY = event.clientY - centerY;
        const distance = Math.min(Math.hypot(deltaX, deltaY), 5);
        const angle = Math.atan2(deltaY, deltaX);
        character.style.setProperty("--pupil-x", `${Math.cos(angle) * distance}px`);
        character.style.setProperty("--pupil-y", `${Math.sin(angle) * distance}px`);
        character.style.setProperty("--face-x", `${clamp(deltaX / 20, -15, 15)}px`);
        character.style.setProperty("--face-y", `${clamp(deltaY / 30, -10, 10)}px`);
        character.style.setProperty("--body-skew", `${clamp(-deltaX / 120, -6, 6)}deg`);
      }
    };
    window.addEventListener("pointermove", update, { passive: true });
    return () => window.removeEventListener("pointermove", update);
  }, [mode]);

  return (
    <section className="connection-visual" aria-label="交互式监控插画">
      <div className="visual-grid" aria-hidden="true" />
      <div className="visual-glow visual-glow-one" aria-hidden="true" />
      <div className="visual-glow visual-glow-two" aria-hidden="true" />
      <div className="visual-brand">
        <span className="brand-signal" aria-hidden="true"><span /></span>
        <div><strong>Pulse</strong><small>Observability</small></div>
      </div>
      <div className="visual-copy">
        <p>FRONTEND INTELLIGENCE</p>
        <h2>每一次异常，<br />都有人盯着。</h2>
        <span>从真实用户体验到源码错误，把浏览器里的细微信号变成可行动的证据。</span>
      </div>
      <div ref={sceneRef} className={`mascot-scene is-${mode}`} aria-hidden="true">
        <Mascot className="mascot-purple" eyes="white" />
        <Mascot className="mascot-black" eyes="white" />
        <Mascot className="mascot-orange" eyes="dot" />
        <Mascot className="mascot-yellow" eyes="dot" mouth />
      </div>
    </section>
  );
}

function Mascot({
  className,
  eyes,
  mouth = false,
}: {
  className: string;
  eyes: "white" | "dot";
  mouth?: boolean;
}) {
  return (
    <div className={`mascot ${className}`} data-character>
      <div className={`mascot-eyes ${eyes === "white" ? "with-whites" : "dot-eyes"}`}>
        <span className="mascot-eye"><i /></span>
        <span className="mascot-eye"><i /></span>
      </div>
      {mouth ? <span className="mascot-mouth" /> : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
