const customIdGenerator = (prefix = "item") => {
  return `${prefix}-${Date.now()}`;
};

export default customIdGenerator;
