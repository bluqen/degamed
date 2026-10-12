import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePref } from '../lib/theme';
import { IconButton } from './Button';
import { Menu } from './Menu';

const LABEL: Record<ThemePref, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
};

/** Sun/moon button that opens a small menu: match my device, light or dark. */
export function ThemeToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { pref, resolved, setPref } = useTheme();
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <Menu
      label="Appearance"
      width={200}
      trigger={
        <IconButton label={`Appearance: ${LABEL[pref]}`} size={size} aria-haspopup="menu">
          {resolved === 'dark' ? <Moon size={iconSize} /> : <Sun size={iconSize} />}
        </IconButton>
      }
      items={[
        { type: 'heading', label: 'Appearance' },
        {
          label: LABEL.system,
          icon: <Monitor size={16} />,
          checked: pref === 'system',
          onSelect: () => setPref('system'),
        },
        {
          label: LABEL.light,
          icon: <Sun size={16} />,
          checked: pref === 'light',
          onSelect: () => setPref('light'),
        },
        {
          label: LABEL.dark,
          icon: <Moon size={16} />,
          checked: pref === 'dark',
          onSelect: () => setPref('dark'),
        },
      ]}
    />
  );
}
