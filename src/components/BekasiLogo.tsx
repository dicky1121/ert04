import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  showText?: boolean;
}

const LOGO_SRC = '/logo-kabupaten-bekasi.jpg';

const sizeClasses: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'w-8 h-10',
  md: 'w-12 h-15',
  lg: 'w-16 h-20',
  xl: 'w-24 h-30',
  custom: ''
};

export const LambangBekasiLogo: React.FC<LogoProps> = ({
  className = 'w-16 h-20',
  size,
  showText = false
}) => {
  const sizeClass = size ? sizeClasses[size] || className : className;

  return (
    <div className={`inline-flex flex-col items-center select-none ${showText ? 'gap-1' : ''}`}>
      <img
        src={LOGO_SRC}
        alt="Lambang Resmi Kabupaten Bekasi"
        className={`${sizeClass} object-contain`}
        width={96}
        height={120}
        decoding="async"
        draggable={false}
      />

      {showText && (
        <div className="text-center font-extrabold text-slate-900 text-xs leading-tight uppercase mt-1">
          KABUPATEN BEKASI
        </div>
      )}
    </div>
  );
};

export const BekasiLogo = LambangBekasiLogo;
export default BekasiLogo;