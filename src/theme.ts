/**
 * Pantry design tokens, matching the tablet prototype.
 * Contrast (WCAG): text #2B1A12 ≈ 16:1 on white and #FFF9E1; #5A4636 ≈ 9:1;
 * #AB4343 5.8:1 on white, 5.5:1 on cream, and white on #AB4343 5.8:1;
 * #597549 5.2:1 on white, 4.9:1 on cream; control border #8A7560 ≈ 4:1.
 */
export const colors = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  cream: '#FFF9E1',
  border: '#EFE3BF',
  divider: '#F3EBD3',
  controlBorder: '#8A7560',
  text: '#2B1A12',
  muted: '#5A4636',
  accent: '#AB4343',
  accentPressed: '#8A3434',
  green: '#597549',
  white: '#FFFFFF',
  disabledBg: '#EDE6DA',
  disabledText: '#5A4636',
};

export const radius = { sm: 16, md: 20, lg: 28 };

/** Minimum 24 px everywhere; titles and key numbers much larger. */
export const font = {
  title: 58,
  heading: 38,
  subheading: 30,
  body: 26,
  small: 24,
  number: 52,
};

export const fontFamily = {
  body: 'Inter',
  display: 'Fredoka',
};
