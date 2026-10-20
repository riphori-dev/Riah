/**
 * Riah Color Palette
 * Soft, warm, and cozy baby-care aesthetic
 */

export const LightColors = {
  // Primary colors
  background: '#FFF8F4', // Warm white
  primary: '#F4A98A', // Soft coral/peach
  secondary: '#A8D5BA', // Soft mint green
  accent: '#F9C784', // Warm yellow
  text: '#4A3728', // Warm dark brown
  card: '#FFFAF7', // Card background

  successText: '#3B6D11',
  infoText: '#185FA5',
  warningText: '#854F0B',
  dangerText: '#C0392B',
  softDanger: '#FFE8E8',
  onPrimary: '#4A3728',
  action: '#994723',
  softPrimary: '#FFF0E8',
  softBlue: '#EBF7FF',
  softGreen: '#EAF3DE',
  softYellow: '#FAEEDA',
  softPurple: '#F0EFFF',

  // Additional utility colors
  lightText: '#8B7355', // Lighter brown for secondary text
  lightBorder: '#F0E6E0', // Light border/divider
  success: '#A8D5BA', // Use secondary as success (mint green)
  warning: '#F9C784', // Use accent as warning (warm yellow)
  error: '#E8B4A8', // Softer error color
  overlay: 'rgba(74, 55, 40, 0.5)', // Dark brown with transparency

  // Shadows
  shadow: 'rgba(74, 55, 40, 0.1)', // Soft warm shadow
};

export const DarkColors = {
  // Primary colors
  background: '#1F1712',
  primary: '#F4A98A',
  secondary: '#A8D5BA',
  accent: '#F9C784',
  text: '#F8EDE6',
  card: '#2A211B',

  successText: '#B7DDA1',
  infoText: '#9DCCEC',
  warningText: '#F3D192',
  dangerText: '#FFC2B8',
  softDanger: '#442421',
  onPrimary: '#4A3728',
  action: '#F4A98A',
  softPrimary: '#3A2720',
  softBlue: '#173145',
  softGreen: '#203321',
  softYellow: '#3A2D18',
  softPurple: '#29243D',

  // Additional utility colors
  lightText: '#CDBCAD',
  lightBorder: '#4A3728',
  success: '#A8D5BA',
  warning: '#F9C784',
  error: '#E8B4A8',
  overlay: 'rgba(0, 0, 0, 0.65)',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.28)',
};

export const Colors = { ...LightColors };

export function applyColorScheme(isDarkMode: boolean) {
  Object.assign(Colors, isDarkMode ? DarkColors : LightColors);
}
