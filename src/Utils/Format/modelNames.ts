export const formatModelName = (name: string, type: string) => {
  return `${type.replace(/\s+/g, "-")}/${name.replace(/\s+/g, "-")}`;
};
