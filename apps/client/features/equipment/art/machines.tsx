/**
 * Side-profile vector machines in one 640×400 frame and one stroke weight, so they read as
 * a family. Excavator, backhoe, wheel loader and roller are ported from EquipExchange v2's
 * hero; the telehandler and the generic machine are drawn to match.
 */
import type { ReactElement } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { ArtKind } from './categoryArt';

export const MACHINE_FRAME = { width: 640, height: 400 } as const;

const PAINT = {
  amber: '#f0ac27',
  amberDeep: '#c98716',
  amberLight: '#f7c75f',
  ink: '#1c2128',
  steel: '#4b5563',
  steelLight: '#9aa3ad',
  steelDark: '#2b3138',
  glass: '#8fb6d6',
  glassLight: '#c9e0f1',
  tyre: '#23272d',
  rim: '#b8c0c9',
};

function Shading() {
  return (
    <Defs>
      <LinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={PAINT.amberLight} />
        <Stop offset="1" stopColor={PAINT.amberDeep} />
      </LinearGradient>
      <LinearGradient id="bodySide" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={PAINT.amber} />
        <Stop offset="1" stopColor={PAINT.amberDeep} />
      </LinearGradient>
      <LinearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={PAINT.glassLight} />
        <Stop offset="1" stopColor={PAINT.glass} />
      </LinearGradient>
      <LinearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={PAINT.steelLight} />
        <Stop offset="1" stopColor={PAINT.steel} />
      </LinearGradient>
      <LinearGradient id="track" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={PAINT.steelDark} />
        <Stop offset="1" stopColor={PAINT.tyre} />
      </LinearGradient>
      <RadialGradient id="groundShadow" cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0" stopColor="#000000" stopOpacity={0.28} />
        <Stop offset="0.55" stopColor="#000000" stopOpacity={0.12} />
        <Stop offset="1" stopColor="#000000" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );
}

function Cylinder({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <G>
      <Line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={PAINT.steelDark}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Line
        x1={x1}
        y1={y1}
        x2={(x1 + x2) / 2}
        y2={(y1 + y2) / 2}
        stroke="url(#steel)"
        strokeWidth={9}
        strokeLinecap="round"
      />
    </G>
  );
}

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={PAINT.tyre} />
      <Circle cx={cx} cy={cy} r={r * 0.62} fill={PAINT.rim} />
      <Circle cx={cx} cy={cy} r={r * 0.3} fill={PAINT.steelDark} />
      <Circle cx={cx} cy={cy} r={r * 0.11} fill={PAINT.steelLight} />
    </G>
  );
}

function Pivot({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={PAINT.steelDark} />
      <Circle cx={cx} cy={cy} r={r * 0.44} fill={PAINT.steelLight} />
    </G>
  );
}

function Tooth({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <Line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={PAINT.steelDark}
      strokeWidth={6}
      strokeLinecap="round"
    />
  );
}

function Excavator() {
  return (
    <G>
      {/* track */}
      <Rect x={170} y={292} width={300} height={68} rx={34} fill="url(#track)" />
      <Rect
        x={186}
        y={306}
        width={268}
        height={40}
        rx={20}
        fill="none"
        stroke={PAINT.steel}
        strokeWidth={3}
        strokeDasharray="10 9"
      />
      <Circle cx={210} cy={326} r={17} fill={PAINT.rim} />
      <Circle cx={430} cy={326} r={17} fill={PAINT.rim} />
      <Circle cx={320} cy={326} r={11} fill={PAINT.rim} />
      {/* undercarriage + slew ring */}
      <Rect x={228} y={266} width={184} height={30} rx={8} fill={PAINT.steelDark} />
      <Rect x={262} y={252} width={116} height={22} rx={6} fill={PAINT.steel} />
      {/* upper body */}
      <Path
        d="M150 258 L150 184 Q150 170 164 170 L292 170 L292 128 Q292 116 304 116 L378 116 Q392 116 392 130 L392 170 L432 170 Q446 170 446 184 L446 258 Q446 268 436 268 L160 268 Q150 268 150 258 Z"
        fill="url(#body)"
      />
      <Path
        d="M150 258 L150 184 Q150 170 164 170 L292 170 L292 258 Z"
        fill="url(#bodySide)"
        opacity={0.55}
      />
      {/* counterweight */}
      <Rect x={150} y={196} width={96} height={62} rx={8} fill={PAINT.amberDeep} opacity={0.75} />
      <Rect x={162} y={210} width={72} height={6} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={162} y={226} width={72} height={6} rx={3} fill={PAINT.ink} opacity={0.35} />
      {/* cab */}
      <Path d="M300 124 L370 124 Q384 124 384 138 L384 170 L300 170 Z" fill="url(#glass)" />
      <Path d="M300 124 L336 124 L336 170 L300 170 Z" fill="#ffffff" opacity={0.28} />
      <Rect x={296} y={118} width={92} height={10} rx={5} fill={PAINT.ink} />
      <Rect x={300} y={172} width={84} height={8} rx={4} fill={PAINT.ink} opacity={0.6} />
      {/* exhaust */}
      <Rect x={214} y={152} width={12} height={26} rx={6} fill={PAINT.steelDark} />
      {/* boom */}
      <Path d="M420 210 L560 120 Q574 112 582 126 L596 166 L456 240 Z" fill="url(#body)" />
      <Path d="M420 210 L560 120 L596 166 L456 240 Z" fill={PAINT.amberDeep} opacity={0.35} />
      <Pivot cx={436} cy={222} r={16} />
      <Cylinder x1={372} y1={196} x2={520} y2={150} />
      {/* stick */}
      <Path d="M580 150 L612 254 Q616 268 602 272 L588 274 L548 168 Z" fill="url(#body)" />
      <Pivot cx={584} cy={156} r={12} />
      <Cylinder x1={548} y1={130} x2={598} y2={214} />
      {/* bucket */}
      <Path
        d="M572 262 L618 262 Q640 262 636 286 L620 336 Q616 348 602 346 L560 334 Q548 330 552 316 L572 262 Z"
        fill="url(#steel)"
      />
      <Path d="M560 334 L602 346 L606 356 L556 344 Z" fill={PAINT.steelDark} />
      <Tooth x1={560} y1={348} x2={554} y2={366} />
      <Tooth x1={578} y1={352} x2={574} y2={370} />
      <Tooth x1={596} y1={356} x2={594} y2={374} />
      <Circle cx={598} cy={268} r={10} fill={PAINT.steelDark} />
    </G>
  );
}

function BackhoeLoader() {
  return (
    <G>
      {/* chassis */}
      <Rect x={186} y={244} width={280} height={50} rx={10} fill="url(#body)" />
      <Rect x={186} y={244} width={280} height={50} rx={10} fill={PAINT.amberDeep} opacity={0.25} />
      {/* engine hood */}
      <Path d="M186 250 L186 208 Q186 196 198 196 L286 196 L286 250 Z" fill="url(#body)" />
      <Rect x={200} y={214} width={62} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={200} y={228} width={62} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={232} y={176} width={12} height={24} rx={6} fill={PAINT.steelDark} />
      {/* cab */}
      <Path
        d="M296 246 L296 126 Q296 114 308 114 L400 114 Q412 114 412 126 L412 246 Z"
        fill={PAINT.ink}
      />
      <Path d="M306 130 L402 130 L402 200 L306 200 Z" fill="url(#glass)" />
      <Path d="M306 130 L350 130 L350 200 L306 200 Z" fill="#ffffff" opacity={0.25} />
      <Rect x={304} y={206} width={100} height={36} rx={6} fill="url(#body)" />
      {/* wheels */}
      <Wheel cx={232} cy={318} r={44} />
      <Wheel cx={440} cy={310} r={56} />
      {/* front loader arms + bucket */}
      <Path d="M200 236 L96 268 Q84 272 86 284 L92 300 L206 262 Z" fill="url(#body)" />
      <Cylinder x1={220} y1={210} x2={130} y2={262} />
      <Path
        d="M40 262 L104 262 Q116 262 116 274 L116 330 L52 338 Q36 340 34 324 L30 276 Q28 262 40 262 Z"
        fill="url(#steel)"
      />
      <Path d="M34 324 L116 316 L116 330 L52 338 Q36 340 34 324 Z" fill={PAINT.steelDark} />
      {/* rear backhoe */}
      <Path d="M448 232 L534 118 Q542 108 552 116 L564 130 L476 246 Z" fill="url(#body)" />
      <Pivot cx={460} cy={238} r={14} />
      <Cylinder x1={430} y1={196} x2={516} y2={156} />
      <Path d="M552 130 L598 236 Q602 248 590 252 L578 254 L536 150 Z" fill="url(#body)" />
      <Circle cx={550} cy={134} r={10} fill={PAINT.steelDark} />
      <Cylinder x1={520} y1={112} x2={584} y2={196} />
      <Path
        d="M566 246 L610 246 Q630 246 626 268 L612 314 Q608 326 594 324 L558 314 Q546 310 550 296 L566 246 Z"
        fill="url(#steel)"
      />
      <Path d="M558 314 L594 324 L598 334 L554 322 Z" fill={PAINT.steelDark} />
      {/* stabiliser */}
      <Path
        d="M470 256 L500 256 L508 330 Q509 340 498 340 L474 340 Q464 340 466 330 Z"
        fill="url(#steel)"
      />
      <Rect x={456} y={338} width={60} height={12} rx={6} fill={PAINT.steelDark} />
    </G>
  );
}

function WheelLoader() {
  return (
    <G>
      {/* rear body + engine */}
      <Path
        d="M300 262 L300 196 Q300 184 312 184 L470 184 Q482 184 482 196 L482 262 Z"
        fill="url(#body)"
      />
      <Rect x={400} y={200} width={64} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={400} y={216} width={64} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={444} y={160} width={12} height={28} rx={6} fill={PAINT.steelDark} />
      {/* cab */}
      <Path
        d="M312 190 L312 116 Q312 104 324 104 L392 104 Q404 104 404 116 L404 190 Z"
        fill={PAINT.ink}
      />
      <Path d="M320 118 L396 118 L396 176 L320 176 Z" fill="url(#glass)" />
      <Path d="M320 118 L356 118 L356 176 L320 176 Z" fill="#ffffff" opacity={0.25} />
      {/* articulated front frame */}
      <Path d="M296 214 L226 214 Q212 214 212 228 L212 262 L296 262 Z" fill="url(#body)" />
      <Rect x={286} y={222} width={20} height={32} rx={6} fill={PAINT.steelDark} />
      {/* lift arms + bucket */}
      <Path d="M236 224 L112 254 Q100 258 102 270 L106 288 L246 254 Z" fill="url(#body)" />
      <Cylinder x1={262} y1={198} x2={150} y2={250} />
      <Path
        d="M40 236 L124 236 Q136 236 136 248 L136 318 L60 330 Q40 332 38 314 L30 250 Q28 236 40 236 Z"
        fill="url(#steel)"
      />
      <Path d="M38 314 L136 302 L136 318 L60 330 Q40 332 38 314 Z" fill={PAINT.steelDark} />
      {/* wheels */}
      <Wheel cx={262} cy={310} r={56} />
      <Wheel cx={430} cy={310} r={56} />
    </G>
  );
}

function Roller() {
  return (
    <G>
      {/* rear body */}
      <Path
        d="M330 270 L330 196 Q330 184 342 184 L520 184 Q532 184 532 196 L532 270 Z"
        fill="url(#body)"
      />
      <Rect x={452} y={202} width={60} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={452} y={218} width={60} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={496} y={156} width={12} height={30} rx={6} fill={PAINT.steelDark} />
      {/* roll-over bar + seat */}
      <Path
        d="M350 186 L350 104 Q350 92 362 92 L428 92 Q440 92 440 104 L440 186"
        fill="none"
        stroke={PAINT.ink}
        strokeWidth={10}
        strokeLinejoin="round"
      />
      <Rect x={372} y={154} width={48} height={28} rx={8} fill={PAINT.steelDark} />
      <Circle cx={358} cy={166} r={12} fill="none" stroke={PAINT.steelDark} strokeWidth={5} />
      {/* articulation + drum frame */}
      <Rect x={306} y={222} width={30} height={40} rx={6} fill={PAINT.steelDark} />
      <Path d="M120 220 L310 220 Q322 220 322 232 L322 262 L120 262 Z" fill="url(#body)" />
      {/* smooth drum */}
      <Rect x={96} y={248} width={190} height={112} rx={20} fill="url(#track)" />
      <Rect
        x={110}
        y={262}
        width={162}
        height={84}
        rx={14}
        fill="none"
        stroke={PAINT.steel}
        strokeWidth={4}
      />
      <Circle cx={191} cy={304} r={16} fill={PAINT.rim} />
      {/* rear wheel */}
      <Wheel cx={478} cy={312} r={52} />
    </G>
  );
}

function Telehandler() {
  return (
    <G>
      {/* chassis */}
      <Rect x={150} y={246} width={340} height={48} rx={10} fill="url(#body)" />
      <Rect x={150} y={246} width={340} height={48} rx={10} fill={PAINT.amberDeep} opacity={0.25} />
      {/* engine housing */}
      <Path
        d="M372 250 L372 200 Q372 188 384 188 L476 188 Q488 188 488 200 L488 250 Z"
        fill="url(#body)"
      />
      <Rect x={396} y={206} width={70} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={396} y={220} width={70} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      {/* cab */}
      <Path
        d="M228 250 L228 140 Q228 128 240 128 L300 128 Q312 128 312 140 L312 250 Z"
        fill={PAINT.ink}
      />
      <Path d="M236 142 L304 142 L304 214 L236 214 Z" fill="url(#glass)" />
      <Path d="M236 142 L266 142 L266 214 L236 214 Z" fill="#ffffff" opacity={0.25} />
      {/* telescopic boom: outer section from the rear pivot, inner section sliding forward */}
      <Path d="M478 196 L168 110 Q154 106 150 120 L148 136 L470 226 Z" fill="url(#body)" />
      <Path d="M478 196 L168 110 L148 136 L470 226 Z" fill={PAINT.amberDeep} opacity={0.3} />
      <Path d="M182 118 L104 98 Q92 96 90 108 L88 122 L176 144 Z" fill="url(#steel)" />
      <Pivot cx={462} cy={208} r={16} />
      <Cylinder x1={344} y1={250} x2={262} y2={148} />
      {/* carriage + forks */}
      <Pivot cx={96} cy={114} r={10} />
      <Rect x={84} y={112} width={16} height={104} rx={4} fill={PAINT.steelDark} />
      <Rect x={28} y={204} width={70} height={10} rx={4} fill="url(#steel)" />
      <Rect x={28} y={178} width={70} height={10} rx={4} fill="url(#steel)" opacity={0.6} />
      {/* wheels */}
      <Wheel cx={214} cy={312} r={48} />
      <Wheel cx={430} cy={312} r={48} />
    </G>
  );
}

/** A plain wheeled machine for categories with no drawing of their own. */
function Generic() {
  return (
    <G>
      <Rect x={150} y={232} width={340} height={62} rx={12} fill="url(#body)" />
      <Rect x={150} y={232} width={120} height={62} rx={12} fill="url(#bodySide)" opacity={0.5} />
      <Rect x={380} y={250} width={90} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Rect x={380} y={266} width={90} height={7} rx={3} fill={PAINT.ink} opacity={0.35} />
      <Path
        d="M200 236 L200 136 Q200 124 212 124 L300 124 Q312 124 312 136 L312 236 Z"
        fill={PAINT.ink}
      />
      <Path d="M208 138 L304 138 L304 204 L208 204 Z" fill="url(#glass)" />
      <Path d="M208 138 L248 138 L248 204 L208 204 Z" fill="#ffffff" opacity={0.25} />
      <Rect x={440} y={204} width={12} height={30} rx={6} fill={PAINT.steelDark} />
      <Wheel cx={226} cy={312} r={48} />
      <Wheel cx={414} cy={312} r={48} />
    </G>
  );
}

const RENDERERS: Record<ArtKind, () => ReactElement> = {
  excavator: Excavator,
  miniExcavator: Excavator,
  backhoe: BackhoeLoader,
  wheelLoader: WheelLoader,
  telehandler: Telehandler,
  roller: Roller,
  generic: Generic,
};

/** Fills its parent's box, keeping the 640×400 frame's proportions. */
export function Machine({ kind }: { kind: ArtKind }) {
  const Render = RENDERERS[kind];
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${MACHINE_FRAME.width} ${MACHINE_FRAME.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <Shading />
      <Ellipse cx={320} cy={372} rx={250} ry={22} fill="url(#groundShadow)" />
      <Render />
    </Svg>
  );
}
