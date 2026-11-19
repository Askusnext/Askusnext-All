import { useId } from 'react';
import '../styles/solution-visual.css';

export type SolutionKind = 'ai' | 'taxi' | 'insurance' | 'loans';

const descriptions: Record<SolutionKind, string> = {
	ai: '3D-style AI assistant with a floating conversation bubble',
	taxi: '3D-style city taxi with a live location pin',
	insurance: '3D-style protection shield and insurance policy',
	loans: '3D-style financial growth with coins and rising columns',
};

export default function SolutionVisual({ kind, className = '' }: { kind: SolutionKind; className?: string }) {
	const id = useId();
	const paint = (name: string) => `url(#${id}-${name})`;

	return (
		<svg className={`solution-visual ${className}`} viewBox="0 0 360 240" role="img" aria-labelledby={`${id}-title`} focusable="false">
			<title id={`${id}-title`}>{descriptions[kind]}</title>
			<defs>
				<linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1">
					<stop stopColor="#73a8ff" /><stop offset=".5" stopColor="#3874e8" /><stop offset="1" stopColor="#163d9a" />
				</linearGradient>
				<linearGradient id={`${id}-white`} x1="0" y1="0" x2=".8" y2="1">
					<stop stopColor="#fff" /><stop offset="1" stopColor="#d8e6ff" />
				</linearGradient>
				<linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
					<stop stopColor="#406797" /><stop offset="1" stopColor="#102d59" />
				</linearGradient>
				<linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
					<stop stopColor="#ffdc8a" /><stop offset="1" stopColor="#dda943" />
				</linearGradient>
				<radialGradient id={`${id}-shadow`}>
					<stop stopColor="#234e9e" stopOpacity=".22" /><stop offset="1" stopColor="#234e9e" stopOpacity="0" />
				</radialGradient>
			</defs>
			<ellipse cx="180" cy="205" rx="136" ry="25" fill={paint('shadow')} />
			<path d="M37 178 180 130 323 178 323 187 180 231 37 187Z" fill="#dbe7fd" />
			<path d="M37 178 180 134 323 178 180 222Z" fill="#f3f7ff" stroke="#c8dafb" />
			<path d="M60 66 86 55M284 73 306 82M47 119 64 125" stroke="#b6cff7" strokeWidth="2" strokeLinecap="round" />
			<circle className="scene-spark" cx="285" cy="46" r="5" fill="#76a4ed" />

			{kind === 'ai' && (
				<>
					<g className="scene-float">
						<path d="M126 142 154 126 233 142 233 188 204 205 126 185Z" fill="#1d4baf" />
						<path d="M126 142 204 158 204 205 126 185Z" fill={paint('blue')} />
						<path d="M126 142 154 126 233 142 204 158Z" fill="#a2c6ff" />
						<rect x="147" y="156" width="36" height="22" rx="7" fill="#e2efff" transform="rotate(12 147 156)" />
						<path d="M143 175 182 184" stroke="#173b88" strokeWidth="3" strokeLinecap="round" />
						<path d="M111 79Q111 62 129 59L157 48 247 70Q259 73 259 87V133Q259 145 245 149L215 161 123 135Q111 132 111 118Z" fill="#94b7ef" />
						<path d="M111 79Q111 65 127 69L211 89Q225 92 225 106V147Q225 162 210 158L126 137Q111 133 111 118Z" fill={paint('white')} stroke="#b4cdf5" />
						<path d="M132 85 200 102Q211 105 211 116V134Q211 145 199 142L132 125Q122 122 122 111V95Q122 83 132 85Z" fill={paint('glass')} />
						<ellipse cx="145" cy="107" rx="6" ry="9" fill="#9ac7ff" />
						<ellipse cx="187" cy="117" rx="6" ry="9" fill="#9ac7ff" />
						<path d="M157 122 174 126" stroke="#9ac7ff" strokeWidth="3" strokeLinecap="round" />
						<path d="M187 58V38" stroke="#5279b9" strokeWidth="5" strokeLinecap="round" />
						<circle cx="187" cy="32" r="9" fill={paint('blue')} />
						<path d="M110 101 99 97V119L110 123M260 105 269 101V124L260 128" fill="#4172c7" />
					</g>
					<g className="scene-float-alt">
						<path d="M250 36H301Q312 36 312 47V72Q312 83 301 83H278L261 95V83H250Q239 83 239 72V47Q239 36 250 36Z" fill={paint('white')} stroke="#abc8f8" />
						<path d="M253 52H297M253 64H284" stroke="#386bd3" strokeWidth="4" strokeLinecap="round" />
					</g>
				</>
			)}
			{kind === 'taxi' && (
				<>
					<g className="scene-float">
						<path d="M65 132 99 116 126 79Q130 73 142 73H204L247 113 282 128Q291 131 291 142V157L262 177 82 169 61 150V140Q61 134 65 132Z" fill={paint('blue')} />
						<path d="M110 116 136 84H197L231 117Z" fill={paint('glass')} stroke="#9fc6ff" strokeWidth="3" />
						<path d="M175 85 182 117M115 117 228 121" stroke="#b7d5ff" strokeWidth="4" />
						<path d="M65 132 237 138 282 128 291 142 248 160 61 150Z" fill={paint('white')} />
						<path d="M248 160 291 142V157L262 177 248 181Z" fill="#173f91" />
						<path d="M78 141 225 147" stroke="#7ea7e8" strokeWidth="2" />
						<path d="M148 133 171 134M202 135 221 136" stroke="#204782" strokeWidth="3" strokeLinecap="round" />
						<ellipse cx="100" cy="161" rx="20" ry="25" fill="#173456" />
						<ellipse cx="103" cy="161" rx="12" ry="17" fill="#c5d6ef" />
						<ellipse cx="104" cy="161" rx="5" ry="8" fill="#5277ad" />
						<ellipse cx="231" cy="167" rx="20" ry="25" fill="#173456" />
						<ellipse cx="234" cy="167" rx="12" ry="17" fill="#c5d6ef" />
						<ellipse cx="235" cy="167" rx="5" ry="8" fill="#5277ad" />
						<path d="M262 140 281 133V140L262 147Z" fill="#fce2a3" />
						<path d="M151 72 157 60H183L191 72Z" fill={paint('gold')} stroke="#d4a044" />
					</g>
					<g className="scene-float-alt">
						<path d="M268 23C248 23 240 38 245 52L268 88 291 52C296 38 287 23 268 23Z" fill={paint('blue')} />
						<circle cx="268" cy="44" r="10" fill="#fff" />
						<ellipse cx="268" cy="95" rx="20" ry="6" fill="#bbd3f8" />
					</g>
				</>
			)}
			{kind === 'insurance' && (
				<>
					<g className="scene-float-alt">
						<path d="M92 49 116 37 227 57V186L204 198 92 178Z" fill="#a8c7f7" />
						<path d="M92 49 204 69V198L92 178Z" fill={paint('white')} stroke="#bad1f7" />
						<path d="M111 80 183 94M111 98 172 110M111 117 181 130M111 136 151 144" stroke="#7097d5" strokeWidth="5" strokeLinecap="round" />
						<circle cx="127" cy="161" r="11" fill="#d5e4ff" />
						<path d="m122 160 4 5 7-8" fill="none" stroke="#1e40af" strokeWidth="3" strokeLinecap="round" />
					</g>
					<g className="scene-float">
						<path d="M233 80 288 106V151Q288 184 238 209L223 205 195 151 195 103Z" fill="#15377f" />
						<path d="M220 76 274 103V149Q274 181 220 205 166 171 166 139V95Z" fill={paint('blue')} stroke="#7ca9f0" strokeWidth="2" />
						<path d="M220 91 260 111V148Q260 171 220 190 180 164 180 141V105Z" fill="none" stroke="#b5d3ff" strokeWidth="2" />
						<path d="m197 134 17 20 29-34" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
					</g>
				</>
			)}
			{kind === 'loans' && (
				<>
					<g className="scene-float">
						<path d="M113 136 141 125 165 136V185L137 197 113 185Z" fill="#3267cf" />
						<path d="M113 136 137 147V197L113 185Z" fill="#93b9f4" />
						<path d="M113 136 141 125 165 136 137 147Z" fill="#c8ddff" />
						<path d="M172 99 200 88 224 99V170L196 183 172 170Z" fill="#214daa" />
						<path d="M172 99 196 111V183L172 170Z" fill={paint('blue')} />
						<path d="M172 99 200 88 224 99 196 111Z" fill="#9fc4ff" />
						<path d="M231 63 259 51 283 63V154L255 167 231 154Z" fill="#173d8d" />
						<path d="M231 63 255 75V167L231 154Z" fill={paint('blue')} />
						<path d="M231 63 259 51 283 63 255 75Z" fill="#a6c8ff" />
						<path d="m109 109 57-42 38 8 52-45m-21 0h21v21" fill="none" stroke="#1e40af" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
					</g>
					<g className="scene-float-alt">
						<path d="M66 159V185C66 201 131 201 131 185V159Z" fill="#d6a146" />
						<ellipse cx="98.5" cy="159" rx="32.5" ry="11" fill={paint('gold')} stroke="#d6a146" />
						<path d="M67 169C77 181 120 181 130 169M67 180C77 192 120 192 130 180" fill="none" stroke="#f4cf7c" strokeWidth="2" />
						<circle cx="103" cy="129" r="25" fill={paint('gold')} stroke="#c79130" strokeWidth="3" />
						<path d="M92 117H114M92 125H114M97 117C112 117 112 132 96 132L110 143" fill="none" stroke="#795117" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
					</g>
				</>
			)}
		</svg>
	);
}
