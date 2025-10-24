import { HTTP_STATUS_CODE } from "../../Enums/error.enum";

class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    message: string;

    constructor(
        message: string,
        statusCode: number = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
        isOperational: boolean = true
    ) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);
    }
}

export default AppError;
