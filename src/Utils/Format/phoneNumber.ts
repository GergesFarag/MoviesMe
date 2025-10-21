import logger from "../../Config/logger";

export const removeSpace = (phoneNumber: string): string => {
  const splitter = phoneNumber.includes(" ")
    ? phoneNumber.split(" ")
    : [phoneNumber];
  const cleaned = splitter.join("");
  return cleaned;
};
