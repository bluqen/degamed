import { cx } from '../ui';

/**
 * A theme's pre-rendered key art (apps/web/public/art/themes). Doesn't load any art code,
 * so it's safe on light pages like the landing.
 */
export function ThemeThumb({ id, className, eager }: { id: string; className?: string; eager?: boolean }) {
  return (
    <img
      src={`/art/themes/${id}.png`}
      alt=""
      width={480}
      height={270}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cx('pixelated block h-full w-full object-cover', className)}
    />
  );
}

/** Marketing copy for the art styles shown on the landing page (ids match the art themes). */
export const SHOWCASE = [
  { id: 'rain-ruins', name: 'Rain Ruins', blurb: 'Moody, rain-soaked ruins in teal fog.' },
  { id: 'hollow-caverns', name: 'Hollow Caverns', blurb: 'Glowing fungus and drifting spores in the dark.' },
  { id: 'sunlit-meadow', name: 'Sunlit Meadow', blurb: 'Puffy clouds, snowy peaks and summer flowers.' },
  { id: 'ember-forge', name: 'Ember Forge', blurb: 'Molten light and giant gears in a castle forge.' },
];
