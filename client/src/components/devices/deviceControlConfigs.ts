export interface DeviceControlDef {
  id: string;
  label: string;
  description: string;
  iconName: string;
  category: 'core' | 'presets' | 'advanced' | 'telemetry';
  defaultEnabled: boolean;
}

export const DIMMABLE_LIGHT_CONTROLS: DeviceControlDef[] = [
  {
    id: 'brightness',
    label: 'Brightness Slider',
    description: 'Continuous smooth dimming slider (1% to 100%)',
    iconName: 'SunMedium',
    category: 'core',
    defaultEnabled: true,
  },
  {
    id: 'color_temp',
    label: 'Color Temperature Slider',
    description: 'Warm-to-cool Kelvin spectrum slider (2200K - 6500K)',
    iconName: 'Flame',
    category: 'core',
    defaultEnabled: true,
  },
  {
    id: 'cct_presets',
    label: 'CCT Quick Tone Presets',
    description: 'One-touch tone buttons: Candle (2200K), Warm (2700K), Neutral (4000K), Cool (6250K)',
    iconName: 'Sparkles',
    category: 'presets',
    defaultEnabled: false,
  },
  {
    id: 'brightness_presets',
    label: 'Brightness Step Buttons',
    description: 'Instant brightness percentage buttons (25%, 50%, 75%, 100%)',
    iconName: 'Percent',
    category: 'presets',
    defaultEnabled: false,
  },
  {
    id: 'effects',
    label: 'Dynamic Light Effects',
    description: 'Hardware animation triggers: Breathe (pulse), Blink (alert), Okay (confirm)',
    iconName: 'Zap',
    category: 'advanced',
    defaultEnabled: false,
  },
  {
    id: 'studio_modal',
    label: 'Full Lighting Studio Button',
    description: 'Button to open the full-featured dialog with hardware configuration',
    iconName: 'SlidersHorizontal',
    category: 'advanced',
    defaultEnabled: false,
  },
  {
    id: 'color_picker',
    label: 'Color & Mood Swatches',
    description: 'Quick color swatches and RGB picker for colored lighting',
    iconName: 'Palette',
    category: 'advanced',
    defaultEnabled: false,
  },
  {
    id: 'power_wattage',
    label: 'Power Gauge (Watts)',
    description: 'Estimated live power consumption based on max wattage',
    iconName: 'Zap',
    category: 'telemetry',
    defaultEnabled: true,
  },
  {
    id: 'signal_lqi',
    label: 'Signal Quality (LQI)',
    description: 'Zigbee mesh link quality telemetry badge',
    iconName: 'Signal',
    category: 'telemetry',
    defaultEnabled: false,
  },
];

export const DEFAULT_ENABLED_LIGHT_CONTROLS = ['brightness', 'color_temp', 'power_wattage'];

