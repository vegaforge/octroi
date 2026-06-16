import * as React from 'react';

export type LogoProps = {
  /** `mark` = icon only, `lockup` = mark + wordmark. */
  variant?: 'mark' | 'lockup';
  className?: string;
  // Color comes from `currentColor`, so set a text color on the wrapper.
  // Default height 24px (mark) / 32px (lockup), override via className.
  'aria-label'?: string;
} & Omit<React.SVGProps<SVGSVGElement>, 'aria-label'>;

const DEFAULT_LABEL = 'CrawlPay';

/** Arch + threshold dot, in a 0 0 64 64 box. */
function MarkPaths() {
  return (
    <>
      <path fill="currentColor" d="M8 56V32a24 24 0 0 1 48 0v24h-10V32a14 14 0 0 0-28 0v24Z" />
      <ellipse fill="currentColor" cx="32" cy="29.5" rx="3.2" ry="3.8" />
    </>
  );
}

/** Geist wordmark, outlined to paths, in the 64..280 region of the lockup box. */
function WordmarkPaths() {
  return (
    <g fill="currentColor" transform="translate(72.06 50) scale(0.4408)">
      <path d="M68.10-24.80L54.30-25.50C52.60-15.50 46.60-9.90 37.70-9.90C24.10-9.90 17.90-21.20 17.90-35.40C17.90-49.70 24-61.10 37.70-61.10C46.20-61.10 52.10-56 54-46.80L67.70-47.50C64.60-63.10 53.90-72.60 37.90-72.60C17-72.60 4.40-56.30 4.40-35.40C4.40-14.60 17.10 1.60 37.90 1.60C54.70 1.60 65.30-8.40 68.10-24.80ZM77-53L77 0L90 0L90-30.20C90-38.70 93.50-42.90 102-42.90L107.10-42.90L107.10-53L102.10-53C95.30-53 91.40-49.60 89.40-42.70L89.10-53ZM112.50-36.90L125.70-36.10C127-41.90 130.60-44.90 136.20-44.90C143.10-44.90 146.50-41 146.60-33L131.70-30C119.30-27.50 111.70-24.20 111.70-13.90C111.70-4.50 120.10 1.20 130.70 1.20C139.90 1.20 145.90-2.80 148.30-8C149.30 0.20 157.80 0.10 161.90 0.10L164.90 0L164.90-9.40L162.90-9.40C160.90-9.40 159.60-10.20 159.60-13.30L159.60-31.40C159.60-46.30 151.50-54.20 136.20-54.20C123.20-54.20 114.60-47.80 112.50-36.90ZM125-14.30C125-20.40 130.10-21.10 136.80-22.40L146.80-24.20L146.80-23.60C146.80-13.10 141.40-7.90 134.20-7.90C128-7.90 125-10.70 125-14.30ZM210.40-53L199.20-53L188.30-14.80L177.60-53L164.90-53L181.10 0L194.40 0L204.80-35.50L215.20 0L228.50 0L244.70-53L232-53L221.30-14.80ZM251.80-71L251.80-13.30C251.80-4.90 257.20 0 265.10 0L272.60 0L272.60-10.10L268.50-10.10C266.10-10.10 264.80-11.40 264.80-13.90L264.80-71ZM309.50-71L282.10-71L282.10 0L295.20 0L295.20-25.50L309.50-25.50C326.20-25.50 336.20-34.10 336.20-48.40C336.20-62.50 326.20-71 309.50-71ZM295.20-37L295.20-59.50L309-59.50C317.90-59.50 322.60-55.80 322.60-48.40C322.60-40.80 317.80-37 309-37ZM341.80-36.90L355-36.10C356.30-41.90 359.90-44.90 365.50-44.90C372.40-44.90 375.80-41 375.90-33L361-30C348.60-27.50 341-24.20 341-13.90C341-4.50 349.40 1.20 360 1.20C369.20 1.20 375.20-2.80 377.60-8C378.60 0.20 387.10 0.10 391.20 0.10L394.20 0L394.20-9.40L392.20-9.40C390.20-9.40 388.90-10.20 388.90-13.30L388.90-31.40C388.90-46.30 380.80-54.20 365.50-54.20C352.50-54.20 343.90-47.80 341.80-36.90ZM354.30-14.30C354.30-20.40 359.40-21.10 366.10-22.40L376.10-24.20L376.10-23.60C376.10-13.10 370.70-7.90 363.50-7.90C357.30-7.90 354.30-10.70 354.30-14.30ZM394.20-53L413.40-2.10L417.20-2.10L415.70 1.70C414.60 4.10 413 5.10 410.10 5.10L403.60 5.10L403.60 15L412.30 15C419.40 15 423.80 12.10 426 5.60L447.10-53L434.50-53L420.90-13.60L406.90-53Z" />
    </g>
  );
}

export function Logo({
  variant = 'lockup',
  className,
  'aria-label': ariaLabel = DEFAULT_LABEL,
  ...rest
}: LogoProps) {
  const isLockup = variant === 'lockup';
  const viewBox = isLockup ? '0 0 280 64' : '0 0 64 64';
  // Default height; className overrides it.
  const defaultStyle: React.CSSProperties = {
    height: isLockup ? 32 : 24,
    width: 'auto',
    display: 'block',
  };

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      // only applies when no size class is set
      style={className ? undefined : defaultStyle}
      {...rest}
    >
      <title>{ariaLabel}</title>
      <MarkPaths />
      {isLockup && <WordmarkPaths />}
    </svg>
  );
}

export default Logo;
