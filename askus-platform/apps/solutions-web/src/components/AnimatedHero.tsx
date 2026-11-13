import React, { useEffect, useRef } from 'react';

export default function AnimatedHero({ children }: { children?: React.ReactNode }) {
	const fieldRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const field = fieldRef.current;
		if (!field) return;

		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion) return;

		const isMobile = window.innerWidth < 600;
		const driftCount = isMobile ? 14 : 32;
		const sparkleCount = isMobile ? 10 : 24;
		const frag = document.createDocumentFragment();

		for (let i = 0; i < driftCount; i++) {
			const p = document.createElement('div');
			p.className = 'ah-particle ah-drift';
			const size = Math.random() * 3 + 1.5;
			p.style.width = `${size}px`;
			p.style.height = `${size}px`;
			p.style.left = `${Math.random() * 100}vw`;
			p.style.setProperty('--dx', `${Math.random() * 60 - 30}px`);
			const driftDur = (Math.random() * 14 + 12).toFixed(2);
			const twinkleDur = (Math.random() * 3 + 2).toFixed(2);
			p.style.animationDuration = `${driftDur}s, ${twinkleDur}s`;
			p.style.animationDelay = `${(Math.random() * 16).toFixed(2)}s, ${(Math.random() * 3).toFixed(2)}s`;
			frag.appendChild(p);
		}

		for (let i = 0; i < sparkleCount; i++) {
			const s = document.createElement('div');
			s.className = 'ah-particle ah-sparkle';
			const size = Math.random() * 2.4 + 1;
			s.style.width = `${size}px`;
			s.style.height = `${size}px`;
			s.style.left = `${Math.random() * 100}%`;
			s.style.top = `${Math.random() * 85}%`;
			const twinkleDur = (Math.random() * 2.5 + 1.5).toFixed(2);
			s.style.animationDuration = `${twinkleDur}s`;
			s.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
			frag.appendChild(s);
		}

		field.appendChild(frag);
		return () => {
			field.innerHTML = '';
		};
	}, []);

	return (
		<div className="ah-root">
			<style>{`
				.ah-root { position:absolute; inset:0; overflow:hidden; z-index:0; background:radial-gradient(circle at 50% 35%, #0d1526 0%, #060a14 70%); }

				.ah-overlay {
					position:absolute; inset:0; z-index:1;
					background:linear-gradient(180deg, rgba(2,4,10,.55) 0%, rgba(2,4,10,.15) 22%, rgba(2,4,10,.15) 60%, rgba(2,4,10,.75) 100%);
				}
				.ah-shimmer {
					position:absolute; inset:-20% -60%; z-index:1; pointer-events:none;
					background:linear-gradient(75deg, transparent 42%, rgba(180,235,255,.16) 50%, transparent 58%);
					animation:ah-sweep 9s ease-in-out infinite;
				}
				.ah-hubfx { position:absolute; top:42%; left:50%; width:0; height:0; z-index:2; }
				.ah-hubfx > * { position:absolute; top:0; left:0; border-radius:50%; }

				.ah-ring1 {
					width:40vmin; height:40vmin;
					background:conic-gradient(from 0deg, transparent 0deg, rgba(190,235,255,.55) 18deg, transparent 60deg, transparent 200deg, rgba(190,235,255,.35) 222deg, transparent 262deg, transparent 360deg);
					mix-blend-mode:screen; filter:blur(2px);
					animation:ah-spin1 9s linear infinite;
				}
				.ah-ring2 {
					width:28vmin; height:28vmin;
					background:conic-gradient(from 90deg, transparent 0deg, rgba(225,245,255,.5) 14deg, transparent 46deg, transparent 360deg);
					mix-blend-mode:screen; filter:blur(1.4px);
					animation:ah-spin2 7s linear infinite;
				}
				.ah-radar {
					transform:translate(-50%,-50%);
					border:1.5px solid rgba(150,225,255,.7);
					box-shadow:0 0 14px rgba(150,225,255,.45);
					opacity:0;
					animation:ah-radar-ping 3.6s ease-out infinite;
				}
				.ah-radar.p2 { animation-delay:1.2s; }
				.ah-radar.p3 { animation-delay:2.4s; }

				.ah-particles { position:absolute; inset:0; z-index:1; pointer-events:none; }
				.ah-particle { position:absolute; border-radius:50%; background:#8fe3ff; box-shadow:0 0 8px 2px rgba(143,227,255,.8); }
				.ah-drift { bottom:-10px; animation-name:ah-drift, ah-twinkle; animation-timing-function:linear, ease-in-out; animation-iteration-count:infinite, infinite; }
				.ah-sparkle { animation-name:ah-twinkle; animation-timing-function:ease-in-out; animation-iteration-count:infinite; }

				@keyframes ah-sweep { 0%,100%{ transform:translateX(-30%); } 50%{ transform:translateX(30%); } }
				@keyframes ah-spin1 { from{ transform:translate(-50%,-50%) rotate(0deg); } to{ transform:translate(-50%,-50%) rotate(360deg); } }
				@keyframes ah-spin2 { from{ transform:translate(-50%,-50%) rotate(360deg); } to{ transform:translate(-50%,-50%) rotate(0deg); } }
				@keyframes ah-radar-ping { 0%{ width:14vmin; height:14vmin; opacity:.65; } 100%{ width:48vmin; height:48vmin; opacity:0; } }
				@keyframes ah-drift { 0%{ transform:translateY(0) translateX(0); } 100%{ transform:translateY(-110vh) translateX(var(--dx, 20px)); } }
				@keyframes ah-twinkle { 0%,100%{ opacity:.15; } 50%{ opacity:.9; } }

				@media (prefers-reduced-motion: reduce) {
					.ah-shimmer, .ah-ring1, .ah-ring2, .ah-radar, .ah-drift, .ah-sparkle { animation:none !important; }
					.ah-radar { opacity:0; }
				}
			`}</style>

			<div className="ah-shimmer" />
			<div className="ah-hubfx">
				<span className="ah-ring1" />
				<span className="ah-ring2" />
				<span className="ah-radar p1" />
				<span className="ah-radar p2" />
				<span className="ah-radar p3" />
			</div>
			<div className="ah-particles" ref={fieldRef} />
			<div className="ah-overlay" />
			<div style={{ position: 'relative', zIndex: 3, height: '100%' }}>{children}</div>
		</div>
	);
}
