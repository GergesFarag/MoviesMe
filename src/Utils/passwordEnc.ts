import { hash } from "bcrypt";
export const passwordEnc = async (password: string): Promise<string> => {
    const saltRounds = 10;
    const hashedPassword = await hash(password, saltRounds);
    return hashedPassword;
}