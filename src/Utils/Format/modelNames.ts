export const formatModelName = (name: string, type: string) => {
  return `${type.toLowerCase().replace(/\s+/g, "-")}/${name
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
};
