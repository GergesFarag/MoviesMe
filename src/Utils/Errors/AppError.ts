export enum HTTP_STATUS_CODE {
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    PAYMENT_REQUIRED = 402,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503
}

export enum DB_ERROR_CODE {
    DUPLICATE_KEY = 11000,
    VALIDATION_ERROR = 11001,
    CAST_ERROR = 16755
}

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