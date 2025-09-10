
export function generateRandomNumber(min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number {
    return Math.floor(Math.random() * (max - min)) + min;
}