"use client";

const CHECKMARK_PATH = "M26 49L42 65L75 32";
const ORDER_ANIMATION_MS = 3600;
const ORDER_FLASH_MS = 720;
const ORDER_RIPPLE_MS = 1120;
const ORDER_CONFETTI_MS = 1800;

const ORDER_CONFETTI = [
  { shape: "dot", color: "#ffffff", angle: "-160deg", distance: "84px", rise: "44px", delay: "40ms", size: "6px", spin: "0deg" },
  { shape: "bar", color: "#ffd36b", angle: "-136deg", distance: "98px", rise: "52px", delay: "80ms", width: "5px", height: "14px", spin: "18deg" },
  { shape: "dot", color: "#7be6a7", angle: "-116deg", distance: "92px", rise: "38px", delay: "100ms", size: "5px", spin: "-10deg" },
  { shape: "bar", color: "#ffffff", angle: "-150deg", distance: "76px", rise: "40px", delay: "55ms", width: "5px", height: "12px", spin: "10deg" },
  { shape: "bar", color: "#ffffff", angle: "-94deg", distance: "106px", rise: "58px", delay: "60ms", width: "6px", height: "12px", spin: "8deg" },
  { shape: "dot", color: "#f59fb4", angle: "-74deg", distance: "100px", rise: "34px", delay: "140ms", size: "5px", spin: "-18deg" },
  { shape: "bar", color: "#8ed4ff", angle: "-52deg", distance: "90px", rise: "46px", delay: "120ms", width: "5px", height: "13px", spin: "14deg" },
  { shape: "dot", color: "#7be6a7", angle: "-36deg", distance: "82px", rise: "36px", delay: "150ms", size: "5px", spin: "-14deg" },
  { shape: "dot", color: "#fff2a8", angle: "-28deg", distance: "96px", rise: "40px", delay: "160ms", size: "5px", spin: "-12deg" },
  { shape: "bar", color: "#ffffff", angle: "-8deg", distance: "110px", rise: "56px", delay: "90ms", width: "5px", height: "15px", spin: "22deg" },
  { shape: "dot", color: "#7be6a7", angle: "18deg", distance: "92px", rise: "36px", delay: "130ms", size: "6px", spin: "-16deg" },
  { shape: "bar", color: "#ffd36b", angle: "38deg", distance: "104px", rise: "48px", delay: "170ms", width: "6px", height: "12px", spin: "12deg" },
  { shape: "dot", color: "#ffffff", angle: "0deg", distance: "86px", rise: "34px", delay: "75ms", size: "5px", spin: "8deg" },
  { shape: "dot", color: "#ffffff", angle: "62deg", distance: "88px", rise: "30px", delay: "110ms", size: "5px", spin: "10deg" },
  { shape: "bar", color: "#f59fb4", angle: "86deg", distance: "96px", rise: "42px", delay: "190ms", width: "5px", height: "14px", spin: "-14deg" },
  { shape: "dot", color: "#8ed4ff", angle: "112deg", distance: "100px", rise: "34px", delay: "150ms", size: "5px", spin: "16deg" },
  { shape: "bar", color: "#ffffff", angle: "136deg", distance: "90px", rise: "48px", delay: "70ms", width: "6px", height: "12px", spin: "-20deg" },
  { shape: "dot", color: "#f59fb4", angle: "44deg", distance: "84px", rise: "32px", delay: "165ms", size: "5px", spin: "-10deg" },
  { shape: "dot", color: "#fff2a8", angle: "156deg", distance: "86px", rise: "38px", delay: "180ms", size: "5px", spin: "8deg" }
];

const OrderPlacedGlow = ({
  fullscreen = false,
  showCopy = true,
  title = "Order placed",
  subtitle = "Your order is confirmed and is moving to the next step.",
  className = ""
}) => {
  const rootClasses = fullscreen
    ? "fixed inset-0 z-50 flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f6f2ea_100%)] px-6"
    : "relative flex flex-col items-center justify-center px-6 py-8 text-center";

  const animationSize = fullscreen
    ? "h-56 w-56 sm:h-72 sm:w-72 md:h-80 md:w-80"
    : "h-40 w-40 sm:h-44 sm:w-44";

  const longAnimation = {
    animationDuration: `${ORDER_ANIMATION_MS}ms`,
    animationIterationCount: 1,
    animationFillMode: "forwards"
  };

  const flashAnimation = {
    animationDuration: `${ORDER_FLASH_MS}ms`,
    animationIterationCount: 1,
    animationFillMode: "forwards",
    animationDelay: "120ms"
  };

  const rippleAnimation = {
    animationDuration: `${ORDER_RIPPLE_MS}ms`,
    animationIterationCount: 1,
    animationFillMode: "forwards",
    animationDelay: "150ms"
  };

  const confettiAnimation = {
    animationDuration: `${ORDER_CONFETTI_MS}ms`,
    animationIterationCount: 1,
    animationFillMode: "forwards"
  };

  return (
    <section className={`${rootClasses} ${className}`}>
      <div className={`relative isolate ${animationSize}`} aria-hidden="true">
        <span
          className="absolute left-1/2 top-1/2 z-[4] h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.78)_24%,rgba(255,255,255,0.18)_60%,rgba(255,255,255,0)_78%)] blur-xl mix-blend-screen"
          style={{ ...flashAnimation, animationName: "orderFlash", animationTimingFunction: "ease-out" }}
        />
        <span
          className="absolute left-1/2 top-1/2 z-[4] h-[66%] w-[66%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 shadow-[0_0_0_14px_rgba(255,255,255,0.16)]"
          style={{ ...rippleAnimation, animationName: "orderRipple", animationTimingFunction: "cubic-bezier(0.2, 1, 0.3, 1)" }}
        />
        <span
          className="absolute inset-[-20%] rounded-full bg-[rgba(83,230,160,0.14)] blur-3xl"
          style={{ ...longAnimation, animationName: "orderHalo", animationTimingFunction: "ease-out" }}
        />
        <span
          className="absolute inset-[8%] rounded-full shadow-[0_0_0_14px_rgba(208,245,225,0.72)]"
          style={{ ...longAnimation, animationName: "orderRing", animationTimingFunction: "ease-out" }}
        />
        <span
          className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#54e3a4_0%,#35d78a_52%,#17b46c_100%)] shadow-[0_0_52px_rgba(34,197,124,0.44)]"
          style={{ ...longAnimation, animationName: "orderCore", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        <div className="absolute inset-0 z-[5]" aria-hidden="true">
          {ORDER_CONFETTI.map((item, index) => {
            const isBar = item.shape === "bar";
            return (
              <span
                key={`${item.shape}-${index}`}
                className="absolute left-1/2 top-1/2 block rounded-full"
                style={{
                  width: isBar ? item.width : item.size,
                  height: isBar ? item.height : item.size,
                  backgroundColor: item.color,
                  boxShadow: "0 0 12px rgba(255,255,255,0.24)",
                  willChange: "transform, opacity",
                  animationDelay: item.delay,
                  animationName: "orderConfetti",
                  animationTimingFunction: "cubic-bezier(0.18, 1, 0.32, 1)",
                  ...confettiAnimation,
                  ["--confetti-angle"]: item.angle,
                  ["--confetti-distance"]: item.distance,
                  ["--confetti-rise"]: item.rise,
                  ["--confetti-spin"]: item.spin
                }}
              />
            );
          })}
        </div>
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-[14%] z-10 h-[72%] w-[72%]"
          fill="none"
          aria-hidden="true"
        >
          <path
            d={CHECKMARK_PATH}
            pathLength="100"
            stroke="rgba(13,92,55,0.55)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset="100"
            vectorEffect="non-scaling-stroke"
            style={{ ...longAnimation, animationName: "orderCheckGlow", animationTimingFunction: "ease-out" }}
          />
          <path
            d={CHECKMARK_PATH}
            pathLength="100"
            stroke="white"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset="100"
            vectorEffect="non-scaling-stroke"
            style={{ ...longAnimation, animationName: "orderCheck", animationTimingFunction: "ease-out" }}
          />
        </svg>
      </div>

      {showCopy && (
        <div className="relative mt-6 max-w-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">Order placed</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--ink-900)] md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[var(--ink-500)] md:text-base">
            {subtitle}
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes orderCore {
          0% {
            transform: scale(0.16);
            opacity: 0;
          }
          14% {
            opacity: 1;
          }
          28% {
            transform: scale(1.03);
            opacity: 1;
          }
          56% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes orderRing {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          18% {
            opacity: 0.22;
          }
          34% {
            transform: scale(1);
            opacity: 0.96;
          }
          70% {
            transform: scale(1.18);
            opacity: 0.22;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        @keyframes orderHalo {
          0% {
            transform: scale(0.54);
            opacity: 0;
          }
          18% {
            opacity: 0.26;
          }
          38% {
            transform: scale(1);
            opacity: 0.52;
          }
          100% {
            transform: scale(1.16);
            opacity: 0;
          }
        }

        @keyframes orderFlash {
          0% {
            transform: translate(-50%, -50%) scale(0.18);
            opacity: 0;
          }
          14% {
            opacity: 0.96;
          }
          42% {
            transform: translate(-50%, -50%) scale(1.22);
            opacity: 0.58;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.9);
            opacity: 0;
          }
        }

        @keyframes orderRipple {
          0% {
            transform: translate(-50%, -50%) scale(0.28);
            opacity: 0;
          }
          18% {
            opacity: 0.88;
          }
          44% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.5;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.52);
            opacity: 0;
          }
        }

        @keyframes orderCheck {
          0% {
            stroke-dashoffset: 100;
            opacity: 0;
          }
          18% {
            opacity: 0;
          }
          34% {
            opacity: 1;
          }
          56% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes orderCheckGlow {
          0% {
            stroke-dashoffset: 100;
            opacity: 0;
            filter: blur(0px);
          }
          20% {
            opacity: 0;
          }
          35% {
            stroke-dashoffset: 100;
            opacity: 0.48;
            filter: blur(0px);
          }
          58% {
            stroke-dashoffset: 0;
            opacity: 0.82;
            filter: blur(0.5px);
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.42;
            filter: blur(0.5px);
          }
        }

        @keyframes orderConfetti {
          0% {
            transform: translate(-50%, -50%) rotate(var(--confetti-angle)) translateX(0) translateY(0) scale(0.2) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          38% {
            transform: translate(-50%, -50%) rotate(var(--confetti-angle)) translateX(calc(var(--confetti-distance) * 0.56)) translateY(calc(var(--confetti-rise) * -0.28)) scale(1.06) rotate(var(--confetti-spin));
            opacity: 1;
          }
          72% {
            transform: translate(-50%, -50%) rotate(var(--confetti-angle)) translateX(calc(var(--confetti-distance) * 1)) translateY(calc(var(--confetti-rise) * -0.78)) scale(0.98) rotate(var(--confetti-spin));
            opacity: 0.86;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--confetti-angle)) translateX(calc(var(--confetti-distance) * 1.14)) translateY(calc(var(--confetti-rise) * -1.16)) scale(0.82) rotate(var(--confetti-spin));
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
};

export default OrderPlacedGlow;
