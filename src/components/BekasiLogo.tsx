import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  showText?: boolean;
}

export const LambangBekasiLogo: React.FC<LogoProps> = ({ 
  className = 'w-16 h-20',
  size,
  showText = false
}) => {
  let sizeClass = className;
  if (size === 'sm') sizeClass = 'w-8 h-10';
  else if (size === 'md') sizeClass = 'w-12 h-15';
  else if (size === 'lg') sizeClass = 'w-16 h-20';
  else if (size === 'xl') sizeClass = 'w-24 h-30';

  return (
    <div className={`inline-flex flex-col items-center select-none ${showText ? 'gap-1' : ''}`}>
      <svg 
        viewBox="0 0 320 390" 
        className={sizeClass} 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Lambang Resmi Kabupaten Bekasi"
      >
        <defs>
          <clipPath id="shieldInnerClip">
            <path d="M 45 42 L 275 42 L 275 220 C 275 285 160 325 160 325 C 160 325 45 285 45 220 Z" />
          </clipPath>
        </defs>

        {/* ========================================= */}
        {/* 1. MAIN PERISAI (SHIELD) BACKGROUND & BORDER */}
        {/* ========================================= */}
        {/* Outer Shield Outline & Thick Yellow Border */}
        <path
          d="M 32 28 L 288 28 L 288 224 C 288 296 160 342 160 342 C 160 342 32 296 32 224 Z"
          fill="#FFDE00"
          stroke="#000000"
          strokeWidth="6"
          strokeLinejoin="miter"
        />

        {/* Inner Shield Boundary */}
        <path
          d="M 45 42 L 275 42 L 275 220 C 275 285 160 325 160 325 C 160 325 45 285 45 220 Z"
          fill="#33A837"
          stroke="#000000"
          strokeWidth="4"
        />

        {/* Inside Shield Elements (Clipped to Inner Shield Area) */}
        <g clipPath="url(#shieldInnerClip)">
          
          {/* Green Top Field (Default Fill) */}
          <rect x="40" y="40" width="240" height="290" fill="#2EB82E" />

          {/* ========================================= */}
          {/* A. WATER WAVES / LAUTAN BIRU (BOTTOM)    */}
          {/* ========================================= */}
          <rect x="40" y="242" width="240" height="90" fill="#00AEEF" />
          <path d="M 40 242 L 280 242" stroke="#000000" strokeWidth="4" />

          {/* 5 White Wave Crests */}
          <path
            d="M 40 255 Q 70 246 100 255 T 160 255 T 220 255 T 280 255"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M 40 270 Q 70 261 100 270 T 160 270 T 220 270 T 280 270"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M 40 285 Q 70 276 100 285 T 160 285 T 220 285 T 280 285"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M 40 300 Q 70 291 100 300 T 160 300 T 220 300 T 280 300"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M 60 314 Q 90 306 120 314 T 160 314 T 200 314 T 260 314"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* ========================================= */}
          {/* B. BENTENG MERAH BATA (RED BRICK FORTRESS)*/}
          {/* ========================================= */}
          <g>
            <rect x="40" y="200" width="240" height="42" fill="#E32626" stroke="#000000" strokeWidth="3" />
            
            {/* White Mortar Lines */}
            {/* Horizontal Lines */}
            <line x1="40" y1="208" x2="280" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="40" y1="216" x2="280" y2="216" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="40" y1="225" x2="280" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="40" y1="233" x2="280" y2="233" stroke="#FFFFFF" strokeWidth="2" />

            {/* Vertical Brick Joints - Row 1 */}
            <line x1="55" y1="200" x2="55" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="85" y1="200" x2="85" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="115" y1="200" x2="115" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="145" y1="200" x2="145" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="175" y1="200" x2="175" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="205" y1="200" x2="205" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="235" y1="200" x2="235" y2="208" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="265" y1="200" x2="265" y2="208" stroke="#FFFFFF" strokeWidth="2" />

            {/* Vertical Brick Joints - Row 2 */}
            <line x1="70" y1="208" x2="70" y2="216" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="100" y1="208" x2="100" y2="216" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="130" y1="208" x2="130" y2="216" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="160" y1="208" x2="160" y2="216" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="190" y1="208" x2="190" y2="216" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="220" y1="208" x2="220" y2="216" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="250" y1="208" x2="250" y2="216" stroke="#FFFFFF" strokeWidth="2" />

            {/* Vertical Brick Joints - Row 3 */}
            <line x1="55" y1="216" x2="55" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="85" y1="216" x2="85" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="115" y1="216" x2="115" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="145" y1="216" x2="145" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="175" y1="216" x2="175" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="205" y1="216" x2="205" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="235" y1="216" x2="235" y2="225" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="265" y1="216" x2="265" y2="225" stroke="#FFFFFF" strokeWidth="2" />

            {/* Vertical Brick Joints - Row 4 */}
            <line x1="70" y1="225" x2="70" y2="233" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="100" y1="225" x2="100" y2="233" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="130" y1="225" x2="130" y2="233" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="160" y1="225" x2="160" y2="233" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="190" y1="225" x2="190" y2="233" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="220" y1="225" x2="220" y2="233" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="250" y1="225" x2="250" y2="233" stroke="#FFFFFF" strokeWidth="2" />

            {/* Vertical Brick Joints - Row 5 */}
            <line x1="55" y1="233" x2="55" y2="242" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="85" y1="233" x2="85" y2="242" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="115" y1="233" x2="115" y2="242" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="145" y1="233" x2="145" y2="242" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="175" y1="233" x2="175" y2="242" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="205" y1="233" x2="205" y2="242" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="235" y1="233" x2="235" y2="242" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="265" y1="233" x2="265" y2="242" stroke="#FFFFFF" strokeWidth="2" />
          </g>

          {/* ========================================= */}
          {/* C. OPEN BOOK / KITAB TERBUKA             */}
          {/* ========================================= */}
          <g id="openBook">
            {/* White page base */}
            <polygon 
              points="160,184 80,198 84,202 160,188 236,202 240,198" 
              fill="#FFFFFF" 
              stroke="#000000" 
              strokeWidth="2.5" 
            />
            {/* Top Black Cover Outline */}
            <polygon 
              points="160,181 50,199 76,200 160,187 244,200 270,199" 
              fill="#111111" 
              stroke="#000000" 
              strokeWidth="2.5" 
            />
            <line x1="160" y1="181" x2="160" y2="200" stroke="#FFFFFF" strokeWidth="2" />
          </g>

          {/* ========================================= */}
          {/* D. KAPAS (LEFT EMBLEM)                    */}
          {/* ========================================= */}
          <g id="kapas">
            {/* 8 Connected Cotton Balls */}
            <circle cx="152" cy="74" r="8" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <circle cx="140" cy="85" r="9" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <circle cx="132" cy="100" r="10" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <circle cx="127" cy="116" r="10.5" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <circle cx="127" cy="133" r="11" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <circle cx="134" cy="149" r="11.5" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <circle cx="145" cy="163" r="11.5" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <circle cx="158" cy="173" r="11" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />

            {/* Green Leaf Base at Bottom of Kapas */}
            <path
              d="M 152 170 C 145 178 140 186 150 186 C 160 186 166 178 152 170 Z"
              fill="#009933"
              stroke="#000000"
              strokeWidth="1.5"
            />
          </g>

          {/* ========================================= */}
          {/* E. PADI (RIGHT EMBLEM)                    */}
          {/* ========================================= */}
          <g id="padi">
            {/* Main curved yellow stem */}
            <path
              d="M 162 184 C 172 174 212 144 200 70"
              fill="none"
              stroke="#FFD700"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Golden Rice Grains (Pairs along stem) */}
            {/* Top grain */}
            <ellipse cx="198" cy="74" rx="7" ry="13" transform="rotate(35 198 74)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />
            
            {/* Pair 1 */}
            <ellipse cx="188" cy="88" rx="6.5" ry="12" transform="rotate(-30 188 88)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />
            <ellipse cx="206" cy="90" rx="6.5" ry="12" transform="rotate(45 206 90)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />

            {/* Pair 2 */}
            <ellipse cx="180" cy="106" rx="6.5" ry="12" transform="rotate(-35 180 106)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />
            <ellipse cx="202" cy="108" rx="6.5" ry="12" transform="rotate(50 202 108)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />

            {/* Pair 3 */}
            <ellipse cx="174" cy="125" rx="6.5" ry="12" transform="rotate(-40 174 125)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />
            <ellipse cx="195" cy="127" rx="6.5" ry="12" transform="rotate(55 195 127)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />

            {/* Pair 4 */}
            <ellipse cx="168" cy="144" rx="6.5" ry="12" transform="rotate(-45 168 144)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />
            <ellipse cx="188" cy="146" rx="6.5" ry="12" transform="rotate(60 188 146)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />

            {/* Pair 5 */}
            <ellipse cx="164" cy="162" rx="6.5" ry="12" transform="rotate(-45 164 162)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />
            <ellipse cx="178" cy="164" rx="6.5" ry="12" transform="rotate(65 178 164)" fill="#FFD700" stroke="#000000" strokeWidth="1.5" />
          </g>

          {/* ========================================= */}
          {/* F. GOLOK BEKASI (CENTER EMBLEM)          */}
          {/* ========================================= */}
          <g id="golokBekasi">
            {/* White Blade */}
            <path
              d="M 161 68 C 160 95 160 145 162 165 L 167 165 C 168 135 172 90 162 68 Z"
              fill="#FFFFFF"
              stroke="#000000"
              strokeWidth="2.5"
            />
            {/* Sharp Cutting Edge Contour */}
            <path
              d="M 161 68 Q 159 110 162 165"
              fill="none"
              stroke="#000000"
              strokeWidth="3"
            />
            {/* Black Curved Handle / Gagang Golok */}
            <path
              d="M 162 165 C 162 165 165 175 163 182 C 160 188 153 186 153 182 C 153 178 159 175 159 165 Z"
              fill="#111111"
              stroke="#000000"
              strokeWidth="2"
            />
            {/* Blade Tip */}
            <polygon points="161,68 162,65 164,68" fill="#FFFFFF" stroke="#000000" strokeWidth="1" />
          </g>

        </g>

        {/* ========================================= */}
        {/* 2. BANNER PITA KUNING (BOTTOM RIBBON)     */}
        {/* ========================================= */}
        <g id="ribbonBanner">
          {/* Left Ribbon End (Folded Flutter) */}
          <polygon
            points="58,328 18,300 28,280 65,302"
            fill="#FFDE00"
            stroke="#000000"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <polygon
            points="18,300 28,280 40,290"
            fill="#D4AF37"
            stroke="#000000"
            strokeWidth="2"
          />
          <polygon
            points="65,302 48,318 64,324"
            fill="#C49B0B"
            stroke="#000000"
            strokeWidth="2"
          />

          {/* Right Ribbon End (Folded Flutter) */}
          <polygon
            points="262,328 302,300 292,280 255,302"
            fill="#FFDE00"
            stroke="#000000"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <polygon
            points="302,300 292,280 280,290"
            fill="#D4AF37"
            stroke="#000000"
            strokeWidth="2"
          />
          <polygon
            points="255,302 272,318 256,324"
            fill="#C49B0B"
            stroke="#000000"
            strokeWidth="2"
          />

          {/* Main Curved Banner Body */}
          <path
            d="M 46 302 C 100 328 220 328 274 302 L 260 348 C 210 366 110 366 60 348 Z"
            fill="#FFDE00"
            stroke="#000000"
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {/* Banner Text: SWATANTRA WIBAWA MUKTI */}
          <path
            id="textCurvePath"
            d="M 52 334 C 110 358 210 358 268 334"
            fill="none"
          />
          <text
            fill="#000000"
            fontSize="14"
            fontFamily="Arial Black, Impact, sans-serif"
            fontWeight="900"
            letterSpacing="1.2"
          >
            <textPath href="#textCurvePath" startOffset="50%" textAnchor="middle">
              SWATANTRA WIBAWA MUKTI
            </textPath>
          </text>
        </g>
      </svg>

      {showText && (
        <div className="text-center font-extrabold text-slate-900 text-[11px] leading-tight tracking-wider uppercase mt-1">
          KABUPATEN BEKASI
        </div>
      )}
    </div>
  );
};

export const BekasiLogo = LambangBekasiLogo;
export default BekasiLogo;
