export interface IJSONValidator {
    validateJSON: (jsonString: string) => boolean;
    sanitizeJSON: (jsonString: string) => string;
    fixCommonJSONIssues: (jsonString: string) => string;
}
export interface IRequestBodyValidator {
    validateRequestBody: (...args: any[]) => void;
}
export interface IValidator{
    JSONValidator: IJSONValidator;
    RequestBodyValidator: IRequestBodyValidator;
    // SchemaValidator: any;
    // InputSanitizer: any;
    // BusinessValidator: any;
}