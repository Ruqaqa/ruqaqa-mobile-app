export const Platform = {
  OS: 'ios' as string,
  select: (specifics: Record<string, unknown>) => specifics[Platform.OS],
};
