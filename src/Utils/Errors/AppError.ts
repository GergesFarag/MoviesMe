export enum HTTP_STATUS_CODE {
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    DB_DUPLICATE = 11000,
    INTERNAL_SERVER_ERROR = 500
}
class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    
    constructor(
        message: string,
        statusCode: number = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
        isOperational: boolean = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = isOperational;
    
        Error.captureStackTrace(this, this.constructor);
    }
}
export default AppError;